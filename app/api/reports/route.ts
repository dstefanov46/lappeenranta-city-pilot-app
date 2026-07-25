import { NextResponse } from "next/server";
import { buildForwardedPayload, validateReport, type ReportFields } from "@/lib/report-contract";

export const runtime = "nodejs";

type ErrorPayload = {
  ok: false;
  message: string;
  errors?: Record<string, string>;
};

function jsonError(status: number, payload: ErrorPayload) {
  return NextResponse.json(payload, { status });
}

function getString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : undefined;
}

async function parseRequest(request: Request): Promise<{ fields: ReportFields; photo?: File | null }> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const photoValue = form.get("photo");
    return {
      fields: {
        locale: getString(form.get("locale")),
        lat: getString(form.get("lat")),
        lng: getString(form.get("lng")),
        address: getString(form.get("address")),
        observedAt: getString(form.get("observedAt")),
        nature: form.getAll("nature").filter((value): value is string => typeof value === "string"),
        natureOther: getString(form.get("natureOther")),
        classification: getString(form.get("classification")),
        observedEarlier: getString(form.get("observedEarlier")),
        observedEarlierNote: getString(form.get("observedEarlierNote")),
        contactName: getString(form.get("contactName")),
        contactEmail: getString(form.get("contactEmail"))
      },
      photo: photoValue instanceof File ? photoValue : null
    };
  }

  const body = (await request.json()) as ReportFields;
  return { fields: body };
}

function endpointHost(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return "invalid-url";
  }
}

async function forwardReport(apiUrl: string, payload: ReturnType<typeof buildForwardedPayload>, photo?: File | null) {
  if (photo && photo.size > 0) {
    const outbound = new FormData();
    outbound.set("payload", new Blob([JSON.stringify(payload)], { type: "application/json" }), "payload.json");
    outbound.set("photo", photo, photo.name);
    return fetch(apiUrl, {
      method: "POST",
      body: outbound
    });
  }

  return fetch(apiUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}

export async function POST(request: Request) {
  let parsed: Awaited<ReturnType<typeof parseRequest>>;

  try {
    parsed = await parseRequest(request);
  } catch {
    return jsonError(400, {
      ok: false,
      message: "Invalid request body."
    });
  }

  const validation = validateReport(parsed.fields, parsed.photo);
  if (!validation.ok) {
    return jsonError(422, {
      ok: false,
      message: "Report validation failed.",
      errors: validation.errors
    });
  }

  const apiUrl = process.env.LAPPEENRANTA_REPORT_API_URL;
  if (!apiUrl) {
    console.error("Report forwarding failed", {
      reason: "missing_endpoint"
    });
    return jsonError(503, {
      ok: false,
      message: "Report endpoint is not configured."
    });
  }

  const observationId = crypto.randomUUID();
  const submittedAt = new Date().toISOString();
  const payload = buildForwardedPayload(validation.report, observationId, submittedAt);

  try {
    const response = await forwardReport(apiUrl, payload, parsed.photo);
    if (!response.ok) {
      console.error("Report forwarding failed", {
        endpoint: endpointHost(apiUrl),
        status: response.status
      });
      return jsonError(502, {
        ok: false,
        message: "City report endpoint rejected the report."
      });
    }

    const external = (await response.json().catch(() => ({}))) as { reference?: string; observationId?: string };

    return NextResponse.json({
      ok: true,
      observationId,
      reference: external.reference ?? external.observationId ?? observationId
    });
  } catch (error) {
    console.error("Report forwarding failed", {
      endpoint: endpointHost(apiUrl),
      reason: error instanceof Error ? error.name : "unknown"
    });
    return jsonError(502, {
      ok: false,
      message: "City report endpoint is unavailable."
    });
  }
}
