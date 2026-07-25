import { describe, expect, it } from "vitest";
import { validateReport } from "@/lib/report-contract";

const validReport = {
  locale: "en",
  address: "Valtakatu 1, Lappeenranta",
  observedAt: "2026-07-14T12:00",
  nature: ["melted_snow"],
  classification: "clear_deviation",
  observedEarlier: "unsure"
};

describe("validateReport", () => {
  it("accepts a street-address-only anonymous report", () => {
    const result = validateReport(validReport);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.report.location).toMatchObject({ type: "address" });
      expect(result.report.nature).toEqual(["melted_snow"]);
      expect(result.report.contact).toBeUndefined();
    }
  });

  it("accepts a map pin instead of an address", () => {
    const result = validateReport({
      ...validReport,
      address: "",
      lat: "61.0587",
      lng: "28.1887"
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.report.location).toMatchObject({ type: "pin", lat: 61.0587, lng: 28.1887 });
    }
  });

  it("requires either a complete pin or an address", () => {
    const missing = validateReport({ ...validReport, address: "" });
    const partialPin = validateReport({ ...validReport, address: "", lat: "61.05" });
    expect(missing.ok).toBe(false);
    expect(partialPin.ok).toBe(false);
    if (!missing.ok) expect(missing.errors.location).toBeTruthy();
    if (!partialPin.ok) expect(partialPin.errors.location).toBeTruthy();
  });

  it("validates optional email only when present", () => {
    const blank = validateReport({ ...validReport, contactEmail: "" });
    const invalid = validateReport({ ...validReport, contactEmail: "not-an-email" });
    const valid = validateReport({ ...validReport, contactEmail: "resident@example.com" });
    expect(blank.ok).toBe(true);
    expect(invalid.ok).toBe(false);
    expect(valid.ok).toBe(true);
  });

  it("rejects unknown enum values", () => {
    const result = validateReport({
      ...validReport,
      nature: ["steam"],
      classification: "urgent"
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.nature).toBeTruthy();
      expect(result.errors.classification).toBeTruthy();
    }
  });

  it("accepts multiple nature values", () => {
    const result = validateReport({
      ...validReport,
      nature: ["melted_snow", "vapor"]
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.report.nature).toEqual(["melted_snow", "vapor"]);
    }
  });

  it("rejects invalid and oversized photo files", () => {
    const wrongType = validateReport(validReport, { name: "report.pdf", type: "application/pdf", size: 1000 });
    const tooLarge = validateReport(validReport, { name: "report.jpg", type: "image/jpeg", size: 11 * 1024 * 1024 });
    expect(wrongType.ok).toBe(false);
    expect(tooLarge.ok).toBe(false);
  });
});
