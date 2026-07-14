"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchJsonWithTimeout } from "@/utils/clientApi";
import {
  SIGNAL_CATEGORIES,
  type SignalChannel,
  type SignalFaultPattern,
  type SignalLibraryCategory,
  type SignalLibraryEntry,
  type SignalReferenceValue,
} from "@/services/signalLibrary";

type SignalLibraryResponse = {
  categories?: SignalLibraryCategory[];
  entries?: SignalLibraryEntry[];
  source?: "database" | "seed";
  warning?: string;
  error?: string;
};

const FIELD_CLASS =
  "w-full rounded-2xl border border-slate-400 bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-950 outline-none transition placeholder:text-slate-500 focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-400";

const CATEGORY_BUTTON_CLASS =
  "rounded-xl border px-3 py-2 text-sm font-black transition disabled:opacity-60";

const PENDING_PREFILL_STORAGE_KEY = "diagnosehub-pending-prefill";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unbekannter Fehler";
}

function severityClasses(severity: SignalFaultPattern["severity"]) {
  if (severity === "stop") {
    return "border-red-300 bg-red-50 text-red-900 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-200";
  }

  if (severity === "warning") {
    return "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200";
  }

  return "border-slate-300 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300";
}

function confidenceLabel(value: SignalReferenceValue["confidence"]) {
  if (value === "allgemein") {
    return "allgemeiner Richtwert";
  }

  if (value === "systemabhängig") {
    return "systemabhängig";
  }

  return "nur Vergleich";
}

