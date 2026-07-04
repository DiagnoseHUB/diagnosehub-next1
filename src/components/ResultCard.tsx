"use client";

import type { DiagnosisResult } from "@/services/diagnosisEngine";

type ResultCardProps = {
  diagnosis: DiagnosisResult;
};

function ResultCard({ diagnosis }: ResultCardProps) {
  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl shadow-blue-950/30">
      <div className="mb-8 flex flex-col gap-6 border-b border-slate-800 pb-8 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-blue-400">
            Diagnose-Ergebnis
          </p>

          <h2 className="text-3xl font-bold text-white">{diagnosis.title}</h2>

          <p className="mt-4 max-w-2xl leading-7 text-slate-400">
            {diagnosis.description}
          </p>
        </div>

        <div className="min-w-40 rounded-2xl border border-blue-500/30 bg-blue-500/10 p-5 text-center">
          <p className="text-sm text-slate-400">Wahrscheinlichkeit</p>
          <p className="mt-2 text-4xl font-bold text-blue-300">
            {diagnosis.probability}
          </p>
        </div>
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
          <p className="text-sm text-slate-500">Prioritaet</p>
          <p className="mt-2 text-xl font-bold text-yellow-400">
            {diagnosis.priority}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
          <p className="text-sm text-slate-500">Status</p>
          <p className="mt-2 text-xl font-bold text-green-400">
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
            Mögliche Ursachen
          </h3>

          <ul className="space-y-3">
            {diagnosis.causes.map((cause) => (
              <li
                key={cause}
                className="flex items-start gap-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-slate-300"
              >
                <span className="mt-1 h-2 w-2 rounded-full bg-blue-400" />
                <span>{cause}</span>
              </li>
            ))}
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
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
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