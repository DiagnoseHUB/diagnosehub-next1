"use client";

import { useState } from "react";
import { fetchJsonWithTimeout } from "@/utils/clientApi";

type CaseFeedbackPanelProps = {
  caseTitle: string;
  caseContext: string;
};

type Rating = "up" | "down" | "";
type FeedbackStatus = "idle" | "sending" | "sent" | "error";

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
