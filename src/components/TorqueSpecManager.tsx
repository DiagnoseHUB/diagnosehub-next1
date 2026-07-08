"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  TORQUE_SPEC_SAFETY_LABELS,
  TORQUE_SPEC_STATUS_LABELS,
  formatTorqueSpecTitle,
  formatTorqueValue,
  type TorqueSpec,
  type TorqueSpecSafetyLevel,
} from "@/services/torqueSpecs";

type TorqueSpecApiResponse = {
  torqueSpecs?: TorqueSpec[];
  torqueSpec?: TorqueSpec;
  canApprove?: boolean;
  ok?: boolean;
  error?: string;
};

type FormState = {
  manufacturer: string;
  model: string;
  series: string;
  yearFrom: string;
  yearTo: string;
  engineCode: string;
  transmissionCode: string;
  driveType: string;
  systemGroup: string;
  component: string;
  fastener: string;
  position: string;
  torqueNm: string;
  torqueAngleDeg: string;
  torqueSequence: string;
  newFastenerRequired: boolean;
  threadCondition: string;
  safetyLevel: TorqueSpecSafetyLevel;
  sourceType: string;
  sourceReference: string;
  sourceNote: string;
  note: string;
};

const initialFormState: FormState = {
  manufacturer: "",
  model: "",
  series: "",
  yearFrom: "",
  yearTo: "",
  engineCode: "",
  transmissionCode: "",
  driveType: "",
  systemGroup: "",
  component: "",
  fastener: "",
  position: "",
  torqueNm: "",
  torqueAngleDeg: "",
  torqueSequence: "",
  newFastenerRequired: false,
  threadCondition: "",
  safetyLevel: "important",
  sourceType: "Herstellerdaten",
  sourceReference: "",
  sourceNote: "",
  note: "",
};

const safetyLevelOptions: TorqueSpecSafetyLevel[] = [
  "normal",
  "important",
  "safety_critical",
  "engine_critical",
  "high_voltage",
];

function formatDateTime(value?: string | null) {
  if (!value) {
    return "nicht geprüft";
  }

  try {
    return new Date(value).toLocaleString("de-DE", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return value;
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unbekannter Fehler";
}

function statusClassName(status: TorqueSpec["status"]) {
  if (status === "approved") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200";
  }

  if (status === "pending_review") {
    return "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200";
  }

  if (status === "rejected" || status === "blocked") {
    return "border-red-200 bg-red-50 text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200";
  }

  return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        className="min-h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-950"
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className="grid gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
      {label}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-950"
      />
    </label>
  );
}

