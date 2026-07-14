"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchJsonWithTimeout } from "@/utils/clientApi";

type CaseFeedbackPanelProps = {
  caseTitle: string;
  caseContext: string;
};

type Rating = "up" | "down" | "";
type FeedbackStatus = "idle" | "sending" | "sent" | "error";
type CorrectionStatus = "idle" | "sending" | "sent" | "error";

const correctionIssueOptions = [
  { value: "technical_error", label: "Fachlich falsch" },
  { value: "safety_risk", label: "Sicherheitsrisiko" },
  { value: "missing_spec", label: "Sollwert fehlt" },
  { value: "unclear_wording", label: "Unklar formuliert" },
  { value: "manufacturer_data_needed", label: "Herstellerdaten nötig" },
  { value: "wrong_priority", label: "Falsche Priorität" },
] as const;

const correctionSeverityOptions = [
  { value: "normal", label: "Normal" },
  { value: "important", label: "Wichtig" },
  { value: "safety_critical", label: "Sicherheitsrelevant" },
] as const;

function getCurrentPage() {
  if (typeof window === "undefined") {
    return "";
  }

  return `${window.location.pathname}${window.location.search}`;
}

export default function CaseFeedbackPanel({
  caseTitle,
  caseContext,
}: CaseFeedbackPanelProps) {
  const [rating, setRating] = useState<Rating>("");
  const [comment, setComment] = useState("");
  const [missingInfo, setMissingInfo] = useState(false);
  const [status, setStatus] = useState<FeedbackStatus>("idle");
  const [error, setError] = useState("");
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctionIssueType, setCorrectionIssueType] =
    useState<(typeof correctionIssueOptions)[number]["value"]>("technical_error");
  const [correctionSeverity, setCorrectionSeverity] =
    useState<(typeof correctionSeverityOptions)[number]["value"]>("important");
  const [correctionQuote, setCorrectionQuote] = useState("");
  const [correctionSuggestion, setCorrectionSuggestion] = useState("");
  const [correctionKeywords, setCorrectionKeywords] = useState("");
  const [correctionStatus, setCorrectionStatus] =
    useState<CorrectionStatus>("idle");
  const [correctionError, setCorrectionError] = useState("");

  async function submitFeedback() {
    setError("");

    if (!rating && !missingInfo && comment.trim().length < 5) {
      setStatus("error");
      setError("Bitte Bewertung, fehlende Info oder kurzen Kommentar angeben.");
      return;
    }

    setStatus("sending");

    try {
      const { response, data } = await fetchJsonWithTimeout<{
        error?: string;
      }>(
        "/api/feedback",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            feedbackType: "case",
            rating,
            missingInfo,
            message: comment.trim(),
            caseTitle,
            caseContext: caseContext.slice(0, 3500),
            page: getCurrentPage(),
          }),
        },
        15000,
      );

      if (!response.ok) {
        throw new Error(data.error || "Feedback konnte nicht gesendet werden.");
      }

      setStatus("sent");
      setComment("");
    } catch (error) {
      setStatus("error");
      setError(
        error instanceof Error
          ? error.message
          : "Feedback konnte nicht gesendet werden.",
      );
    }
  }

  async function submitCorrection() {
    setCorrectionError("");

    if (correctionSuggestion.trim().length < 12) {
      setCorrectionStatus("error");
      setCorrectionError(
        "Bitte kurz beschreiben, was fachlich korrigiert werden soll.",
      );
      return;
    }

    setCorrectionStatus("sending");

    try {
      const {
        data: { session },
      } = await createClient().auth.getSession();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      const { response, data } = await fetchJsonWithTimeout<{
        error?: string;
        message?: string;
      }>(
        "/api/diagnose/corrections",
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            sourceType: "diagnosis",
            issueType: correctionIssueType,
            severity: correctionSeverity,
            title: caseTitle,
            page: getCurrentPage(),
            caseContext: caseContext.slice(0, 5000),
            quotedText: correctionQuote.trim(),
            suggestedCorrection: correctionSuggestion.trim(),
            matchKeywords: correctionKeywords
              .split(/[,\n;]/g)
              .map((keyword) => keyword.trim())
              .filter(Boolean),
          }),
        },
        15000,
      );

      if (!response.ok) {
        throw new Error(
          data.error || "Fachliche Korrektur konnte nicht gespeichert werden.",
        );
      }

      setCorrectionStatus("sent");
      setCorrectionQuote("");
      setCorrectionSuggestion("");
      setCorrectionKeywords("");
    } catch (error) {
      setCorrectionStatus("error");
      setCorrectionError(
        error instanceof Error
          ? error.message
          : "Fachliche Korrektur konnte nicht gespeichert werden.",
      );
    }
  }

  return (
    <section className="mt-6 rounded-3xl border border-slate-800 bg-slate-900/80 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-wide text-blue-300">
            Fallfeedback
          </p>
          <h2 className="mt-2 text-xl font-black text-white">
            War dieser Fall hilfreich?
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Bewertung, Kommentar und fehlende Informationen werden mit dem
            Fallkontext an DiagnoseHUB gesendet.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setRating("up")}
            className={
              rating === "up"
                ? "rounded-xl bg-green-600 px-4 py-2 text-sm font-black text-white"
                : "rounded-xl border border-green-500/40 px-4 py-2 text-sm font-black text-green-300 transition hover:bg-green-600 hover:text-white"
            }
          >
            Daumen hoch
          </button>

          <button
            type="button"
            onClick={() => setRating("down")}
            className={
              rating === "down"
                ? "rounded-xl bg-red-600 px-4 py-2 text-sm font-black text-white"
                : "rounded-xl border border-red-500/40 px-4 py-2 text-sm font-black text-red-300 transition hover:bg-red-600 hover:text-white"
            }
          >
            Daumen runter
          </button>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
        <button
          type="button"
          onClick={() => setCorrectionOpen((current) => !current)}
          className="flex w-full items-center justify-between gap-3 text-left"
        >
          <span>
            <span className="block text-sm font-black uppercase tracking-wide text-amber-300">
              Fachlichen Fehler melden
            </span>
            <span className="mt-1 block text-sm leading-6 text-slate-400">
              Vorschläge werden gespeichert, aber erst nach manueller Freigabe
              als Regel genutzt.
            </span>
          </span>
          <span className="rounded-full border border-slate-700 px-3 py-1 text-xs font-black text-slate-300">
            {correctionOpen ? "Schließen" : "Öffnen"}
          </span>
        </button>

        {correctionOpen && (
          <div className="mt-4 grid gap-3">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-bold text-slate-300">
                Art der Korrektur
                <select
                  value={correctionIssueType}
                  onChange={(event) =>
                    setCorrectionIssueType(
                      event.target.value as typeof correctionIssueType,
                    )
                  }
                  className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-blue-500"
                >
                  {correctionIssueOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm font-bold text-slate-300">
                Wichtigkeit
                <select
                  value={correctionSeverity}
                  onChange={(event) =>
                    setCorrectionSeverity(
                      event.target.value as typeof correctionSeverity,
                    )
                  }
                  className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-blue-500"
                >
                  {correctionSeverityOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <textarea
              value={correctionQuote}
              onChange={(event) => setCorrectionQuote(event.target.value)}
              placeholder='Welche Aussage ist falsch? Beispiel: "Getriebe warmfahren."'
              rows={2}
              className="resize-none rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-blue-500"
            />

            <textarea
              value={correctionSuggestion}
              onChange={(event) => setCorrectionSuggestion(event.target.value)}
              placeholder="Was soll stattdessen gelten? Beispiel: Öltemperatur mit Diagnosetester nach Herstellerdaten prüfen, Öl nicht heiß ablassen."
              rows={4}
              className="resize-none rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-blue-500"
            />

            <input
              value={correctionKeywords}
              onChange={(event) => setCorrectionKeywords(event.target.value)}
              placeholder="Optionale Suchwörter, z. B. DSG, DQ381, Getriebeöl, Öltemperatur"
              className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-blue-500"
            />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => void submitCorrection()}
                disabled={correctionStatus === "sending"}
                className="rounded-xl bg-amber-500 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {correctionStatus === "sending"
                  ? "Wird gespeichert..."
                  : "Zur Prüfung speichern"}
              </button>

              {correctionStatus === "sent" && (
                <p className="text-sm font-semibold text-green-300">
                  Korrektur ist gespeichert und wartet auf Freigabe.
                </p>
              )}

              {correctionStatus === "error" && correctionError && (
                <p className="text-sm font-semibold text-red-300">
                  {correctionError}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 grid gap-3">
        <label className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm font-semibold text-slate-300">
          <input
            type="checkbox"
            checked={missingInfo}
            onChange={(event) => setMissingInfo(event.target.checked)}
            className="h-4 w-4"
          />
          Fehlende Info melden
        </label>

        <textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="Optionaler Kommentar, z. B. Messwert fehlt, Ursache falsch gewichtet, guter Prüfplan..."
          rows={3}
          className="resize-none rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-blue-500"
        />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => void submitFeedback()}
            disabled={status === "sending"}
            className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status === "sending" ? "Wird gesendet..." : "Fallfeedback senden"}
          </button>

          {status === "sent" && (
            <p className="text-sm font-semibold text-green-300">
              Danke, Fallfeedback ist angekommen.
            </p>
          )}

          {status === "error" && error && (
            <p className="text-sm font-semibold text-red-300">{error}</p>
          )}
        </div>
      </div>
    </section>
  );
}