function buildPolyline(points: number[], width: number, height: number, index: number) {
  if (points.length === 0) {
    return "";
  }

  const bandHeight = height / Math.max(1, index + 1);
  const channelHeight = Math.min(92, bandHeight);
  const top = 18 + index * 92;
  const step = width / Math.max(points.length - 1, 1);

  return points
    .map((point, pointIndex) => {
      const x = pointIndex * step;
      const y = top + (1 - Math.max(0, Math.min(1, point))) * channelHeight;

      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function WaveformChart({ channels }: { channels: SignalChannel[] }) {
  const visibleChannels = channels.slice(0, 3);
  const width = 720;
  const height = Math.max(150, visibleChannels.length * 96 + 28);

  if (visibleChannels.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-300 bg-slate-50 p-5 text-sm font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
        Kein Referenzverlauf hinterlegt.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-300 bg-white dark:border-slate-800 dark:bg-slate-950">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label="Referenzsignal"
      >
        <rect width={width} height={height} fill="currentColor" className="text-white dark:text-slate-950" />
        {Array.from({ length: 12 }).map((_, index) => (
          <line
            key={`x-${index}`}
            x1={(width / 11) * index}
            y1="0"
            x2={(width / 11) * index}
            y2={height}
            stroke="currentColor"
            className="text-slate-200 dark:text-slate-800"
            strokeWidth="1"
          />
        ))}
        {Array.from({ length: Math.floor(height / 30) }).map((_, index) => (
          <line
            key={`y-${index}`}
            x1="0"
            y1={index * 30}
            x2={width}
            y2={index * 30}
            stroke="currentColor"
            className="text-slate-200 dark:text-slate-800"
            strokeWidth="1"
          />
        ))}

        {visibleChannels.map((channel, index) => (
          <g key={channel.label}>
            <text
              x="18"
              y={18 + index * 92}
              fill="currentColor"
              className="text-[13px] font-bold text-slate-600 dark:text-slate-300"
            >
              {channel.label} · {channel.scaleHint}
            </text>
            <polyline
              points={buildPolyline(channel.points, width, height, index)}
              fill="none"
              stroke={channel.color}
              strokeWidth="5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </g>
        ))}
      </svg>

      <div className="flex flex-wrap gap-2 border-t border-slate-200 p-3 text-xs font-bold text-slate-600 dark:border-slate-800 dark:text-slate-300">
        {visibleChannels.map((channel) => (
          <span key={channel.label} className="inline-flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: channel.color }}
            />
            {channel.label} ({channel.unit})
          </span>
        ))}
      </div>
    </div>
  );
}

function TextList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h3 className="text-sm font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {title}
      </h3>
      <ul className="mt-3 grid gap-2 text-sm leading-6 text-slate-700 dark:text-slate-300">
        {items.map((item) => (
          <li key={item} className="rounded-xl bg-slate-100 px-3 py-2 dark:bg-slate-950">
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

function buildDiagnosisPrefill(entry: SignalLibraryEntry) {
  return `Oszilloskop-/Signalprüfung:
Signal: ${entry.title}
System: ${entry.systemGroup}
Erwartetes Gutbild: ${entry.expectedPattern}
Messaufbau:
${entry.measurementSetup.map((item) => `- ${item}`).join("\n")}

Bitte daraus einen Diagnosepfad mit Messaufbau, Gut-/Schlechtbild, typischen Fehlern und nächsten Prüfungen erstellen.`;
}

export default function SignalLibraryClient() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<SignalLibraryCategory | "Alle">("Alle");
  const [entries, setEntries] = useState<SignalLibraryEntry[]>([]);
  const [selectedSlug, setSelectedSlug] = useState("");
  const [source, setSource] = useState<"database" | "seed">("seed");
  const [warning, setWarning] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const selectedEntry = useMemo(() => {
    return entries.find((entry) => entry.slug === selectedSlug) || entries[0] || null;
  }, [entries, selectedSlug]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadSignals() {
      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams();

        if (query.trim()) {
          params.set("q", query.trim());
        }

        if (category !== "Alle") {
          params.set("category", category);
        }

        const { response, data } = await fetchJsonWithTimeout<SignalLibraryResponse>(
          `/api/signale?${params.toString()}`,
          {
            signal: controller.signal,
          },
          20000,
        );

        if (!response.ok) {
          throw new Error(data.error || "Signalbibliothek konnte nicht geladen werden.");
        }

        const nextEntries = data.entries || [];

        setEntries(nextEntries);
        setSource(data.source || "seed");
        setWarning(data.warning || "");
        setSelectedSlug((currentSlug) =>
          nextEntries.some((entry) => entry.slug === currentSlug)
            ? currentSlug
            : nextEntries[0]?.slug || "",
        );
      } catch (loadError) {
        if (controller.signal.aborted) {
          return;
        }

        setError(getErrorMessage(loadError));
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    const timer = window.setTimeout(() => {
      void loadSignals();
    }, 150);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, category]);

  function sendToDiagnosis(entry: SignalLibraryEntry) {
    const text = buildDiagnosisPrefill(entry);

    try {
      window.sessionStorage.setItem(PENDING_PREFILL_STORAGE_KEY, text);
    } catch {
      // Komfortfunktion. Wenn Session Storage blockiert ist, bleibt die Bibliothek nutzbar.
    }

    window.location.href = "/diagnose";
  }

  return (
    <div className="mx-auto max-w-7xl">
      <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.22em] text-blue-700 dark:text-blue-300">
            Oszilloskop- und Signalbibliothek
          </p>
          <h1 className="mt-3 max-w-4xl text-4xl font-black tracking-tight text-slate-950 dark:text-white sm:text-5xl">
            Gutbild, Fehlerbild und Messaufbau an einem Ort.
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-700 dark:text-slate-300">
            Referenzsignale für Kurbelwellen- und Nockenwellensensoren, LIN/CAN,
            Einspritzventile, Zündspulen, Lambdasonden, Drucksensoren sowie
            Stromaufnahmen von Pumpen und Stellmotoren.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Datenhinweis
          </p>
          <p className="mt-3 leading-7 text-slate-700 dark:text-slate-300">
            Die Werte sind allgemeine Referenzen. Fahrzeuggenaue Herstellerdaten,
            Pinbelegung, Messbedingungen und bekannte Gutbilder bleiben maßgeblich.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-black">
            <span className="rounded-full border border-slate-300 bg-slate-100 px-3 py-1.5 text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
              Quelle: {source === "database" ? "Datenbank" : "Seed-Referenzen"}
            </span>
            <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-blue-800 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-200">
              {entries.length} Signal(e)
            </span>
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-slate-300 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <label className="grid gap-2">
            <span className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Signal suchen
            </span>
            <input
              className={FIELD_CLASS}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="z. B. CAN, LIN, Zündspule, Kurbelwellensensor, Stromaufnahme, Drucksensor"
            />
          </label>

          <button
            type="button"
            onClick={() => {
              setQuery("");
              setCategory("Alle");
            }}
            className="rounded-2xl border border-slate-300 bg-slate-100 px-4 py-3 text-sm font-black text-slate-800 transition hover:bg-white dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Zurücksetzen
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(["Alle", ...SIGNAL_CATEGORIES] as Array<SignalLibraryCategory | "Alle">).map(
            (item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                className={`${CATEGORY_BUTTON_CLASS} ${
                  category === item
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-slate-300 bg-slate-100 text-slate-800 hover:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                }`}
              >
                {item}
              </button>
            ),
          )}
        </div>

        {warning ? (
          <p className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            {warning}
          </p>
        ) : null}

        {error ? (
          <p className="mt-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
            {error}
          </p>
        ) : null}
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[24rem_1fr]">
        <aside className="grid h-fit gap-3">
          {loading ? (
            <div className="rounded-2xl border border-slate-300 bg-white p-5 text-sm font-bold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
              Signale werden geladen...
            </div>
          ) : entries.length === 0 ? (
            <div className="rounded-2xl border border-slate-300 bg-white p-5 text-sm font-bold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
              Kein Signal gefunden.
            </div>
          ) : (
            entries.map((entry) => (
              <button
                key={entry.slug}
                type="button"
                onClick={() => setSelectedSlug(entry.slug)}
                className={`rounded-2xl border p-4 text-left transition ${
                  selectedEntry?.slug === entry.slug
                    ? "border-blue-500 bg-blue-50 dark:border-blue-500/60 dark:bg-blue-500/10"
                    : "border-slate-300 bg-white hover:border-blue-400 dark:border-slate-800 dark:bg-slate-900"
                }`}
              >
                <p className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {entry.category}
                </p>
                <h2 className="mt-1 text-lg font-black text-slate-950 dark:text-white">
                  {entry.title}
                </h2>
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {entry.summary}
                </p>
              </button>
            ))
          )}
        </aside>

        {selectedEntry ? (
          <article className="grid gap-5">
            <section className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm font-black uppercase tracking-wide text-blue-700 dark:text-blue-300">
                    {selectedEntry.systemGroup}
                  </p>
                  <h2 className="mt-2 text-3xl font-black text-slate-950 dark:text-white">
                    {selectedEntry.title}
                  </h2>
                  <p className="mt-3 max-w-3xl leading-7 text-slate-700 dark:text-slate-300">
                    {selectedEntry.summary}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => sendToDiagnosis(selectedEntry)}
                  className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-500"
                >
                  In Diagnose übernehmen
                </button>
              </div>

              <div className="mt-5">
                <WaveformChart channels={selectedEntry.channels} />
              </div>
            </section>

            <section className="grid gap-5 xl:grid-cols-2">
              <TextList title="Wann messen?" items={selectedEntry.whenToUse} />
              <TextList title="Messaufbau" items={selectedEntry.measurementSetup} />
            </section>

            <section className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h3 className="text-sm font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Gutbild
              </h3>
              <p className="mt-3 leading-7 text-slate-700 dark:text-slate-300">
                {selectedEntry.expectedPattern}
              </p>
            </section>

            <section className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h3 className="text-sm font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Referenzwerte
              </h3>
              <div className="mt-4 grid gap-3">
                {selectedEntry.referenceValues.map((value) => (
                  <div
                    key={`${value.label}-${value.value}`}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-slate-950 dark:text-white">
                          {value.label}
                        </p>
                        <p className="mt-1 text-lg font-black text-blue-700 dark:text-blue-300">
                          {value.value}
                        </p>
                      </div>
                      <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-black text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                        {confidenceLabel(value.confidence)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                      {value.condition}. {value.note}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h3 className="text-sm font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Typische Fehlerbilder
              </h3>
              <div className="mt-4 grid gap-3">
                {selectedEntry.commonFaults.map((fault) => (
                  <div
                    key={fault.title}
                    className={`rounded-xl border p-4 ${severityClasses(fault.severity)}`}
                  >
                    <p className="font-black">{fault.title}</p>
                    <div className="mt-3 grid gap-2 text-sm leading-6 lg:grid-cols-3">
                      <p>
                        <span className="font-black">Symptom:</span> {fault.symptom}
                      </p>
                      <p>
                        <span className="font-black">Signal:</span> {fault.signalClue}
                      </p>
                      <p>
                        <span className="font-black">Prüfen:</span> {fault.nextCheck}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="grid gap-5 xl:grid-cols-2">
              <TextList title="Nächste Prüfungen" items={selectedEntry.nextChecks} />
              <TextList title="Sicherheit" items={selectedEntry.safetyNotes} />
            </section>

            <p className="rounded-2xl border border-slate-300 bg-slate-100 p-4 text-sm font-semibold leading-6 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
              {selectedEntry.sourceNote}
            </p>
          </article>
        ) : null}
      </section>
    </div>
  );
}
