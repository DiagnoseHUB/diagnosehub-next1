"use client";

import type { DiagnosisResult } from "@/services/diagnosisEngine";

type ResultCardProps = {
  diagnosis: DiagnosisResult;
};

function getCauseCardClasses(index: number) {
  if (index === 0) {
    return {
      wrapper: "border-slate-700 bg-slate-950/60 text-slate-300",
      dot: "bg-red-400",
      badge: "border-red-400/40 bg-red-950/30 text-red-200",
      label: "hoch",
    };
  }

  if (index === 1) {
    return {
      wrapper: "border-slate-700 bg-slate-950/60 text-slate-300",
      dot: "bg-amber-400",
      badge: "border-amber-400/40 bg-amber-950/30 text-amber-200",
      label: "mittel",
    };
  }

  return {
    wrapper: "border-slate-700 bg-slate-950/60 text-slate-300",
    dot: "bg-slate-500",
    badge: "border-slate-600 bg-slate-900 text-slate-200",
    label: "später",
  };
}

function ResultCard({ diagnosis }: ResultCardProps) {
  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-lg shadow-slate-950/20">
      <div className="mb-8 flex flex-col gap-6 border-b border-slate-800 pb-8 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Diagnose-Ergebnis
          </p>

          <h2 className="text-3xl font-bold text-white">{diagnosis.title}</h2>

          <p className="mt-4 max-w-2xl leading-7 text-slate-400">
            {diagnosis.description}
          </p>
        </div>

        <div className="min-w-40 rounded-2xl border border-slate-800 bg-slate-950/70 p-5 text-center">
          <p className="text-sm text-slate-400">Wahrscheinlichkeit</p>
          <p className="mt-2 text-4xl font-bold text-slate-100">
            {diagnosis.probability}
          </p>
        </div>
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
          <p className="text-sm text-slate-500">Priorität</p>
          <p className="mt-2 text-xl font-bold text-slate-100">
            {diagnosis.priority}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
          <p className="text-sm text-slate-500">Status</p>
          <p className="mt-2 text-xl font-bold text-slate-100">
            Prüfplan erstellt
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
          <p className="text-sm text-slate-500">Modus</p>
          <p className="mt-2 text-xl font-bold text-white">Regel-Engine</p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <h3 className="mb-4 text-xl font-bold text-white">
            Typische Fehler / mögliche Ursachen
          </h3>

          <ul className="space-y-3">
            {diagnosis.causes.map((cause, index) => {
              const classes = getCauseCardClasses(index);

              return (
                <li
                  key={cause}
                  className={`rounded-2xl border p-4 ${classes.wrapper}`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-2 h-2 w-2 shrink-0 rounded-full ${classes.dot}`}
                    />
                    <div>
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black uppercase tracking-wide ${classes.badge}`}
                      >
                        {classes.label}
                      </span>
                      <p className="mt-2 leading-6">{cause}</p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div>
          <h3 className="mb-4 text-xl font-bold text-white">Prüfplan</h3>

          <ol className="space-y-3">
            {diagnosis.checks.map((check, index) => (
              <li
                key={check}
                className="flex gap-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-slate-300"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-sm font-bold text-slate-200">
                  {index + 1}
                </span>

                <span>{check}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

export default ResultCard;