function TorqueSpecSummary({
  spec,
  framed = true,
}: {
  spec: TorqueSpec;
  framed?: boolean;
}) {
  const vehicleParts = [
    spec.manufacturer,
    spec.model,
    spec.series,
    spec.engineCode ? `Motor ${spec.engineCode}` : "",
  ].filter(Boolean);

  return (
    <div
      className={
        framed
          ? "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900"
          : ""
      }
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-lg font-black text-slate-950 dark:text-white">
            {formatTorqueSpecTitle(spec)}
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
            {vehicleParts.length ? vehicleParts.join(" · ") : "Fahrzeugbezug offen"}
          </p>
        </div>

        <span
          className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-black ${statusClassName(
            spec.status
          )}`}
        >
          {TORQUE_SPEC_STATUS_LABELS[spec.status]}
        </span>
      </div>

      <div className="mt-4 grid gap-3 text-sm text-slate-700 dark:text-slate-300 md:grid-cols-2">
        <p>
          <span className="font-black text-slate-950 dark:text-white">Drehmoment:</span>{" "}
          {formatTorqueValue(spec)}
        </p>
        <p>
          <span className="font-black text-slate-950 dark:text-white">Baugruppe:</span>{" "}
          {spec.systemGroup || "nicht angegeben"}
        </p>
        <p>
          <span className="font-black text-slate-950 dark:text-white">Sicherheitsstufe:</span>{" "}
          {TORQUE_SPEC_SAFETY_LABELS[spec.safetyLevel]}
        </p>
        <p>
          <span className="font-black text-slate-950 dark:text-white">Quelle:</span>{" "}
          {spec.sourceReference || "nicht angegeben"}
        </p>
      </div>

      {(spec.torqueSequence || spec.threadCondition || spec.note || spec.reviewComment) && (
        <div className="mt-4 grid gap-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
          {spec.torqueSequence && <p>Reihenfolge: {spec.torqueSequence}</p>}
          {spec.threadCondition && <p>Gewinde/Zustand: {spec.threadCondition}</p>}
          {spec.note && <p>Notiz: {spec.note}</p>}
          {spec.reviewComment && <p>Prüfkommentar: {spec.reviewComment}</p>}
        </div>
      )}
    </div>
  );
}

export default function TorqueSpecManager() {
  const supabase = useMemo(() => createClient(), []);
  const [formState, setFormState] = useState<FormState>(initialFormState);
  const [approvedSpecs, setApprovedSpecs] = useState<TorqueSpec[]>([]);
  const [ownSpecs, setOwnSpecs] = useState<TorqueSpec[]>([]);
  const [reviewSpecs, setReviewSpecs] = useState<TorqueSpec[]>([]);
  const [canApprove, setCanApprove] = useState(false);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [reviewComments, setReviewComments] = useState<Record<string, string>>({});

  function updateForm<Key extends keyof FormState>(key: Key, value: FormState[Key]) {
    setFormState((currentState) => ({
      ...currentState,
      [key]: value,
    }));
  }

  const getAccessToken = useCallback(async () => {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      throw error;
    }

    const token = data.session?.access_token;

    if (!token) {
      setAuthenticated(false);
      throw new Error("Bitte zuerst einloggen.");
    }

    setAuthenticated(true);
    return token;
  }, [supabase]);

  const requestTorqueSpecs = useCallback(async (path: string, options?: RequestInit) => {
    const token = await getAccessToken();
    const response = await fetch(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(options?.headers || {}),
      },
    });
    const payload = (await response.json().catch(() => ({}))) as TorqueSpecApiResponse;

    if (!response.ok) {
      throw new Error(payload.error || "Anfrage fehlgeschlagen.");
    }

    return payload;
  }, [getAccessToken]);

  const loadSpecs = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const [approvedResponse, ownResponse] = await Promise.all([
        requestTorqueSpecs("/api/torque-specs?scope=approved"),
        requestTorqueSpecs("/api/torque-specs?scope=mine"),
      ]);
      const nextCanApprove = Boolean(approvedResponse.canApprove || ownResponse.canApprove);

      setApprovedSpecs(approvedResponse.torqueSpecs || []);
      setOwnSpecs(ownResponse.torqueSpecs || []);
      setCanApprove(nextCanApprove);

      if (nextCanApprove) {
        const reviewResponse = await requestTorqueSpecs("/api/torque-specs?scope=review");
        setReviewSpecs(reviewResponse.torqueSpecs || []);
      } else {
        setReviewSpecs([]);
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [requestTorqueSpecs]);

  async function saveSpec(submitForReview: boolean) {
    setSaving(true);
    setNotice("");
    setErrorMessage("");

    try {
      const payload = await requestTorqueSpecs("/api/torque-specs", {
        method: "POST",
        body: JSON.stringify({
          ...formState,
          submitForReview,
        }),
      });

      if (payload.torqueSpec) {
        setOwnSpecs((currentSpecs) => [payload.torqueSpec as TorqueSpec, ...currentSpecs]);
      }

      setFormState(initialFormState);
      setNotice(
        submitForReview
          ? "Drehmomentwert zur manuellen Freigabe eingereicht. Nach Freigabe wächst die gemeinsame Datenbank."
          : "Entwurf gespeichert. Er ist nur für dich sichtbar, bis du ihn einreichst."
      );
      await loadSpecs();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function reviewSpec(specId: string, action: "approve" | "reject") {
    setSaving(true);
    setNotice("");
    setErrorMessage("");

    try {
      await requestTorqueSpecs("/api/torque-specs", {
        method: "PATCH",
        body: JSON.stringify({
          id: specId,
          action,
          reviewComment: reviewComments[specId] || "",
        }),
      });

      setNotice(
        action === "approve"
          ? "Drehmomentwert freigegeben und in die gemeinsame Datenbank übernommen."
          : "Drehmomentwert abgelehnt."
      );
      setReviewComments((currentComments) => ({
        ...currentComments,
        [specId]: "",
      }));
      await loadSpecs();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function deleteSpec(specId: string) {
    setSaving(true);
    setNotice("");
    setErrorMessage("");

    try {
      await requestTorqueSpecs("/api/torque-specs", {
        method: "DELETE",
        body: JSON.stringify({ id: specId }),
      });

      setOwnSpecs((currentSpecs) => currentSpecs.filter((spec) => spec.id !== specId));
      setNotice("Drehmomentwert gelöscht.");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    const loadId = window.setTimeout(() => {
      void loadSpecs();
    }, 0);

    return () => {
      window.clearTimeout(loadId);
    };
  }, [loadSpecs]);

  const pendingCount = ownSpecs.filter((spec) => spec.status === "pending_review").length;

  return (
    <div className="mx-auto grid max-w-7xl gap-8">
      <section className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-blue-700 dark:text-blue-300">
              Drehmoment-Freigabe
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 dark:text-white md:text-4xl">
              Gemeinsame Drehmoment-Datenbank
            </h1>
            <p className="mt-3 max-w-3xl leading-7 text-slate-600 dark:text-slate-300">
              Du erfasst Werte als Entwurf oder Einreichung. Erst nach manueller
              Betreiber-Freigabe werden sie für alle Nutzer sichtbar und automatisch in passenden
              Diagnoseantworten ergänzt.
            </p>
          </div>

          <Link
            href="/#diagnose"
            className="inline-flex w-fit rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500"
          >
            Zur Diagnose
          </Link>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Gemeinsame Datenbank</p>
            <p className="mt-2 text-3xl font-black text-slate-950 dark:text-white">{approvedSpecs.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Meine Einreichungen</p>
            <p className="mt-2 text-3xl font-black text-slate-950 dark:text-white">{ownSpecs.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">In Prüfung</p>
            <p className="mt-2 text-3xl font-black text-slate-950 dark:text-white">{pendingCount}</p>
          </div>
        </div>
      </section>

      {authenticated === false && (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
          <p className="font-black">Bitte einloggen.</p>
          <p className="mt-2 leading-7">
            Freigegebene Werte liegen in der gemeinsamen Datenbank. Eigene Entwürfe
            und Einreichungen sind mit deinem Konto verknüpft, damit Prüfung,
            Freigabe und Nachvollziehbarkeit sauber funktionieren.
          </p>
        </section>
      )}

      {(notice || errorMessage) && (
        <section
          className={`rounded-3xl border p-5 text-sm font-bold ${
            errorMessage
              ? "border-red-200 bg-red-50 text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200"
              : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200"
          }`}
        >
          {errorMessage || notice}
        </section>
      )}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-2xl font-black text-slate-950 dark:text-white">
          Drehmomentwert für die gemeinsame Datenbank eintragen
        </h2>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-500 dark:text-slate-400">
          Entwürfe bleiben privat. Einreichungen landen in der Betreiber-Prüfung.
          Nach Freigabe werden sie global verwendet, aber nicht automatisch ohne Prüfung übernommen.
        </p>

        <form
          className="mt-6 grid gap-6"
          onSubmit={(event) => {
            event.preventDefault();
            void saveSpec(false);
          }}
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field
              label="Hersteller"
              value={formState.manufacturer}
              onChange={(value) => updateForm("manufacturer", value)}
              placeholder="z. B. Volkswagen"
            />
            <Field
              label="Modell"
              value={formState.model}
              onChange={(value) => updateForm("model", value)}
              placeholder="z. B. Golf"
            />
            <Field
              label="Baureihe"
              value={formState.series}
              onChange={(value) => updateForm("series", value)}
              placeholder="z. B. VII"
            />
            <Field
              label="Motorcode"
              value={formState.engineCode}
              onChange={(value) => updateForm("engineCode", value)}
              placeholder="z. B. CUNA"
            />
            <Field
              label="Baujahr von"
              value={formState.yearFrom}
              onChange={(value) => updateForm("yearFrom", value)}
              type="number"
              placeholder="2015"
            />
            <Field
              label="Baujahr bis"
              value={formState.yearTo}
              onChange={(value) => updateForm("yearTo", value)}
              type="number"
              placeholder="2020"
            />
            <Field
              label="Getriebecode"
              value={formState.transmissionCode}
              onChange={(value) => updateForm("transmissionCode", value)}
            />
            <Field
              label="Antrieb"
              value={formState.driveType}
              onChange={(value) => updateForm("driveType", value)}
              placeholder="z. B. Frontantrieb"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field
              label="Baugruppe"
              value={formState.systemGroup}
              onChange={(value) => updateForm("systemGroup", value)}
              placeholder="z. B. Bremse"
              required
            />
            <Field
              label="Bauteil"
              value={formState.component}
              onChange={(value) => updateForm("component", value)}
              placeholder="z. B. Bremssattelhalter"
              required
            />
            <Field
              label="Schraubstelle"
              value={formState.fastener}
              onChange={(value) => updateForm("fastener", value)}
              placeholder="z. B. Schraube an Achsschenkel"
              required
            />
            <Field
              label="Position"
              value={formState.position}
              onChange={(value) => updateForm("position", value)}
              placeholder="z. B. vorne links/rechts"
            />
            <Field
              label="Drehmoment Nm"
              value={formState.torqueNm}
              onChange={(value) => updateForm("torqueNm", value)}
              type="number"
              required
            />
            <Field
              label="Drehwinkel Grad"
              value={formState.torqueAngleDeg}
              onChange={(value) => updateForm("torqueAngleDeg", value)}
              type="number"
            />
            <Field
              label="Gewinde/Zustand"
              value={formState.threadCondition}
              onChange={(value) => updateForm("threadCondition", value)}
              placeholder="z. B. trocken, neu, Schraubensicherung"
            />
            <label className="grid gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
              Sicherheitsstufe
              <select
                value={formState.safetyLevel}
                onChange={(event) =>
                  updateForm("safetyLevel", event.target.value as TorqueSpecSafetyLevel)
                }
                className="min-h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-950"
              >
                {safetyLevelOptions.map((option) => (
                  <option key={option} value={option}>
                    {TORQUE_SPEC_SAFETY_LABELS[option]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <TextAreaField
              label="Anzugsreihenfolge"
              value={formState.torqueSequence}
              onChange={(value) => updateForm("torqueSequence", value)}
              placeholder="z. B. über Kreuz, innen nach außen, Stufe 1/2/3"
            />
            <TextAreaField
              label="Hinweis"
              value={formState.note}
              onChange={(value) => updateForm("note", value)}
              placeholder="z. B. nur für Alu-Schwenklager, Schraube ersetzen"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Field
              label="Quellenart"
              value={formState.sourceType}
              onChange={(value) => updateForm("sourceType", value)}
              placeholder="Herstellerdaten"
            />
            <Field
              label="Quellenangabe"
              value={formState.sourceReference}
              onChange={(value) => updateForm("sourceReference", value)}
              placeholder="Dokument, Version, Seite, Datenstand"
            />
            <label className="flex min-h-11 items-center gap-3 self-end rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
              <input
                type="checkbox"
                checked={formState.newFastenerRequired}
                onChange={(event) =>
                  updateForm("newFastenerRequired", event.target.checked)
                }
                className="h-4 w-4 rounded border-slate-300 text-blue-600"
              />
              Neue Schraube/Mutter nötig
            </label>
          </div>

          <TextAreaField
            label="Quellennotiz"
            value={formState.sourceNote}
            onChange={(value) => updateForm("sourceNote", value)}
            placeholder="z. B. Randbedingungen, Ausnahmen, Datenstand"
            rows={2}
          />

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              disabled={saving}
              className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Entwurf speichern
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveSpec(true)}
              className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Zur Freigabe einreichen
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm transition-colors dark:border-emerald-500/40 dark:bg-emerald-500/10">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
              Freigegebene Werte
            </p>
            <h2 className="mt-2 text-2xl font-black text-slate-950 dark:text-white">
              Gemeinsame Drehmoment-Datenbank
            </h2>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">
              Diese Werte sind manuell freigegeben und werden von DiagnoseHUB
              automatisch berücksichtigt, wenn Fahrzeug, Baugruppe und Schraubstelle passen.
            </p>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={() => void loadSpecs()}
            className="w-fit rounded-2xl border border-emerald-300 bg-white px-4 py-2.5 text-sm font-black text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-500/40 dark:bg-slate-950 dark:text-emerald-200 dark:hover:bg-emerald-500/10"
          >
            Aktualisieren
          </button>
        </div>

        <div className="mt-6 grid gap-4">
          {loading && (
            <p className="rounded-2xl border border-emerald-200 bg-white p-4 text-sm font-bold text-slate-600 dark:border-emerald-500/30 dark:bg-slate-950 dark:text-slate-300">
              Lädt...
            </p>
          )}

          {!loading && approvedSpecs.length === 0 && (
            <p className="rounded-2xl border border-emerald-200 bg-white p-4 text-sm font-bold text-slate-600 dark:border-emerald-500/30 dark:bg-slate-950 dark:text-slate-300">
              Noch keine freigegebenen Drehmomentwerte in der gemeinsamen Datenbank.
            </p>
          )}

          {approvedSpecs.map((spec) => (
            <TorqueSpecSummary key={spec.id} spec={spec} />
          ))}
        </div>
      </section>

      {canApprove && (
        <section className="rounded-3xl border border-blue-200 bg-blue-50 p-6 shadow-sm transition-colors dark:border-blue-500/40 dark:bg-blue-500/10">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-blue-700 dark:text-blue-300">
                Betreiber-Freigabe
              </p>
              <h2 className="mt-2 text-2xl font-black text-slate-950 dark:text-white">
                Für die gemeinsame Datenbank freigeben
              </h2>
              <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">
                Nur hier bestätigte Werte werden global sichtbar und dürfen in Diagnosen erscheinen.
              </p>
            </div>
            <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
              {reviewSpecs.length} offene Werte
            </p>
          </div>

          <div className="mt-6 grid gap-4">
            {reviewSpecs.length === 0 && (
              <p className="rounded-2xl border border-blue-200 bg-white p-4 text-sm font-bold text-slate-600 dark:border-blue-500/30 dark:bg-slate-950 dark:text-slate-300">
                Keine offenen Drehmomente.
              </p>
            )}

            {reviewSpecs.map((spec) => (
              <div key={spec.id} className="rounded-2xl border border-blue-200 bg-white p-5 dark:border-blue-500/30 dark:bg-slate-950">
                <TorqueSpecSummary spec={spec} framed={false} />
                <div className="mt-4 grid gap-3">
                  <TextAreaField
                    label="Prüfkommentar"
                    value={reviewComments[spec.id] || ""}
                    onChange={(value) =>
                      setReviewComments((currentComments) => ({
                        ...currentComments,
                        [spec.id]: value,
                      }))
                    }
                    rows={2}
                  />
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void reviewSpec(spec.id, "approve")}
                      className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Freigeben
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void reviewSpec(spec.id, "reject")}
                      className="rounded-2xl border border-red-300 bg-red-50 px-5 py-3 text-sm font-black text-red-700 transition hover:bg-red-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200"
                    >
                      Ablehnen
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-950 dark:text-white">
              Meine Entwürfe und Einreichungen
            </h2>
            <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
              Hier siehst du, was du vorbereitet oder zur Freigabe eingereicht hast.
              Freigegebene Einträge erscheinen zusätzlich in der gemeinsamen Datenbank.
            </p>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={() => void loadSpecs()}
            className="rounded-2xl border border-slate-300 px-4 py-2.5 text-sm font-black text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Aktualisieren
          </button>
        </div>

        <div className="mt-6 grid gap-4">
          {loading && (
            <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
              Lädt...
            </p>
          )}

          {!loading && ownSpecs.length === 0 && (
            <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
              Noch keine Entwürfe oder Einreichungen gespeichert.
            </p>
          )}

          {ownSpecs.map((spec) => (
            <div key={spec.id} className="grid gap-3">
              <TorqueSpecSummary spec={spec} />
              {spec.status !== "approved" && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void deleteSpec(spec.id)}
                  className="w-fit rounded-2xl border border-red-300 px-4 py-2 text-sm font-black text-red-700 transition hover:bg-red-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-500/40 dark:text-red-200"
                >
                  Löschen
                </button>
              )}
              {spec.reviewedAt && (
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  Geprüft: {formatDateTime(spec.reviewedAt)}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
