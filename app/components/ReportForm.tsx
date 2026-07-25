"use client";

import { Camera, CheckCircle2, LocateFixed, RotateCcw, Send } from "lucide-react";
import { FormEvent, useState } from "react";
import {
  classificationOptions,
  natureOptions,
  observedEarlierOptions,
  validateReport,
  type Locale,
  type Nature,
  type ReportFields
} from "@/lib/report-contract";
import { translations } from "@/lib/translations";

type Status =
  | { state: "idle" }
  | { state: "submitting" }
  | { state: "success"; reference: string }
  | { state: "error"; message: string };

type FormState = Omit<Required<ReportFields>, "nature"> & {
  nature: Nature[];
  consent: boolean;
};

function localDateTimeValue(date = new Date()) {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

const initialForm = (): FormState => ({
  locale: "en",
  lat: "",
  lng: "",
  address: "",
  observedAt: localDateTimeValue(),
  nature: [],
  natureOther: "",
  classification: "",
  observedEarlier: "unsure",
  observedEarlierNote: "",
  contactName: "",
  contactEmail: "",
  consent: false
});

function fieldFromForm(form: FormState): ReportFields {
  const { consent: _consent, ...fields } = form;
  return fields;
}

export function ReportForm() {
  const [form, setForm] = useState<FormState>(() => initialForm());
  const [photo, setPhoto] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>({ state: "idle" });
  const copy = translations[form.locale as Locale];

  function update(name: keyof FormState, value: string | boolean) {
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => {
      const next = { ...current };
      delete next[name];
      if (name === "lat" || name === "lng" || name === "address") {
        delete next.location;
      }
      return next;
    });
  }

  function toggleLanguage() {
    update("locale", form.locale === "en" ? "fi" : "en");
  }

  function toggleNature(option: Nature, checked: boolean) {
    setForm((current) => ({
      ...current,
      nature: checked ? [...current.nature, option] : current.nature.filter((item) => item !== option)
    }));
    setErrors((current) => {
      const next = { ...current };
      delete next.nature;
      if (option === "other") {
        delete next.natureOther;
      }
      return next;
    });
  }

  function useLocation() {
    if (!navigator.geolocation) {
      setErrors((current) => ({ ...current, location: "Geolocation is not available in this browser." }));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((current) => ({
          ...current,
          lat: position.coords.latitude.toFixed(6),
          lng: position.coords.longitude.toFixed(6)
        }));
        setErrors((current) => {
          const next = { ...current };
          delete next.location;
          return next;
        });
      },
      () => {
        setErrors((current) => ({ ...current, location: copy.locationRequired }));
      },
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateReport(fieldFromForm(form), photo);
    const nextErrors = validation.ok ? {} : translateErrors(validation.errors, copy);

    if (!form.consent) {
      nextErrors.consent = copy.consentRequired;
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setStatus({ state: "idle" });
      return;
    }

    const body = new FormData();
    Object.entries(fieldFromForm(form)).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((item) => body.append(key, item));
      } else {
        body.set(key, value);
      }
    });
    if (photo) {
      body.set("photo", photo);
    }

    setStatus({ state: "submitting" });
    setErrors({});

    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        body
      });
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        reference?: string;
        message?: string;
        errors?: Record<string, string>;
      };

      if (!response.ok || !payload.ok) {
        if (payload.errors) {
          setErrors(translateErrors(payload.errors, copy));
        }
        setStatus({ state: "error", message: payload.message ?? copy.errorText });
        return;
      }

      setStatus({ state: "success", reference: payload.reference ?? "" });
    } catch {
      setStatus({ state: "error", message: copy.errorText });
    }
  }

  function reset() {
    setForm(initialForm());
    setPhoto(null);
    setErrors({});
    setStatus({ state: "idle" });
  }

  if (status.state === "success") {
    return (
      <main className="page-shell">
        <section className="success-panel" aria-labelledby="success-title">
          <CheckCircle2 aria-hidden="true" className="success-icon" />
          <h1 id="success-title">{copy.successTitle}</h1>
          <p>{copy.successText}</p>
          <dl>
            <dt>{copy.reference}</dt>
            <dd>{status.reference}</dd>
          </dl>
          <button className="button primary" type="button" onClick={reset}>
            <RotateCcw aria-hidden="true" />
            {copy.newReport}
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <form className="report-form" onSubmit={submit} noValidate>
        <header className="form-header">
          <div className="brand-block">
            <svg className="brand-waves" viewBox="0 0 180 58" aria-hidden="true">
              <path d="M16 48c30-28 58-18 82-10 20 7 37 3 58-15-28 9-47 3-65-2C61 12 37 22 16 48Z" />
              <path d="M76 17c19-18 34-20 55-10 14 7 25 6 36-2-18 16-34 21-53 16-15-4-25-8-38-4Z" />
            </svg>
            <p className="kicker">{copy.appName}</p>
            <h1>{copy.intro}</h1>
          </div>
          <div className="header-actions">
            <button className="language-toggle" type="button" onClick={toggleLanguage}>
              {form.locale === "fi" ? "English" : "Suomi"}
            </button>
          </div>
        </header>

        <section className="form-section" aria-labelledby="location-heading">
          <div className="section-heading">
            <h2 id="location-heading">{copy.locationTitle}</h2>
            <p>{copy.locationHelp}</p>
          </div>
          <div className="location-grid">
            <div className="coordinate-panel">
              <button className="button secondary" type="button" onClick={useLocation}>
                <LocateFixed aria-hidden="true" />
                {copy.useMyLocation}
              </button>
              <div className="two-col">
                <label>
                  <span>{copy.lat}</span>
                  <input
                    inputMode="decimal"
                    name="lat"
                    value={form.lat}
                    onChange={(event) => update("lat", event.target.value)}
                    aria-invalid={Boolean(errors.location)}
                  />
                </label>
                <label>
                  <span>{copy.lng}</span>
                  <input
                    inputMode="decimal"
                    name="lng"
                    value={form.lng}
                    onChange={(event) => update("lng", event.target.value)}
                    aria-invalid={Boolean(errors.location)}
                  />
                </label>
              </div>
            </div>
            <label className="address-field">
              <span>{copy.streetAddress}</span>
              <textarea
                name="address"
                value={form.address}
                onChange={(event) => update("address", event.target.value)}
                aria-invalid={Boolean(errors.location)}
                rows={4}
              />
            </label>
          </div>
          {errors.location ? <p className="field-error">{errors.location}</p> : null}
        </section>

        <section className="form-section">
          <div className="field-grid">
            <label>
              <span>{copy.observedAt}</span>
              <input
                type="datetime-local"
                name="observedAt"
                value={form.observedAt}
                onChange={(event) => update("observedAt", event.target.value)}
                aria-invalid={Boolean(errors.observedAt)}
              />
              {errors.observedAt ? <span className="field-error">{errors.observedAt}</span> : null}
            </label>

            <fieldset>
              <legend>{copy.nature}</legend>
              <div className="option-grid">
                {natureOptions.map((option) => (
                  <label className="choice" key={option}>
                    <input
                      type="checkbox"
                      name="nature"
                      value={option}
                      checked={form.nature.includes(option)}
                      onChange={(event) => toggleNature(option, event.target.checked)}
                    />
                    <span>{copy.natureOptions[option]}</span>
                  </label>
                ))}
              </div>
              {errors.nature ? <p className="field-error">{errors.nature}</p> : null}
            </fieldset>

            {form.nature.includes("other") ? (
              <label>
                <span>{copy.natureOther}</span>
                <textarea
                  name="natureOther"
                  value={form.natureOther}
                  onChange={(event) => update("natureOther", event.target.value)}
                  aria-invalid={Boolean(errors.natureOther)}
                  rows={3}
                />
                {errors.natureOther ? <span className="field-error">{errors.natureOther}</span> : null}
              </label>
            ) : null}

            <fieldset>
              <legend>{copy.classification}</legend>
              <div className="option-grid compact">
                {classificationOptions.map((option) => (
                  <label className="choice" key={option}>
                    <input
                      type="radio"
                      name="classification"
                      value={option}
                      checked={form.classification === option}
                      onChange={(event) => update("classification", event.target.value)}
                    />
                    <span>{copy.classificationOptions[option]}</span>
                  </label>
                ))}
              </div>
              {errors.classification ? <p className="field-error">{errors.classification}</p> : null}
            </fieldset>
          </div>
        </section>

        <section className="form-section">
          <label className="file-drop">
            <Camera aria-hidden="true" />
            <span>{copy.photo}</span>
            <small>{copy.photoHelp}</small>
            <input
              type="file"
              name="photo"
              accept="image/*"
              capture="environment"
              onChange={(event) => setPhoto(event.target.files?.[0] ?? null)}
              aria-invalid={Boolean(errors.photo)}
            />
            {photo ? <strong>{photo.name}</strong> : null}
          </label>
          {errors.photo ? <p className="field-error">{errors.photo}</p> : null}
        </section>

        <section className="form-section">
          <fieldset>
            <legend>{copy.prior}</legend>
            <div className="segmented">
              {observedEarlierOptions.map((option) => (
                <label key={option}>
                  <input
                    type="radio"
                    name="observedEarlier"
                    value={option}
                    checked={form.observedEarlier === option}
                    onChange={(event) => update("observedEarlier", event.target.value)}
                  />
                  <span>{copy.priorOptions[option]}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <label>
            <span>{copy.priorNote}</span>
            <textarea
              name="observedEarlierNote"
              value={form.observedEarlierNote}
              onChange={(event) => update("observedEarlierNote", event.target.value)}
              rows={3}
            />
          </label>
        </section>

        <section className="form-section">
          <div className="section-heading">
            <h2>{copy.contact}</h2>
            <p>{copy.contactHelp}</p>
          </div>
          <div className="two-col">
            <label>
              <span>{copy.name}</span>
              <input name="contactName" value={form.contactName} onChange={(event) => update("contactName", event.target.value)} />
            </label>
            <label>
              <span>{copy.email}</span>
              <input
                type="email"
                name="contactEmail"
                value={form.contactEmail}
                onChange={(event) => update("contactEmail", event.target.value)}
                aria-invalid={Boolean(errors.contactEmail)}
              />
              {errors.contactEmail ? <span className="field-error">{errors.contactEmail}</span> : null}
            </label>
          </div>
        </section>

        <section className="privacy-band">
          <h2>{copy.privacyTitle}</h2>
          <p>{copy.privacyText}</p>
          <label className="consent">
            <input type="checkbox" checked={form.consent} onChange={(event) => update("consent", event.target.checked)} />
            <span>{copy.privacyConsent}</span>
          </label>
          {errors.consent ? <p className="field-error">{errors.consent}</p> : null}
        </section>

        {status.state === "error" ? (
          <div className="error-panel" role="alert">
            <strong>{copy.errorTitle}</strong>
            <span>{status.message || copy.errorText}</span>
            <button className="button secondary" type="submit">
              <RotateCcw aria-hidden="true" />
              {copy.retry}
            </button>
          </div>
        ) : null}

        <footer className="form-footer">
          <button className="button primary" type="submit" disabled={status.state === "submitting"}>
            <Send aria-hidden="true" />
            {status.state === "submitting" ? copy.submitting : copy.submit}
          </button>
        </footer>
      </form>
    </main>
  );
}

function translateErrors(errors: Record<string, string>, copy: ReturnType<typeof getCopyShape>) {
  const mapped: Record<string, string> = {};
  Object.entries(errors).forEach(([key, value]) => {
    if (key === "contactEmail") {
      mapped[key] = copy.invalidEmail;
    } else if (key === "location") {
      mapped[key] = value.includes("both") ? copy.locationError : copy.locationRequired;
    } else if (key === "natureOther") {
      mapped[key] = copy.natureOtherRequired;
    } else {
      mapped[key] = copy.required;
    }
  });
  return mapped;
}

function getCopyShape() {
  return translations.en;
}
