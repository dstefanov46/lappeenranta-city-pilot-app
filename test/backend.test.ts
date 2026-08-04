// @vitest-environment node

import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createServer } from "../backend/server";

const payload = {
  observationId: "123e4567-e89b-12d3-a456-426614174000",
  submittedAt: "2026-07-14T12:00:00.000Z",
  locale: "en",
  location: { type: "address", address: "Valtakatu 1, Lappeenranta" },
  observedAt: "2026-07-14T12:00:00.000Z",
  nature: ["vapor"],
  classification: "probable_leak",
  observedEarlier: "no"
};

let dataDirectory: string;

afterEach(async () => {
  if (dataDirectory) await rm(dataDirectory, { recursive: true, force: true });
});

function multipartBody(value: object, filename = "../../ground photo.jpg") {
  const boundary = "lappeenranta-test-boundary";
  const json = Buffer.from(JSON.stringify({ ...value, photo: { fileName: filename, contentType: "image/jpeg", sizeBytes: 11 } }));
  const photo = Buffer.from("image-bytes");
  const sections = [
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="payload"; filename="payload.json"\r\nContent-Type: application/json\r\n\r\n`),
    json,
    Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="${filename}"\r\nContent-Type: image/jpeg\r\n\r\n`),
    photo,
    Buffer.from(`\r\n--${boundary}--\r\n`)
  ];
  return { body: Buffer.concat(sections), contentType: `multipart/form-data; boundary=${boundary}` };
}

describe("report backend", () => {
  it("reports health and persists a valid JSON report", async () => {
    dataDirectory = await mkdtemp(path.join(os.tmpdir(), "lappeenranta-"));
    const app = createServer(dataDirectory);
    expect((await app.inject({ method: "GET", url: "/health" })).statusCode).toBe(200);
    const response = await app.inject({ method: "POST", url: "/api/reports", headers: { "content-type": "application/json" }, payload: JSON.stringify(payload) });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ reference: payload.observationId, observationId: payload.observationId });
    expect(JSON.parse(await readFile(path.join(dataDirectory, `${payload.observationId}.json`), "utf8"))).toMatchObject({ locale: "en" });
    await app.close();
  });

  it("persists a multipart photo with a safe filename", async () => {
    dataDirectory = await mkdtemp(path.join(os.tmpdir(), "lappeenranta-"));
    const app = createServer(dataDirectory);
    const multipart = multipartBody(payload);
    const response = await app.inject({ method: "POST", url: "/api/reports", headers: { "content-type": multipart.contentType }, payload: multipart.body });
    expect(response.statusCode).toBe(201);
    const files = await readdir(dataDirectory);
    expect(files).toContain(`${payload.observationId}-ground_photo.jpg`);
    expect(await readFile(path.join(dataDirectory, `${payload.observationId}-ground_photo.jpg`), "utf8")).toBe("image-bytes");
    await app.close();
  });

  it("rejects malformed payloads and invalid photo types", async () => {
    dataDirectory = await mkdtemp(path.join(os.tmpdir(), "lappeenranta-"));
    const app = createServer(dataDirectory);
    const invalid = await app.inject({ method: "POST", url: "/api/reports", headers: { "content-type": "application/json" }, payload: JSON.stringify({}) });
    expect(invalid.statusCode).toBe(422);
    const multipart = multipartBody(payload).body.toString().replace("Content-Type: image/jpeg", "Content-Type: text/plain");
    const badPhoto = await app.inject({ method: "POST", url: "/api/reports", headers: { "content-type": "multipart/form-data; boundary=lappeenranta-test-boundary" }, payload: multipart });
    expect(badPhoto.statusCode).toBe(422);
    await app.close();
  });
});
