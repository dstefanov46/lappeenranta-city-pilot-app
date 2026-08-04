import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import multipart from "@fastify/multipart";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { MAX_PHOTO_BYTES, validateReport, type ForwardedReportPayload } from "../lib/report-contract";

type PhotoUpload = { filename: string; contentType: string; data: Buffer };
type ParsedSubmission = { payload: unknown; photo?: PhotoUpload };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function safeFilename(filename: string) {
  const base = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^\.+/, "");
  return base && base !== "." && base !== ".." ? base.slice(0, 120) : "photo";
}

async function readStream(stream: NodeJS.ReadableStream, maxBytes: number) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of stream as AsyncIterable<Buffer | string>) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBytes) throw new Error("photo_too_large");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

async function parseSubmission(request: FastifyRequest): Promise<ParsedSubmission> {
  const contentType = String(request.headers["content-type"] ?? "");
  if (!contentType.includes("multipart/form-data")) return { payload: request.body };

  let payloadText: string | undefined;
  let photo: PhotoUpload | undefined;
  for await (const part of request.parts({ limits: { files: 2, fileSize: MAX_PHOTO_BYTES } })) {
    if (part.type === "file") {
      const data = await readStream(part.file, MAX_PHOTO_BYTES);
      if (part.file.truncated) throw new Error("photo_too_large");
      if (part.fieldname === "photo") photo = { filename: part.filename, contentType: part.mimetype, data };
      else if (part.fieldname === "payload") payloadText = data.toString("utf8");
    } else if (part.fieldname === "payload") {
      if (typeof part.value === "string") payloadText = part.value;
    }
  }
  if (!payloadText) throw new Error("missing_payload");
  let payload: unknown;
  try { payload = JSON.parse(payloadText); } catch { throw new Error("invalid_payload_json"); }
  return { payload, photo };
}

function validateForwardedPayload(value: unknown, photo?: PhotoUpload) {
  const payload = record(value);
  if (!payload || typeof payload.observationId !== "string" || !UUID_PATTERN.test(payload.observationId) ||
      typeof payload.submittedAt !== "string" || Number.isNaN(new Date(payload.submittedAt).getTime())) return null;
  const location = record(payload.location);
  if (!location || !["pin", "address", "both"].includes(String(location.type))) return null;
  const hasLat = typeof location.lat === "number";
  const hasLng = typeof location.lng === "number";
  const hasAddress = typeof location.address === "string" && location.address.trim().length > 0;
  const locationType = String(location.type);
  if (hasLat !== hasLng || (locationType === "pin" && (!hasLat || hasAddress)) ||
      (locationType === "address" && (hasLat || !hasAddress)) ||
      (locationType === "both" && (!hasLat || !hasAddress))) return null;
  if (!Array.isArray(payload.nature) || payload.nature.some((item) => typeof item !== "string")) return null;
  const contact = payload.contact === undefined ? undefined : record(payload.contact);
  if (payload.contact !== undefined && !contact) return null;
  if (contact && ((contact.name !== undefined && typeof contact.name !== "string") ||
      (contact.email !== undefined && typeof contact.email !== "string"))) return null;
  const fields = {
    locale: typeof payload.locale === "string" ? payload.locale : undefined,
    lat: typeof location.lat === "number" ? String(location.lat) : undefined,
    lng: typeof location.lng === "number" ? String(location.lng) : undefined,
    address: typeof location.address === "string" ? location.address : undefined,
    observedAt: typeof payload.observedAt === "string" ? payload.observedAt : undefined,
    nature: payload.nature,
    natureOther: typeof payload.natureOther === "string" ? payload.natureOther : undefined,
    classification: typeof payload.classification === "string" ? payload.classification : undefined,
    observedEarlier: typeof payload.observedEarlier === "string" ? payload.observedEarlier : undefined,
    observedEarlierNote: typeof payload.observedEarlierNote === "string" ? payload.observedEarlierNote : undefined,
    contactName: contact?.name as string | undefined,
    contactEmail: contact?.email as string | undefined
  };
  const photoMeta = record(payload.photo);
  if (photoMeta && (typeof photoMeta.fileName !== "string" || typeof photoMeta.contentType !== "string" || typeof photoMeta.sizeBytes !== "number")) return null;
  if (photoMeta && !photo) return null;
  if (photo && (!photo.contentType.startsWith("image/") || photo.data.length === 0)) return null;
  if (photoMeta && photo && (photoMeta.sizeBytes !== photo.data.length || photoMeta.contentType !== photo.contentType)) return null;
  const result = validateReport(fields, photoMeta ? { name: String(photoMeta.fileName), type: String(photoMeta.contentType), size: Number(photoMeta.sizeBytes) } : null);
  return result.ok ? { payload: payload as ForwardedReportPayload, report: result.report } : null;
}

async function atomicWrite(filename: string, data: string | Buffer) {
  const temporary = `${filename}.${randomUUID()}.tmp`;
  try { await writeFile(temporary, data, { flag: "wx" }); await rename(temporary, filename); }
  catch (error) { await rm(temporary, { force: true }); throw error; }
}

export function createServer(dataDir = process.env.LAPPEENRANTA_DATA_DIR || "./data"): FastifyInstance {
  const app = Fastify({ logger: true });
  app.register(multipart);
  app.get("/health", async () => ({ ok: true }));
  app.post("/api/reports", async (request, reply) => {
    let submission: ParsedSubmission;
    try { submission = await parseSubmission(request); }
    catch (error) {
      const tooLarge = error instanceof Error && (/too large/i.test(error.message) || error.message === "photo_too_large");
      return reply.code(tooLarge ? 413 : 400).send({ ok: false, message: "Invalid report payload." });
    }
    const validated = validateForwardedPayload(submission.payload, submission.photo);
    if (!validated) return reply.code(422).send({ ok: false, message: "Report validation failed." });
    const payload = validated.payload;
    const directory = path.resolve(dataDir);
    await mkdir(directory, { recursive: true });
    const id = payload.observationId;
    const reportFilename = path.join(directory, `${id}.json`);
    let photoFilename: string | undefined;
    try {
      if (submission.photo) {
        photoFilename = `${id}-${safeFilename(payload.photo?.fileName || submission.photo.filename)}`;
        await atomicWrite(path.join(directory, photoFilename), submission.photo.data);
      }
      const stored = { ...payload, ...(photoFilename && payload.photo ? { photo: { ...payload.photo, fileName: photoFilename } } : {}) };
      await atomicWrite(reportFilename, JSON.stringify(stored, null, 2) + "\n");
    } catch (error) {
      if (photoFilename) await rm(path.join(directory, photoFilename), { force: true });
      request.log.error(error, "Failed to persist report");
      return reply.code(500).send({ ok: false, message: "Report could not be stored." });
    }
    return reply.code(201).send({ reference: id, observationId: id });
  });
  return app;
}

if (require.main === module) {
  const port = Number(process.env.LAPPEENRANTA_BACKEND_PORT || 4000);
  createServer().listen({ host: "127.0.0.1", port }).catch((error) => { console.error(error); process.exit(1); });
}
