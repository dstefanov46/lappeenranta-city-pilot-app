export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

export const natureOptions = [
  "melted_snow",
  "warm_ground",
  "vapor",
  "water_pond",
  "ground_depression",
  "other"
] as const;

export const classificationOptions = [
  "slight_suspicion",
  "clear_deviation",
  "probable_leak"
] as const;

export const observedEarlierOptions = ["yes", "no", "unsure"] as const;
export const localeOptions = ["en", "fi"] as const;

export type Nature = (typeof natureOptions)[number];
export type Classification = (typeof classificationOptions)[number];
export type ObservedEarlier = (typeof observedEarlierOptions)[number];
export type Locale = (typeof localeOptions)[number];

export type ReportFile = {
  name: string;
  type: string;
  size: number;
};

export type ReportFields = {
  locale?: string;
  lat?: string;
  lng?: string;
  address?: string;
  observedAt?: string;
  nature?: string | string[];
  natureOther?: string;
  classification?: string;
  observedEarlier?: string;
  observedEarlierNote?: string;
  contactName?: string;
  contactEmail?: string;
};

export type NormalizedReport = {
  locale: Locale;
  location: {
    type: "pin" | "address" | "both";
    lat?: number;
    lng?: number;
    address?: string;
  };
  observedAt: string;
  nature: Nature[];
  natureOther?: string;
  classification: Classification;
  observedEarlier: ObservedEarlier;
  observedEarlierNote?: string;
  contact?: {
    name?: string;
    email?: string;
  };
  photo?: {
    fileName: string;
    contentType: string;
    sizeBytes: number;
  };
};

export type ValidationResult =
  | { ok: true; report: NormalizedReport }
  | { ok: false; errors: Record<string, string> };

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isOneOf<T extends readonly string[]>(value: string, options: T): value is T[number] {
  return options.includes(value);
}

function parseCoordinate(value: string, min: number, max: number) {
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    return null;
  }
  return parsed;
}

function parseNature(value: ReportFields["nature"]) {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return Array.from(new Set(values.map(text).filter(Boolean)));
}

export function validateReport(fields: ReportFields, photo?: ReportFile | null): ValidationResult {
  const errors: Record<string, string> = {};
  const locale = text(fields.locale) || "en";
  const lat = parseCoordinate(text(fields.lat), -90, 90);
  const lng = parseCoordinate(text(fields.lng), -180, 180);
  const address = text(fields.address);
  const observedAtRaw = text(fields.observedAt);
  const nature = parseNature(fields.nature);
  const natureOther = text(fields.natureOther);
  const classification = text(fields.classification);
  const observedEarlier = text(fields.observedEarlier) || "unsure";
  const observedEarlierNote = text(fields.observedEarlierNote);
  const contactName = text(fields.contactName);
  const contactEmail = text(fields.contactEmail);

  if (!isOneOf(locale, localeOptions)) {
    errors.locale = "Unsupported language.";
  }

  if (lat === null || lng === null || (lat !== undefined && lng === undefined) || (lat === undefined && lng !== undefined)) {
    errors.location = "Enter both latitude and longitude, or use a street address.";
  }

  const hasPin = typeof lat === "number" && typeof lng === "number";
  const hasAddress = address.length > 0;
  if (!hasPin && !hasAddress && !errors.location) {
    errors.location = "Add a map pin or a street address.";
  }

  const observedAtDate = observedAtRaw ? new Date(observedAtRaw) : null;
  if (!observedAtRaw || !observedAtDate || Number.isNaN(observedAtDate.getTime())) {
    errors.observedAt = "Enter a valid observation time.";
  }

  if (nature.length === 0 || nature.some((item) => !isOneOf(item, natureOptions))) {
    errors.nature = "Choose the observation type.";
  }

  if (nature.includes("other") && !natureOther) {
    errors.natureOther = "Describe the observation.";
  }

  if (!isOneOf(classification, classificationOptions)) {
    errors.classification = "Choose a classification.";
  }

  if (!isOneOf(observedEarlier, observedEarlierOptions)) {
    errors.observedEarlier = "Choose whether this was observed earlier.";
  }

  if (contactEmail && !emailPattern.test(contactEmail)) {
    errors.contactEmail = "Enter a valid email address.";
  }

  if (photo && photo.size > 0) {
    if (!photo.type.startsWith("image/")) {
      errors.photo = "Upload an image file.";
    } else if (photo.size > MAX_PHOTO_BYTES) {
      errors.photo = "Image must be 10 MB or smaller.";
    }
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  const locationType = hasPin && hasAddress ? "both" : hasPin ? "pin" : "address";
  const report: NormalizedReport = {
    locale: locale as Locale,
    location: {
      type: locationType,
      ...(hasPin ? { lat: lat as number, lng: lng as number } : {}),
      ...(hasAddress ? { address } : {})
    },
    observedAt: (observedAtDate as Date).toISOString(),
    nature: nature as Nature[],
    ...(natureOther ? { natureOther } : {}),
    classification: classification as Classification,
    observedEarlier: observedEarlier as ObservedEarlier,
    ...(observedEarlierNote ? { observedEarlierNote } : {}),
    ...(contactName || contactEmail
      ? {
          contact: {
            ...(contactName ? { name: contactName } : {}),
            ...(contactEmail ? { email: contactEmail } : {})
          }
        }
      : {}),
    ...(photo && photo.size > 0
      ? {
          photo: {
            fileName: photo.name,
            contentType: photo.type,
            sizeBytes: photo.size
          }
        }
      : {})
  };

  return { ok: true, report };
}

export type ForwardedReportPayload = NormalizedReport & {
  observationId: string;
  submittedAt: string;
};

export function buildForwardedPayload(report: NormalizedReport, observationId: string, submittedAt: string): ForwardedReportPayload {
  return {
    observationId,
    submittedAt,
    ...report
  };
}
