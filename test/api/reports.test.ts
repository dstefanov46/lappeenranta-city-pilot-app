// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/reports/route";

const endpoint = "https://city.example.test/reports";

const body = {
  locale: "en",
  address: "Valtakatu 1, Lappeenranta",
  observedAt: "2026-07-14T12:00",
  nature: ["vapor"],
  classification: "probable_leak",
  observedEarlier: "no"
};

describe("POST /api/reports", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.LAPPEENRANTA_REPORT_API_URL;
  });

  it("forwards JSON reports without a photo", async () => {
    process.env.LAPPEENRANTA_REPORT_API_URL = endpoint;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ reference: "LP-123" }), {
        status: 201,
        headers: { "content-type": "application/json" }
      })
    );

    const response = await POST(
      new Request("http://localhost/api/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, reference: "LP-123" });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0];
    expect(init?.headers).toMatchObject({ "content-type": "application/json" });
    expect(JSON.parse(init?.body as string)).toMatchObject({
      locale: "en",
      nature: ["vapor"],
      location: { type: "address", address: body.address }
    });
  });

  it("forwards multipart reports with a photo", async () => {
    process.env.LAPPEENRANTA_REPORT_API_URL = endpoint;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ reference: "LP-456" }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );

    const form = new FormData();
    Object.entries(body).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((item) => form.append(key, item));
      } else {
        form.set(key, value);
      }
    });
    form.set("photo", new File(["image-bytes"], "ground.jpg", { type: "image/jpeg" }));

    const response = await POST(
      new Request("http://localhost/api/reports", {
        method: "POST",
        body: form
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, reference: "LP-456" });
    const [, init] = fetchMock.mock.calls[0];
    expect(init?.body).toBeInstanceOf(FormData);
    const outbound = init?.body as FormData;
    expect(outbound.get("photo")).toBeInstanceOf(File);
    expect(outbound.get("payload")).toBeInstanceOf(File);
  });

  it("maps validation and external endpoint errors", async () => {
    process.env.LAPPEENRANTA_REPORT_API_URL = endpoint;
    const validationResponse = await POST(
      new Request("http://localhost/api/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...body, address: "", nature: [] })
      })
    );
    expect(validationResponse.status).toBe(422);

    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("bad", { status: 500 }));
    const externalResponse = await POST(
      new Request("http://localhost/api/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      })
    );
    expect(externalResponse.status).toBe(502);
  });

  it("rejects invalid images before forwarding", async () => {
    process.env.LAPPEENRANTA_REPORT_API_URL = endpoint;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
    const form = new FormData();
    Object.entries(body).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((item) => form.append(key, item));
      } else {
        form.set(key, value);
      }
    });
    form.set("photo", new File(["not-image"], "note.txt", { type: "text/plain" }));

    const response = await POST(new Request("http://localhost/api/reports", { method: "POST", body: form }));
    expect(response.status).toBe(422);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

