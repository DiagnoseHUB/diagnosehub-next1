"use client";

import { FormEvent, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchJsonWithTimeout } from "@/utils/clientApi";

type VehicleKnowledgeSearchResponse = {
  answer?: string;
  error?: string;
};

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

export default function VehicleKnowledgeSearch() {
  const supabase = useMemo(() => createClient(), []);
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState("");
  const [lastQuery, setLastQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSearch(event?: FormEvent) {
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
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        window.location.href = "/login";
        return;
      }

      const { response, data } =
        await fetchJsonWithTimeout<VehicleKnowledgeSearchResponse>(
          "/api/wissen/search",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              query: cleanedQuery,
            }),
          },
          30000
        );

      if (!response.ok) {
        throw new Error(data.error || "Suche fehlgeschlagen.");
      }

      setAnswer(data.answer || "");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Die Suche konnte nicht ausgeführt werden."
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
            Freie Wissenssuche
          </p>

          <h1 className="text-3xl font-bold tracking-tight text-slate-950">
            Bauteile und Systeme einfach erklären lassen
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            Suche nach Komponenten, Sensoren, Aktoren, Systemen oder technischen
            Begriffen. DiagnoseHUB erklärt dir Funktion, Aufbau, typische
            Symptome und sinnvolle Prüfungen in der Werkstatt.
          </p>
        </div>

        <form onSubmit={handleSearch} className="flex flex-col gap-3 sm:flex-row">
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
            {isLoading ? "Suche läuft ..." : "Suchen"}
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
              Erklärung
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
            <div className="whitespace-pre-wrap text-sm leading-7 text-slate-800">
              {answer}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
