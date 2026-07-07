"use client";

import { useMemo, useState } from "react";
import type { FaultCodeQuickInfo } from "@/services/faultCodeDatabase";

type FaultCodeQuickSearchProps = {
  codes: FaultCodeQuickInfo[];
};

type PrefillDiagnosisDetail = {
  text: string;
};

function normalizeCode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

function getRiskClass(riskLevel: FaultCodeQuickInfo["riskLevel"]) {
  if (riskLevel === "hoch") {
    return "border-red-300 bg-red-50 text-red-950 dark:border-red-700/60 dark:bg-red-950/40 dark:text-red-100";
  }

  if (riskLevel === "mittel") {
    return "border-yellow-300 bg-yellow-50 text-yellow-950 dark:border-yellow-700/60 dark:bg-yellow-950/40 dark:text-yellow-100";
  }

  return "border-green-300 bg-green-50 text-green-950 dark:border-green-700/60 dark:bg-green-950/40 dark:text-green-100";
}

export default function FaultCodeQuickSearch({
  codes,
}: FaultCodeQuickSearchProps) {
  const [codeInput, setCodeInput] = useState("P0299");
  const [symptomInput, setSymptomInput] = useState("");

  const normalizedCode = normalizeCode(codeInput);

  const selectedCode = useMemo(() => {
    return codes.find((code) => code.code === normalizedCode) || null;
  }, [codes, normalizedCode]);

  const suggestions = useMemo(() => {
    const searchText = codeInput.trim().toLowerCase();

    if (!searchText) {
      return codes.slice(0, 6);
    }

    return codes
      .filter((code) => {
        const searchableText = [
          code.code,
          code.title,
          code.system,
          code.description,
          ...code.typicalCauses,
        ]
          .join(" ")
          .toLowerCase();

        return searchableText.includes(searchText);
      })
      .slice(0, 6);
  }, [codes, codeInput]);

  function buildDiagnosisText(code: FaultCodeQuickInfo) {
    return [
      `${code.code} ${code.title}`,
      symptomInput.trim()
        ? `Symptom / Kundenbeanstandung: ${symptomInput.trim()}`
        : "Symptom / Kundenbeanstandung: bitte im Fall ergänzen",
      `System: ${code.system}`,
      `Kurzinfo: ${code.description}`,
      `Risiko: ${code.riskLevel} - ${code.riskNote}`,
      "Bitte Diagnosepfad mit einfachen Checks, Messungen, Plausibilität, nächsten Schritten und Risiko erstellen.",
    ].join("\n");
  }

  function prefillDiagnosis(code: FaultCodeQuickInfo) {
    const detail: PrefillDiagnosisDetail = {
      text: buildDiagnosisText(code),
    };

    window.dispatchEvent(
      new CustomEvent<PrefillDiagnosisDetail>(
        "diagnosehub:prefill-diagnosis",
        { detail },
      ),
    );

    document.getElementById("diagnose")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="text-sm font-black uppercase tracking-wide text-blue-700 dark:text-blue-300">
            OBD-Schnellstart
          </p>
          <h3 className="mt-2 text-2xl font-black text-slate-950 dark:text-white">
            P-Code eingeben
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
            Code suchen, grobe Bedeutung lesen und den Fall ohne neue
            KI-Anfrage in die Diagnose übernehmen.
          </p>

          <div className="mt-4 grid gap-3">
            <input
              value={codeInput}
              onChange={(event) => setCodeInput(event.target.value)}
              placeholder="z. B. P0299"
              className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold uppercase text-slate-950 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />

            <textarea
              value={symptomInput}
              onChange={(event) => setSymptomInput(event.target.value)}
              placeholder="Symptom optional, z. B. Leistungsverlust ab 2500/min"
              rows={3}
              className="resize-none rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>

          {suggestions.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {suggestions.map((code) => (
                <button
                  key={code.code}
                  type="button"
                  onClick={() => setCodeInput(code.code)}
                  className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-black text-slate-700 transition hover:border-blue-500 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-blue-300"
                >
                  {code.code}
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedCode ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-blue-600 px-3 py-1 text-sm font-black text-white">
                {selectedCode.code}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {selectedCode.system}
              </span>
            </div>

            <h4 className="mt-4 text-xl font-black text-slate-950 dark:text-white">
              {selectedCode.title}
            </h4>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {selectedCode.description}
            </p>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <InfoList title="Symptome" items={selectedCode.symptomHints} />
              <InfoList title="Ursachen" items={selectedCode.typicalCauses.slice(0, 5)} />
              <InfoList title="Prüfplan" items={selectedCode.suggestedChecks.slice(0, 5)} />
              <InfoList title="Nächste Schritte" items={selectedCode.nextSteps.slice(0, 5)} />
            </div>

            <div
              className={`mt-4 rounded-2xl border p-4 text-sm leading-6 ${getRiskClass(
                selectedCode.riskLevel,
              )}`}
            >
              <strong className="font-black">
                Risiko: {selectedCode.riskLevel}
              </strong>{" "}
              {selectedCode.riskNote}
            </div>

            <button
              type="button"
              onClick={() => prefillDiagnosis(selectedCode)}
              className="mt-4 rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-500"
            >
              In Diagnose übernehmen
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm leading-6 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            Dieser P-Code ist noch nicht in der lokalen Schnellliste. Du kannst
            ihn trotzdem unten in die Diagnose eingeben.
          </div>
        )}
      </div>
    </section>
  );
}

function InfoList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {title}
      </p>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li
            key={item}
            className="flex gap-2 text-sm leading-5 text-slate-700 dark:text-slate-300"
          >
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600 dark:bg-blue-400" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
