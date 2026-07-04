"use client";

import { FormEvent, useState } from "react";
import TechnicalSchemaImage from "@/components/TechnicalSchemaImage";

const EXAMPLES = [
  "AGR-Ventil",
  "Differenzdrucksensor",
  "CAN-Bus",
  "Ladedruckregelung",
  "Klimakompressor",
  "ABS-Raddrehzahlsensor",
  "Nockenwellensensor",
  "Batteriesensor",
];

async function readJsonSafely(response: Response) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return {
      error: text,
    };
  }
}

export default function LearningKnowledgeSearch() {
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState("");
  const [lastQuery, setLastQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event?: FormEvent) {
    event?.preventDefault();

    const cleanedQuery = query.trim();

    if (cleanedQuery.length < 2) {
      setError("Bitte gib ein Bauteil, System oder Thema ein.");
      return;
    }

    setIsLoading(true);
    setError("");
    setAnswer("");
    setLastQuery(cleanedQuery);

    try {
      const response = await fetch("/api/lernen/wissen", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: cleanedQuery,
        }),
      });

      const data = await readJsonSafely(response);

      if (!response.ok) {
        throw new Error(
          data?.error ||
            `Erklärung fehlgeschlagen. Status: ${response.status}`
        );
      }

      if (!data?.answer) {
        throw new Error("Die API hat keine Erklärung zurückgegeben.");
      }

      setAnswer(data.answer);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Die Erklärung konnte nicht erstellt werden."
      );
    } finally {
      setIsLoading(false);
    }
  }

  function selectExample(value: string) {
    setQuery(value);
    setError("");
    setAnswer("");
    setLastQuery("");
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-blue-600">
            DiagnoseHUB Lernen
          </p>

          <h1 className="text-3xl font-bold tracking-tight text-slate-950">
            Bauteilwissen
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            Lass dir Bauteile, Sensoren, Aktoren und Fahrzeugsysteme praxisnah
            erklären. Ideal zum Lernen, Nachschlagen und zur Vorbereitung auf
            Diagnosefälle.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3 sm:flex-row"
        >
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="z. B. AGR-Ventil, CAN-Bus, Ladedruckregelung ..."
            className="min-h-12 flex-1 rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          />

          <button
            type="submit"
            disabled={isLoading}
            className="min-h-12 rounded-2xl bg-blue-600 px-6 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Erklärung läuft ..." : "Erklären lassen"}
          </button>
        </form>

        <div className="mt-5 flex flex-wrap gap-2">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => selectExample(example)}
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
            >
              {example}
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>

      {(isLoading || answer) && (
        <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-col gap-1 border-b border-slate-100 pb-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Technische Erklärung
            </p>

            <h2 className="text-xl font-bold text-slate-950">
              {lastQuery || query}
            </h2>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200" />
              <div className="h-4 w-full animate-pulse rounded bg-slate-200" />
              <div className="h-4 w-5/6 animate-pulse rounded bg-slate-200" />
              <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200" />
            </div>
          ) : (
            <>
              <div className="whitespace-pre-wrap text-sm leading-7 text-slate-800">
                {answer}
              </div>

              <TechnicalSchemaImage
                context="learning"
                title={lastQuery || query}
                subject={lastQuery || query}
                details={answer}
                className="mt-6"
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
