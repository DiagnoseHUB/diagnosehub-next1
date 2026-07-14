"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import CaseFeedbackPanel from "@/components/CaseFeedbackPanel";
import ProtocolPrintButton from "@/components/ProtocolPrintButton";
import RelatedLearningPanel from "@/components/RelatedLearningPanel";
import VoiceAssistant from "@/components/VoiceAssistant";
import { createClient } from "@/lib/supabase/client";
import {
  readAccountScopedLocalStorage,
  removeAccountScopedLocalStorage,
  writeAccountScopedLocalStorage,
} from "@/services/accountScopedStorage";
import {
  deleteDiagnosisCaseFromSupabase,
  loadDiagnosisCasesFromSupabase,
  migrateLocalDiagnosisCasesToSupabase,
  saveDiagnosisCaseToSupabase,
  type ChatMessage,
  type EngineContext,
  type FaultCodeContext,
  type SavedDiagnosisCase,
} from "@/services/diagnosisCasesSupabase";
import {
  getFaultCodeQuickInfo,
  type FaultCodeQuickInfo,
} from "@/services/faultCodeDatabase";
import {
  getInitialDiagnosisUsage,
  loadDiagnosisUsageFromSupabase,
  normalizeDiagnosisUsage,
  type DiagnosisUsage,
} from "@/services/diagnosisUsageSupabase";
import {
  detectTechnicalSpecContext,
  formatTechnicalSpecContext,
  formatTechnicalSpecContextForPrompt,
  type TechnicalSpec,
  type TechnicalSpecContext,
} from "@/services/technicalSpecs";
import {
  getPlanConfig,
  isUnlimitedPlan,
  isValidUserPlan,
  type UserPlan,
} from "@/config/plans";
import { fetchJsonWithTimeout } from "@/utils/clientApi";

type CurrentDiagnosisCase = {
  messages: ChatMessage[];
  engineContext: EngineContext | null;
  faultCodeContext: FaultCodeContext | null;
  technicalSpecContext?: TechnicalSpecContext | null;
  qualityCheck: string;
  causingPart?: string;
  openedCaseId?: string | null;
};

type CaseStorageSource = "local" | "supabase";
type UsageStorageSource = "local" | "supabase";
type DiagnosisAudienceMode = "workshop" | "hobby";

type UsageLimitPayload = {
  enabled: boolean;
  source: "disabled" | "supabase";
  plan: UserPlan;
  planLabel: string;
  todayKey: string;
  countBefore: number;
  countAfter: number | null;
  maxDailyDiagnoses: number;
  remainingBefore: number;
  remainingAfter: number | null;
  limitReached: boolean;
  warning?: string;
};

type DiagnosisInputQualityLevel = "niedrig" | "mittel" | "hoch" | "sehr hoch";

type DiagnosisInputQualityProfile = {
  score: number;
  level: DiagnosisInputQualityLevel;
  found: string[];
  missing: string[];
  nextBestQuestions: string[];
};

type DiagnosisApiResponse = {
  result?: string;
  engineContext?: EngineContext;
  faultCodeContext?: FaultCodeContext | null;
  technicalSpecContext?: TechnicalSpecContext | null;
  inputQuality?: DiagnosisInputQualityProfile;
  qualityCheck?: string;
  usageLimit?: UsageLimitPayload;
  error?: string;
};

const STORAGE_KEY = "diagnosehub-current-case";
const SAVED_CASES_STORAGE_KEY = "diagnosehub-saved-cases";
const USER_PLAN_STORAGE_KEY = "diagnosehub-user-plan";
const DIAGNOSIS_USAGE_STORAGE_KEY = "diagnosehub-diagnosis-usage";
const AUDIENCE_MODE_STORAGE_KEY = "diagnosehub-audience-mode";
const PENDING_PREFILL_STORAGE_KEY = "diagnosehub-pending-prefill";

const audienceModeOptions: Array<{
  value: DiagnosisAudienceMode;
  label: string;
  description: string;
}> = [
  {
    value: "workshop",
    label: "Werkstatt",
    description: "Diagnosepfad, Messwerte, Plausibilität und Entscheidung.",
  },
  {
    value: "hobby",
    label: "Hobby",
    description: "Normale Sprache, Machbarkeit, Werkzeug, Risiko und Kosten.",
  },
];

function getUserMessageLabel(mode?: DiagnosisAudienceMode) {
  return mode === "hobby" ? "Hobby" : "Werkstatt";
}

function inferAudienceModeFromAccountRole(role: unknown): DiagnosisAudienceMode {
  const normalizedRole = String(role || "").toLowerCase();

  if (
    normalizedRole.includes("privat") ||
    normalizedRole.includes("hobby")
  ) {
    return "hobby";
  }

  return "workshop";
}

const baseQuickQuestions = [
  "Kurze Ausbauanleitung erstellen",
  "Welche Daten fehlen noch?",
  "Messplan mit Soll/Ist erstellen",
  "Was prüfe ich als erstes?",
  "Wahrscheinlichkeiten priorisieren",
  "Entscheidung: weiterfahren oder stoppen?",
];

function normalizeQualityText(value: string) {
  return value
    .toLowerCase()
    .replace(/\u00e4/g, "ae")
    .replace(/\u00f6/g, "oe")
    .replace(/\u00fc/g, "ue")
    .replace(/\u00df/g, "ss");
}

function includesAnyQualityTerm(value: string, terms: string[]) {
  const normalizedValue = normalizeQualityText(value);

  return terms.some((term) =>
    normalizedValue.includes(normalizeQualityText(term)),
  );
}

function hasVehicleIdentityContext(value: string) {
  const normalizedValue = normalizeQualityText(value);

  return (
    /\b(19|20)\d{2}\b/.test(normalizedValue) ||
    /\b[A-Z]{2,5}\d{0,2}\b/.test(value) ||
    includesAnyQualityTerm(normalizedValue, [
      "motorcode",
      "modell",
      "baujahr",
      "kilometer",
      "km",
      "vin",
      "fahrgestellnummer",
      "vw",
      "volkswagen",
      "audi",
      "bmw",
      "mercedes",
      "opel",
      "ford",
      "skoda",
      "seat",
      "cupra",
      "renault",
      "peugeot",
      "citroen",
      "fiat",
      "toyota",
      "hyundai",
      "kia",
      "nissan",
      "passat",
      "golf",
      "touran",
      "transporter",
      "qashqai",
      "focus",
      "astra",
      "corsa",
      "sprinter",
      "ducato",
    ])
  );
}

function hasSymptomContext(value: string) {
  return includesAnyQualityTerm(value, [
    "ruckelt",
    "ruckeln",
    "springt nicht an",
    "startet nicht",
    "geht aus",
    "leistungsverlust",
    "leuchtet",
    "klackert",
    "schleift",
    "zieht",
    "vibriert",
    "geraeusch",
    "geräusch",
    "warm",
    "kalt",
  ]);
}

function hasOperatingConditionContext(value: string) {
  return includesAnyQualityTerm(value, [
    "warm",
    "kalt",
    "leerlauf",
    "volllast",
    "teillast",
    "beim starten",
    "beim bremsen",
    "beim beschleunigen",
    "regen",
    "nach",
    "nur wenn",
  ]);
}

function hasMeasurementContext(value: string) {
  return (
    /\b\d+([,.]\d+)?\s?(v|volt|bar|mbar|ohm|a|ampere|grad|c|nm|%)\b/i.test(
      value,
    ) ||
    includesAnyQualityTerm(value, [
      "messwert",
      "istwert",
      "sollwert",
      "live daten",
      "livedaten",
      "druck",
      "spannung",
      "widerstand",
      "temperatur",
      "adaptionswert",
      "fuel trim",
      "trim",
    ])
  );
}

function hasPreviousChecksContext(value: string) {
  return includesAnyQualityTerm(value, [
    "geprüft",
    "gemessen",
    "getauscht",
    "ersetzt",
    "neu",
    "ausgelesen",
    "abgedrückt",
    "sichtprüfung",
    "stellgliedtest",
  ]);
}

function buildClientInputQualityProfile(
  value: string,
): DiagnosisInputQualityProfile {
  const cleanValue = value.trim();
  const found: string[] = [];
  const missing: string[] = [];
  const nextBestQuestions: string[] = [];

  const checks = [
    {
      ok: hasVehicleIdentityContext(cleanValue),
      found: "Fahrzeugdaten",
      missing: "Fahrzeugdaten",
      question: "Fahrzeug, Baujahr, Motorcode und Kilometerstand ergänzen.",
      points: 20,
    },
    {
      ok: Boolean(detectFirstFaultCodeInput(cleanValue)),
      found: "Fehlercode",
      missing: "Fehlercode",
      question: "Fehlercodes mit Status nennen: aktiv, sporadisch oder historisch.",
      points: 15,
    },
    {
      ok: hasSymptomContext(cleanValue),
      found: "Symptom",
      missing: "Symptom",
      question: "Symptom genauer beschreiben: wann, wie stark, dauerhaft oder sporadisch.",
      points: 20,
    },
    {
      ok: hasOperatingConditionContext(cleanValue),
      found: "Bedingung",
      missing: "Bedingung",
      question: "Betriebszustand ergänzen: kalt/warm, Last, Drehzahl, Gang, Geschwindigkeit.",
      points: 15,
    },
    {
      ok: hasMeasurementContext(cleanValue),
      found: "Messwerte",
      missing: "Messwerte",
      question: "Soll-/Istwerte oder Live-Daten ergänzen, falls vorhanden.",
      points: 20,
    },
    {
      ok: hasPreviousChecksContext(cleanValue),
      found: "Vorprüfung",
      missing: "Vorprüfung",
      question: "Bereits geprüfte oder getauschte Teile nennen.",
      points: 10,
    },
  ];

  let score = cleanValue.length >= 12 ? 10 : 0;

  for (const check of checks) {
    if (check.ok) {
      score += check.points;
      found.push(check.found);
    } else {
      missing.push(check.missing);
      nextBestQuestions.push(check.question);
    }
  }

  const clampedScore = Math.min(100, score);
  const level: DiagnosisInputQualityLevel =
    clampedScore >= 85
      ? "sehr hoch"
      : clampedScore >= 65
        ? "hoch"
        : clampedScore >= 40
          ? "mittel"
          : "niedrig";

  return {
    score: clampedScore,
    level,
    found,
    missing,
    nextBestQuestions: nextBestQuestions.slice(0, 3),
  };
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unbekannter Fehler";
}

function getFriendlyDiagnosisError(error: unknown) {
  const message = getErrorMessage(error);
  const normalizedMessage = message.toLowerCase();

  if (
    normalizedMessage.includes("failed to fetch") ||
    normalizedMessage.includes("networkerror") ||
    normalizedMessage.includes("network error")
  ) {
    return "Die Diagnose konnte die Serververbindung nicht erreichen. Bitte prüfe Internet/VPN und versuche es erneut.";
  }

  return message;
}

function detectFirstFaultCodeInput(value: string) {
  return value.match(/\bP[0-3][0-9A-F]{3}\b/i)?.[0].toUpperCase() || "";
}

function buildTypedFaultCodeContext(
  faultCode: FaultCodeQuickInfo | null,
): FaultCodeContext | null {
  if (!faultCode) {
    return null;
  }

  return {
    foundCodes: [faultCode],
    summary: `${faultCode.code} - ${faultCode.title}`,
  };
}

function getFaultCodeRiskClass(riskLevel: FaultCodeQuickInfo["riskLevel"]) {
  if (riskLevel === "hoch") {
    return "border-red-500/35 bg-red-500/10 text-red-100";
  }

  if (riskLevel === "mittel") {
    return "border-amber-500/35 bg-amber-500/10 text-amber-100";
  }

  return "border-emerald-500/35 bg-emerald-500/10 text-emerald-100";
}

function buildObdQuickStartDiagnosisInput(
  currentInput: string,
  faultCode: FaultCodeQuickInfo,
) {
  return `${currentInput}

Fehlercode-Kontext:
Fehlercode: ${faultCode.code} - ${faultCode.title}
System: ${faultCode.system}
Bedeutung: ${faultCode.description}
Typische Ursachen: ${faultCode.typicalCauses.slice(0, 5).join("; ")}
Prüfreihenfolge: ${faultCode.suggestedChecks.slice(0, 5).join("; ")}
Risiko: ${faultCode.riskLevel} - ${faultCode.riskNote}

Bitte Diagnosepfad mit einfachen Checks, Messungen, Plausibilitätschecks, Entscheidung und nächsten Schritten erstellen.`;
}

function appendTechnicalSpecPrompt(
  diagnosisInput: string,
  technicalSpecContext: TechnicalSpecContext,
  context: "diagnosis" | "instruction" = "diagnosis",
) {
  const technicalSpecPrompt =
    context === "instruction"
      ? technicalSpecContext.foundSpecs.length > 0
        ? `Erkannte mögliche Soll-/Richtwerte:
${formatTechnicalSpecContext(technicalSpecContext)}

Wichtig für Anleitungen: Diese Werte nicht pauschal ausgeben. Nur nennen, wenn der konkrete Arbeitsschritt ohne diesen Wert fachlich nicht korrekt ausführbar ist. Beispiel: Beim DQ250-DSG-Getriebeölwechsel nach dem Durchschalten der Fahrstufen Öltemperatur für die Ölstandseinstellung auf 35-45 °C bringen und per Diagnosetester überwachen.`
        : ""
      : formatTechnicalSpecContextForPrompt(technicalSpecContext);

  if (!technicalSpecPrompt) {
    return diagnosisInput;
  }

  return `${diagnosisInput}

${technicalSpecPrompt}`;
}

function ObdQuickInfoList({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <div className="rounded-xl border border-blue-400/20 bg-blue-950/30 p-3">
      <p className="text-xs font-black uppercase tracking-wide text-blue-200">
        {title}
      </p>
      <ul className="mt-2 space-y-2 text-blue-100">
        {items.map((item) => (
          <li key={item} className="flex gap-2 leading-5">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-300" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TechnicalSpecValueList({ spec }: { spec: TechnicalSpec }) {
  return (
    <div className="grid gap-2">
      {spec.values.slice(0, 6).map((value) => (
        <div
          key={`${spec.id}-${value.label}`}
          className="rounded-xl border border-emerald-400/20 bg-emerald-950/30 p-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-black uppercase tracking-wide text-emerald-200">
              {value.label}
            </p>
            <p className="font-black text-white">{value.value}</p>
          </div>
          <p className="mt-1 text-sm leading-6 text-emerald-100">
            {value.condition}
          </p>
          {value.note ? (
            <p className="mt-1 text-xs leading-5 text-emerald-200">
              {value.note}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function TechnicalSpecBulletList({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <div className="rounded-xl border border-emerald-400/20 bg-emerald-950/30 p-3">
      <p className="text-xs font-black uppercase tracking-wide text-emerald-200">
        {title}
      </p>
      <ul className="mt-2 space-y-2 text-emerald-100">
        {items.map((item) => (
          <li key={item} className="flex gap-2 leading-5">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function getInputQualityPreviewClasses(level: DiagnosisInputQualityLevel) {
  if (level === "sehr hoch" || level === "hoch") {
    return {
      wrapper: "border-emerald-500/30 bg-emerald-500/10 text-emerald-50",
      badge: "border-emerald-400/40 bg-emerald-950/40 text-emerald-100",
      dot: "bg-emerald-300",
    };
  }

  if (level === "mittel") {
    return {
      wrapper: "border-blue-500/30 bg-blue-500/10 text-blue-50",
      badge: "border-blue-400/40 bg-blue-950/40 text-blue-100",
      dot: "bg-blue-300",
    };
  }

  return {
    wrapper: "border-amber-500/30 bg-amber-500/10 text-amber-50",
    badge: "border-amber-400/40 bg-amber-950/40 text-amber-100",
    dot: "bg-amber-300",
  };
}

function InputQualityPreview({
  profile,
}: {
  profile: DiagnosisInputQualityProfile;
}) {
  const classes = getInputQualityPreviewClasses(profile.level);

  return (
    <div className={`mt-3 rounded-2xl border p-4 text-sm ${classes.wrapper}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide opacity-80">
            Antwortgenauigkeit
          </p>
          <h3 className="mt-1 text-lg font-black text-white">
            {profile.score}/100 · {profile.level}
          </h3>
          <p className="mt-2 max-w-3xl leading-6 opacity-90">
            Je mehr konkrete Fahrzeugdaten, Messwerte und Vorprüfungen
            vorhanden sind, desto genauer werden Diagnosepfad und Anleitung.
          </p>
        </div>

        <span className={`rounded-full border px-3 py-1 text-xs font-black ${classes.badge}`}>
          Live-Einschätzung
        </span>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-black/10 p-3">
          <p className="text-xs font-black uppercase tracking-wide opacity-80">
            Erkannt
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(profile.found.length > 0 ? profile.found : ["Noch wenig Kontext"]).map(
              (item) => (
                <span
                  key={item}
                  className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-xs font-bold"
                >
                  {item}
                </span>
              ),
            )}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/10 p-3">
          <p className="text-xs font-black uppercase tracking-wide opacity-80">
            Besser wird es mit
          </p>
          <ul className="mt-2 space-y-2">
            {profile.nextBestQuestions.length > 0 ? (
              profile.nextBestQuestions.map((question) => (
                <li key={question} className="flex gap-2 leading-5">
                  <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${classes.dot}`} />
                  <span>{question}</span>
                </li>
              ))
            ) : (
              <li className="leading-5">Die Eingabe enthält bereits viel verwertbaren Kontext.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

function buildDynamicQuickQuestions(
  engineContext: EngineContext | null,
  faultCodeContext: FaultCodeContext | null,
  technicalSpecContext: TechnicalSpecContext | null,
) {
  const questions: string[] = [...baseQuickQuestions];

  if (engineContext?.engineType === "Diesel") {
    questions.push(
      "Raildruck Soll/Ist prüfen?",
      "Injektor-Rücklaufmenge prüfen?",
      "Ladedruck Soll/Ist prüfen?",
      "DPF-Differenzdruck prüfen?",
      "AGR Soll/Ist prüfen?",
    );
  }

  if (engineContext?.engineType === "Benziner") {
    questions.push(
      "Fuel Trims prüfen?",
      "Zündaussetzer je Zylinder prüfen?",
      "Falschluft prüfen?",
      "Kraftstoffdruck prüfen?",
      "Ladedruck Soll/Ist prüfen?",
    );
  }

  const firstFaultCode = faultCodeContext?.foundCodes[0];

  if (firstFaultCode) {
    questions.unshift(
      `Was bedeutet ${firstFaultCode.code}?`,
      `Prüfplan für ${firstFaultCode.code}`,
      `Messwerte zu ${firstFaultCode.code}`,
    );

    const system = firstFaultCode.system.toLowerCase();

    if (system.includes("ladedruck") || system.includes("aufladung")) {
      questions.push(
        "Ladeluftstrecke abdrücken?",
        "VTG/Wastegate prüfen?",
        "Ladedrucksensor plausibel?",
        "Unterdrucksystem prüfen?",
      );
    }

    if (system.includes("raildruck") || system.includes("kraftstoffdruck")) {
      questions.push(
        "Raildruck beim Starten?",
        "Niederdruckversorgung prüfen?",
        "Mengenregelventil prüfen?",
        "Kraftstofffilter prüfen?",
      );
    }

    if (system.includes("agr")) {
      questions.push(
        "AGR Stellgliedtest?",
        "LMM Reaktion bei AGR prüfen?",
        "AGR Strecke verkokt?",
        "AGR Soll/Ist vergleichen?",
      );
    }

    if (system.includes("dieselpartikelfilter")) {
      questions.push(
        "DPF Differenzdruck Sollwert?",
        "Rußmasse und Aschemasse prüfen?",
        "Regeneration möglich?",
        "Differenzdrucksensor prüfen?",
      );
    }

    if (system.includes("gemisch")) {
      questions.push(
        "Short Term Fuel Trim?",
        "Long Term Fuel Trim?",
        "Ansaugsystem abnebeln?",
        "Lambdasonde plausibel?",
      );
    }

    if (system.includes("verbrennung") || system.includes("laufunruhe")) {
      questions.push(
        "Aussetzerzähller prüfen?",
        "Zylinder eingrenzen?",
        "Kompression prüfen?",
        "Injektor/Zündung quer prüfen?",
      );
    }
  }

  const firstTechnicalSpec = technicalSpecContext?.foundSpecs[0];

  if (firstTechnicalSpec) {
    questions.unshift(
      `Sollwerte für ${firstTechnicalSpec.title}`,
      `Wo messe ich bei ${firstTechnicalSpec.title}?`,
      "Was bedeutet eine Abweichung?",
    );
  }

  return Array.from(new Set(questions)).slice(0, 12);
}

type AssistantSection = {
  title: string;
  lines: string[];
};

function cleanMarkdownMarkers(value: string) {
  return value.replaceAll("**", "").trim();
}

function parseAssistantSections(content: string): AssistantSection[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const sections: AssistantSection[] = [];
  let currentSection: AssistantSection | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const headingMatch = line.match(/^#{1,3}\s+(.+)$/);

    if (headingMatch) {
      if (currentSection) {
        sections.push(currentSection);
      }

      currentSection = {
        title: cleanMarkdownMarkers(headingMatch[1]),
        lines: [],
      };

      continue;
    }

    if (!currentSection) {
      currentSection = {
        title: "Antwort",
        lines: [],
      };
    }

    currentSection.lines.push(line);
  }

  if (currentSection) {
    sections.push(currentSection);
  }

  return sections
    .map((section) => ({
      ...section,
      lines: section.lines.filter((line) => line.trim() !== ""),
    }))
    .filter((section) => section.title || section.lines.length > 0);
}

function getAssistantSectionClasses(title: string) {
  const normalizedTitle = title.toLowerCase();
  const baseWrapper =
    "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/70";
  const neutral = {
    wrapper: baseWrapper,
    title: "text-slate-950 dark:text-slate-100",
    badge:
      "border border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
    dot: "bg-slate-400 dark:bg-slate-500",
  };

  if (
    normalizedTitle.includes("kritisch") ||
    normalizedTitle.includes("achtung") ||
    normalizedTitle.includes("risiko")
  ) {
    return {
      wrapper:
        "rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-sm dark:border-amber-800/70 dark:bg-amber-950/20",
      title: "text-slate-950 dark:text-slate-100",
      badge:
        "border border-amber-300 bg-white text-amber-900 dark:border-amber-800 dark:bg-slate-950 dark:text-amber-200",
      dot: "bg-amber-500 dark:bg-amber-300",
    };
  }

  if (
    normalizedTitle.includes("ursachen") ||
    normalizedTitle.includes("typische fehler") ||
    normalizedTitle.includes("wahrscheinlichkeit")
  ) {
    return {
      ...neutral,
      wrapper:
        "rounded-2xl border border-slate-300 bg-slate-50 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-950/70",
    };
  }

  return neutral;
}

function isCauseSectionTitle(title: string) {
  const normalizedTitle = title.toLowerCase();

  return (
    normalizedTitle.includes("ursachen") ||
    normalizedTitle.includes("typische fehler") ||
    normalizedTitle.includes("wahrscheinlichkeit")
  );
}

function getCausePriorityClasses(priority: string) {
  const normalizedPriority = priority.toLowerCase();

  if (normalizedPriority.includes("hoch")) {
    return {
      wrapper:
        "border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950/70",
      badge:
        "border-red-300 bg-red-50 text-red-800 dark:border-red-800/70 dark:bg-red-950/20 dark:text-red-200",
      accent: "bg-red-500 dark:bg-red-300",
    };
  }

  if (normalizedPriority.includes("mittel")) {
    return {
      wrapper:
        "border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950/70",
      badge:
        "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800/70 dark:bg-amber-950/20 dark:text-amber-200",
      accent: "bg-amber-500 dark:bg-amber-300",
    };
  }

  if (
    normalizedPriority.includes("niedrig") ||
    normalizedPriority.includes("später") ||
    normalizedPriority.includes("spaeter")
  ) {
    return {
      wrapper:
        "border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950/70",
      badge:
        "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
      accent: "bg-slate-400",
    };
  }

  return {
    wrapper:
      "border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950/70",
    badge:
      "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
    accent: "bg-slate-400",
  };
}

function getCauseSegmentClasses() {
  return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300";
}

function getCauseSegmentLabel(label: string) {
  const normalizedLabel = label.toLowerCase();

  if (
    normalizedLabel.includes("fehler") ||
    normalizedLabel.includes("schwachstelle") ||
    normalizedLabel.includes("fehldiagnose")
  ) {
    return "Fehlerbild";
  }

  if (
    normalizedLabel.includes("prüf") ||
    normalizedLabel.includes("beweis") ||
    normalizedLabel.includes("ausschluss")
  ) {
    return "Prüfbeweis";
  }

  if (
    normalizedLabel.includes("entscheidung") ||
    normalizedLabel.includes("folge")
  ) {
    return "Entscheidung";
  }

  return label;
}

function parseCauseLine(value: string) {
  let content = value.trim();
  let priority = "offen";

  const bracketPriority = content.match(
    /^\[(hoch|mittel|niedrig|erst später|später|spaeter|offen)\]\s*(.+)$/i,
  );

  if (bracketPriority) {
    priority = bracketPriority[1];
    content = bracketPriority[2].trim();
  } else {
    const inlinePriority = content.match(
      /^(hoch|mittel|niedrig|erst später|später|spaeter|offen)\s*[:|-]\s*(.+)$/i,
    );

    if (inlinePriority) {
      priority = inlinePriority[1];
      content = inlinePriority[2].trim();
    }
  }

  const segments = content
    .split("|")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => {
      const labelMatch = segment.match(/^([^:]{2,32}):\s*(.+)$/);

      if (!labelMatch) {
        return {
          label: "Hinweis",
          text: segment,
        };
      }

      return {
        label: labelMatch[1].trim(),
        text: labelMatch[2].trim(),
      };
    });

  return {
    priority,
    segments:
      segments.length > 0
        ? segments
        : [
            {
              label: "Hinweis",
              text: content,
            },
          ],
  };
}

function renderCauseLine(line: string, lineIndex: number) {
  const parsedLine = parseCauseLine(line);
  const priorityClasses = getCausePriorityClasses(parsedLine.priority);
  const priorityLabel =
    parsedLine.priority === "offen"
      ? ""
      : parsedLine.priority.toLowerCase().includes("spaeter")
        ? "erst später"
        : parsedLine.priority;
  const mainSegment = parsedLine.segments[0];
  const detailSegments = parsedLine.segments.slice(1);

  return (
    <div
      key={`${line}-${lineIndex}`}
      className={`rounded-xl border p-3 text-sm leading-6 ${priorityClasses.wrapper}`}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        {priorityLabel && (
          <span
            className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-black uppercase tracking-wide ${priorityClasses.badge}`}
          >
            {priorityLabel}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex gap-2 text-slate-800 dark:text-slate-100">
            <span
              className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${priorityClasses.accent}`}
            />
            <p>
              <span className="font-black">{mainSegment.label}:</span>{" "}
              {mainSegment.text}
            </p>
          </div>

          {detailSegments.length > 0 && (
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {detailSegments.map((segment) => (
                <div
                  key={`${segment.label}-${segment.text}`}
                  className={`rounded-lg border px-3 py-2 ${getCauseSegmentClasses()}`}
                >
                  <span className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {getCauseSegmentLabel(segment.label)}
                  </span>
                  <p className="mt-1 leading-6">{segment.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function renderAssistantLine(
  line: string,
  lineIndex: number,
  dotClassName: string,
  sectionTitle: string,
) {
  const trimmedLine = cleanMarkdownMarkers(line);

  if (!trimmedLine || trimmedLine === "---") {
    return null;
  }

  const bulletMatch = trimmedLine.match(/^[-•]\s+(.+)$/);
  const numberMatch = trimmedLine.match(/^(\d+)[.)]\s+(.+)$/);

  if (bulletMatch) {
    if (isCauseSectionTitle(sectionTitle)) {
      return renderCauseLine(bulletMatch[1], lineIndex);
    }

    return (
      <div
        key={`${trimmedLine}-${lineIndex}`}
        className="flex gap-3 text-sm leading-6 text-slate-700 dark:text-slate-300"
      >
        <span
          className={`mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full ${dotClassName}`}
        />
        <span>{bulletMatch[1]}</span>
      </div>
    );
  }

  if (numberMatch) {
    if (isCauseSectionTitle(sectionTitle)) {
      return renderCauseLine(numberMatch[2], lineIndex);
    }

    return (
      <div
        key={`${trimmedLine}-${lineIndex}`}
        className="flex gap-3 text-sm leading-6 text-slate-700 dark:text-slate-300"
      >
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-slate-50 text-xs font-black text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
          {numberMatch[1]}
        </span>
        <span>{numberMatch[2]}</span>
      </div>
    );
  }

  return (
    <p
      key={`${trimmedLine}-${lineIndex}`}
      className="text-sm leading-7 text-slate-700 dark:text-slate-300"
    >
      {trimmedLine}
    </p>
  );
}

function normalizeAssistantContentForAudience(
  content: string,
  mode: DiagnosisAudienceMode,
) {
  if (mode !== "workshop") {
    return content;
  }

  return content.replace(
    /^(\s*#{1,6}\s*)Wann\s+in\s+die\s+Wer(?:kstatt)?\??\s*$/gim,
    "$1Abbruchgrenze / Eskalation",
  );
}

function AssistantAnswer({
  content,
  audienceMode,
}: {
  content: string;
  audienceMode: DiagnosisAudienceMode;
}) {
  const normalizedContent = normalizeAssistantContentForAudience(
    content,
    audienceMode,
  );
  const sections = parseAssistantSections(normalizedContent);

  if (sections.length === 0) {
    return (
      <div className="whitespace-pre-wrap text-sm leading-7 text-slate-300">
        {normalizedContent}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sections.map((section, sectionIndex) => {
        const classes = getAssistantSectionClasses(section.title);

        return (
          <section
            key={`${section.title}-${sectionIndex}`}
            className={classes.wrapper}
          >
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-black uppercase tracking-wide ${classes.badge}`}
              >
                {sectionIndex + 1}
              </span>

              <h3 className={`text-base font-black ${classes.title}`}>
                {section.title}
              </h3>
            </div>

            <div className="space-y-2">
              {section.lines.map((line, lineIndex) =>
                renderAssistantLine(line, lineIndex, classes.dot, section.title),
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function getCaseTitle(messages: ChatMessage[]) {
  const firstUserMessage = messages.find((message) => message.role === "user");

  if (!firstUserMessage) {
    return "Unbenannter Diagnosefall";
  }

  const cleanTitle = firstUserMessage.content.replace(/\s+/g, " ").trim();

  if (cleanTitle.length <= 70) {
    return cleanTitle;
  }

  return `${cleanTitle.slice(0, 70)}...`;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function loadLocalSavedCases(userId?: string | null) {
  try {
    const savedCaseList = readAccountScopedLocalStorage(
      SAVED_CASES_STORAGE_KEY,
      userId,
    );

    if (!savedCaseList) {
      return [];
    }

    const parsedSavedCases = JSON.parse(savedCaseList);

    if (!Array.isArray(parsedSavedCases)) {
      return [];
    }

    return parsedSavedCases as SavedDiagnosisCase[];
  } catch (error) {
    console.error("Lokale Diagnosefälle konnten nicht gelesen werden:", error);
    return [];
  }
}

function saveCasesToLocalStorage(
  savedCases: SavedDiagnosisCase[],
  userId?: string | null,
) {
  writeAccountScopedLocalStorage(
    SAVED_CASES_STORAGE_KEY,
    JSON.stringify(savedCases),
    userId,
  );
}

function saveUsageToLocalStorage(usage: DiagnosisUsage) {
  localStorage.setItem(DIAGNOSIS_USAGE_STORAGE_KEY, JSON.stringify(usage));
}

export default function SearchBar() {
  const supabase = useMemo(() => createClient(), []);

  const [user, setUser] = useState<User | null>(null);

  const [, setCaseStorageSource] =
    useState<CaseStorageSource>("local");
  const [, setCaseSyncLoading] = useState(false);
  const [, setCaseSyncMessage] = useState("");

  const [, setUsageStorageSource] =
    useState<UsageStorageSource>("local");
  const [, setUsageSyncLoading] = useState(false);
  const [, setUsageSyncMessage] = useState("");

  const [search, setSearch] = useState("");
  const [causingPart, setCausingPart] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [engineContext, setEngineContext] = useState<EngineContext | null>(
    null,
  );
  const [faultCodeContext, setFaultCodeContext] =
    useState<FaultCodeContext | null>(null);
  const [technicalSpecContext, setTechnicalSpecContext] =
    useState<TechnicalSpecContext | null>(null);
  const [qualityCheck, setQualityCheck] = useState("");
  const [savedCases, setSavedCases] = useState<SavedDiagnosisCase[]>([]);
  const [userPlan, setUserPlan] = useState<UserPlan>("free");
  const [audienceMode, setAudienceMode] =
    useState<DiagnosisAudienceMode>("workshop");
  const [audienceModeHydrated, setAudienceModeHydrated] = useState(false);
  const [saveDetailsOpen, setSaveDetailsOpen] = useState(false);
  const [diagnosisUsage, setDiagnosisUsage] = useState<DiagnosisUsage>(
    getInitialDiagnosisUsage(),
  );
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [openedCaseId, setOpenedCaseId] = useState<string | null>(null);
  const [copiedMessageIndex, setCopiedMessageIndex] = useState<number | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const latestAssistantMessageRef = useRef<HTMLDivElement | null>(null);
  const loadingMessageRef = useRef<HTMLDivElement | null>(null);
  const hasLoadedCaseRef = useRef(false);
  const shouldAutoScrollRef = useRef(false);
  const audienceModeRef = useRef<DiagnosisAudienceMode>("workshop");

  const typedFaultCodeValue = useMemo(
    () => detectFirstFaultCodeInput(search),
    [search],
  );
  const typedInputQualityProfile = useMemo(
    () => buildClientInputQualityProfile(search),
    [search],
  );
  const typedFaultCodeInfo = useMemo(
    () =>
      typedFaultCodeValue ? getFaultCodeQuickInfo(typedFaultCodeValue) : null,
    [typedFaultCodeValue],
  );
  const typedFaultCodeContext = useMemo(
    () => buildTypedFaultCodeContext(typedFaultCodeInfo),
    [typedFaultCodeInfo],
  );
  const activeFaultCodeContext = typedFaultCodeContext || faultCodeContext;
  const typedTechnicalSpecContext = useMemo(
    () => detectTechnicalSpecContext(search),
    [search],
  );
  const activeTechnicalSpecContext =
    typedTechnicalSpecContext.foundSpecs.length > 0
      ? typedTechnicalSpecContext
      : technicalSpecContext;
  const hasTechnicalSpecContext =
    (activeTechnicalSpecContext?.foundSpecs.length ?? 0) > 0;
  const quickQuestions = useMemo(() => {
    return buildDynamicQuickQuestions(
      engineContext,
      activeFaultCodeContext,
      activeTechnicalSpecContext,
    );
  }, [engineContext, activeFaultCodeContext, activeTechnicalSpecContext]);

  const latestAssistantMessageIndex = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index].role === "assistant") {
        return index;
      }
    }

    return -1;
  }, [messages]);

  const normalizedUsage = useMemo(() => {
    return normalizeDiagnosisUsage(diagnosisUsage);
  }, [diagnosisUsage]);

  const currentPlan = getPlanConfig(userPlan);

  const monthlyLimit = currentPlan.dailyDiagnosisLimit;
  const planIsUnlimited = isUnlimitedPlan(userPlan);
  const savedCaseLimitLabel = planIsUnlimited
    ? "unbegrenzt"
    : String(currentPlan.savedCaseLimit);
  const remainingDiagnoses = Math.max(monthlyLimit - normalizedUsage.count, 0);

  const savingDisabledForPlan = currentPlan.savedCaseLimit <= 0;

  const diagnosisLimitReached = remainingDiagnoses <= 0;

  const openedCaseStillExists =
    openedCaseId !== null &&
    savedCases.some((savedCase) => savedCase.id === openedCaseId);

  const savedCaseLimitReached =
    savingDisabledForPlan ||
    (savedCases.length >= currentPlan.savedCaseLimit && !openedCaseStillExists);

  const changeAudienceMode = useCallback((nextMode: DiagnosisAudienceMode) => {
    audienceModeRef.current = nextMode;
    setAudienceMode(nextMode);
  }, []);

  useEffect(() => {
    if (!shouldAutoScrollRef.current) {
      return;
    }

    if (loading) {
      loadingMessageRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });

      return;
    }

    const lastMessage = messages[messages.length - 1];

    if (lastMessage?.role === "assistant") {
      latestAssistantMessageRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });

      shouldAutoScrollRef.current = false;
    }
  }, [messages, loading]);

  useEffect(() => {
    void initializeSearchBar();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, nextSession: Session | null) => {
        const nextUser = nextSession?.user ?? null;

        setUser(nextUser);

        if (nextUser) {
          loadCurrentCaseFromLocalStorage(nextUser.id);
          setSavedCases(loadLocalSavedCases(nextUser.id));
          window.setTimeout(() => {
            void (async () => {
              await loadPlanForAuthenticatedUser(nextUser);
              await loadUsageForAuthenticatedUser(nextUser);
              await loadCasesForAuthenticatedUser(nextUser, []);
            })();
          }, 0);
        } else {
          setCaseStorageSource("local");
          setUsageStorageSource("local");
          setCaseSyncMessage("");
          setUsageSyncMessage("");
          loadCurrentCaseFromLocalStorage(null);
          loadLocalSavedCasesIntoState(null);
          loadLocalPlanAndUsage();
        }
      },
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    const audienceModeTimer = window.setTimeout(() => {
      try {
        const storedMode = window.localStorage.getItem(
          AUDIENCE_MODE_STORAGE_KEY,
        );

        if (storedMode === "workshop" || storedMode === "hobby") {
          changeAudienceMode(storedMode);
        }
      } catch {
        // Lokale Einstellungen sind Komfort, die Diagnose funktioniert auch ohne.
      } finally {
        setAudienceModeHydrated(true);
      }
    }, 0);

    return () => window.clearTimeout(audienceModeTimer);
  }, [changeAudienceMode]);

  useEffect(() => {
    if (!audienceModeHydrated) {
      return;
    }

    try {
      window.localStorage.setItem(AUDIENCE_MODE_STORAGE_KEY, audienceMode);
    } catch {
      // Lokale Einstellungen sind Komfort, die Diagnose funktioniert auch ohne.
    }
  }, [audienceMode, audienceModeHydrated]);

  useEffect(() => {
    function handlePrefillDiagnosis(event: Event) {
      const detail = (event as CustomEvent<{ text?: unknown }>).detail;

      if (!detail || typeof detail.text !== "string") {
        return;
      }

      setSearch(detail.text);
      setError("");
    }

    window.addEventListener(
      "diagnosehub:prefill-diagnosis",
      handlePrefillDiagnosis,
    );

    return () => {
      window.removeEventListener(
        "diagnosehub:prefill-diagnosis",
        handlePrefillDiagnosis,
      );
    };
  }, []);

  useEffect(() => {
    try {
      const pendingPrefill = window.sessionStorage.getItem(
        PENDING_PREFILL_STORAGE_KEY,
      );

      if (pendingPrefill) {
        window.sessionStorage.removeItem(PENDING_PREFILL_STORAGE_KEY);

        window.setTimeout(() => {
          setSearch(pendingPrefill);
          setError("");
        }, 0);
      }
    } catch {
      // Komfortfunktion: Wenn Session Storage blockiert ist, bleibt die Diagnose normal nutzbar.
    }
  }, []);

  useEffect(() => {
    if (!hasLoadedCaseRef.current) {
      return;
    }

    if (messages.length === 0) {
      removeAccountScopedLocalStorage(STORAGE_KEY, user?.id);
      return;
    }

    const currentCase: CurrentDiagnosisCase = {
      messages,
      engineContext,
      faultCodeContext,
      technicalSpecContext,
      qualityCheck,
      causingPart,
      openedCaseId,
    };

    writeAccountScopedLocalStorage(
      STORAGE_KEY,
      JSON.stringify(currentCase),
      user?.id,
    );
  }, [
    messages,
    engineContext,
    faultCodeContext,
    technicalSpecContext,
    qualityCheck,
    causingPart,
    openedCaseId,
    user,
  ]);

  async function initializeSearchBar() {
    try {
      loadLocalPlanAndUsage();

      const { data, error } = await supabase.auth.getSession();

      if (error) {
        setError(error.message);
        loadCurrentCaseFromLocalStorage(null);
        loadLocalSavedCasesIntoState(null);
        setCaseStorageSource("local");
        setUsageStorageSource("local");
        return;
      }

      const activeUser = data.session?.user ?? null;

      setUser(activeUser);

      if (activeUser) {
        loadCurrentCaseFromLocalStorage(activeUser.id);
        setSavedCases(loadLocalSavedCases(activeUser.id));
        await loadPlanForAuthenticatedUser(activeUser);
        await loadUsageForAuthenticatedUser(activeUser);
        await loadCasesForAuthenticatedUser(activeUser, []);
      } else {
        loadCurrentCaseFromLocalStorage(null);
        loadLocalSavedCasesIntoState(null);
        setCaseStorageSource("local");
        setUsageStorageSource("local");
      }
    } catch (error) {
      console.error("SearchBar konnte nicht initialisiert werden:", error);
      setError(
        "DiagnoseHUB konnte gespeicherte Daten nicht vollständig laden.",
      );
    } finally {
      hasLoadedCaseRef.current = true;
    }
  }

  function loadCurrentCaseFromLocalStorage(userId?: string | null) {
    try {
      const savedCurrentCase = readAccountScopedLocalStorage(
        STORAGE_KEY,
        userId,
      );

      if (!savedCurrentCase) {
        setMessages([]);
        setEngineContext(null);
        setFaultCodeContext(null);
        setTechnicalSpecContext(null);
        setQualityCheck("");
        setCausingPart("");
        setOpenedCaseId(null);
        return;
      }

      const parsedCase = JSON.parse(savedCurrentCase) as CurrentDiagnosisCase;

      setMessages(parsedCase.messages || []);
      setEngineContext(parsedCase.engineContext || null);
      setFaultCodeContext(parsedCase.faultCodeContext || null);
      setTechnicalSpecContext(parsedCase.technicalSpecContext || null);
      setQualityCheck(parsedCase.qualityCheck || "");
      setCausingPart(parsedCase.causingPart || "");
      setOpenedCaseId(parsedCase.openedCaseId || null);
    } catch (error) {
      console.error(
        "Aktueller Diagnosefall konnte nicht geladen werden:",
        error,
      );
    }
  }

  function loadLocalSavedCasesIntoState(userId?: string | null) {
    const localCases = loadLocalSavedCases(userId);

    setSavedCases(localCases);
  }

  function loadLocalPlanAndUsage() {
    try {
      const savedUserPlan = localStorage.getItem(USER_PLAN_STORAGE_KEY);
      const savedDiagnosisUsage = localStorage.getItem(
        DIAGNOSIS_USAGE_STORAGE_KEY,
      );

      if (isValidUserPlan(savedUserPlan)) {
        setUserPlan(savedUserPlan);
      }

      if (savedDiagnosisUsage) {
        const parsedUsage = JSON.parse(savedDiagnosisUsage);
        const normalizedSavedUsage = normalizeDiagnosisUsage({
          date: parsedUsage.date || getInitialDiagnosisUsage().date,
          count: Number(parsedUsage.count) || 0,
        });

        setDiagnosisUsage(normalizedSavedUsage);
        saveUsageToLocalStorage(normalizedSavedUsage);
      }
    } catch (error) {
      console.error("Plan oder Nutzung konnte nicht geladen werden:", error);
    }
  }

  async function loadPlanForAuthenticatedUser(activeUser: User) {
    try {
      const { data, error } = await supabase
        .from("workshop_profiles")
        .select("plan, role")
        .eq("id", activeUser.id)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      const remotePlan =
        data && isValidUserPlan(String(data.plan)) ? data.plan : "free";

      setUserPlan(remotePlan);
      changeAudienceMode(
        inferAudienceModeFromAccountRole(data?.role || "Privatnutzer"),
      );
      localStorage.setItem(USER_PLAN_STORAGE_KEY, remotePlan);
    } catch (error) {
      console.error("Kontoplan konnte nicht geladen werden:", error);
      setError(
        "Kontoplan konnte nicht geladen werden. Lokaler Plan bleibt aktiv.",
      );
      loadLocalPlanAndUsage();
    }
  }

  async function loadUsageForAuthenticatedUser(activeUser: User) {
    setUsageSyncLoading(true);
    setError("");

    try {
      const remoteUsage = await loadDiagnosisUsageFromSupabase(
        supabase,
        activeUser,
      );

      setDiagnosisUsage(remoteUsage);
      saveUsageToLocalStorage(remoteUsage);
      setUsageStorageSource("supabase");
      setUsageSyncMessage("Nutzungszähler wurde geladen.");

      window.setTimeout(() => {
        setUsageSyncMessage("");
      }, 3000);
    } catch (error) {
      console.error("Nutzung konnte nicht geladen werden:", error);
      setUsageStorageSource("local");
      setError(
        "Nutzungszähler konnte nicht geladen werden. Lokaler Zähler bleibt aktiv.",
      );
    } finally {
      setUsageSyncLoading(false);
    }
  }

  async function loadCasesForAuthenticatedUser(
    activeUser: User,
    localCasesForMigration: SavedDiagnosisCase[],
  ) {
    setCaseSyncLoading(true);
    setError("");
    setSavedCases(loadLocalSavedCases(activeUser.id));

    try {
      if (localCasesForMigration.length > 0) {
        await migrateLocalDiagnosisCasesToSupabase(
          supabase,
          activeUser,
          localCasesForMigration,
        );
      }

      const remoteCases = await loadDiagnosisCasesFromSupabase(
        supabase,
        activeUser,
      );

      setSavedCases(remoteCases);
      saveCasesToLocalStorage(remoteCases, activeUser.id);
      setCaseStorageSource("supabase");

      if (localCasesForMigration.length > 0) {
        setCaseSyncMessage("Lokale Fälle wurden synchronisiert.");
      } else {
        setCaseSyncMessage("Fallhistorie wurde geladen.");
      }

      window.setTimeout(() => {
        setCaseSyncMessage("");
      }, 3000);
    } catch (error) {
      console.error(
        "Fallhistorie konnte nicht geladen werden:",
        error,
      );
      setCaseStorageSource("local");
      setError(
        "Fallhistorie konnte nicht geladen werden. Lokale Fälle bleiben verfügbar.",
      );
      loadLocalSavedCasesIntoState(activeUser.id);
    } finally {
      setCaseSyncLoading(false);
    }
  }

  function applyServerUsageLimit(usageLimit: UsageLimitPayload) {
    if (isValidUserPlan(usageLimit.plan)) {
      setUserPlan(usageLimit.plan);
      localStorage.setItem(USER_PLAN_STORAGE_KEY, usageLimit.plan);
    }

    const nextCount =
      typeof usageLimit.countAfter === "number"
        ? usageLimit.countAfter
        : usageLimit.countBefore;

    const nextUsage: DiagnosisUsage = {
      date: usageLimit.todayKey,
      count: nextCount,
    };

    setDiagnosisUsage(nextUsage);
    saveUsageToLocalStorage(nextUsage);
    setUsageStorageSource("supabase");

    if (usageLimit.warning) {
      setUsageSyncMessage(usageLimit.warning);
    } else {
      setUsageSyncMessage(
        `Serverlimit aktiv: ${nextCount} / ${usageLimit.maxDailyDiagnoses} KI-Anfragen diesen Monat.`,
      );
    }

    window.setTimeout(() => {
      setUsageSyncMessage("");
    }, 3000);
  }

  function registerLocalSuccessfulDiagnosis() {
    const usageBeforeRequest = normalizeDiagnosisUsage(diagnosisUsage);

    const nextUsage: DiagnosisUsage = {
      date: usageBeforeRequest.date,
      count: usageBeforeRequest.count + 1,
    };

    setDiagnosisUsage(nextUsage);
    saveUsageToLocalStorage(nextUsage);
    setUsageStorageSource("local");
  }

  async function getAccessTokenForServerLimit() {
    if (!user) {
      return "";
    }

    const { data, error } = await supabase.auth.getSession();

    if (error) {
      console.error("Anmeldung konnte nicht gelesen werden:", error);
      return "";
    }

    return data.session?.access_token || "";
  }

  function isInstructionRequest(value: string) {
    const text = value.toLowerCase();
    const normalizedText = text
      .replaceAll("ue", "ü")
      .replaceAll("oe", "ö")
      .replaceAll("ae", "ä");

    const instructionTerms = [
      "anleitung",
      "arbeitsanweisung",
      "ausbau",
      "ausbauen",
      "einbau",
      "einbauen",
      "notentriegelung",
      "notentriegeln",
      "entriegelung",
      "entriegeln",
      "tausch",
      "tauschen",
      "wechsel",
      "wechseln",
      "ersetzen",
      "erneuern",
      "demontage",
      "demontieren",
      "montage",
      "montieren",
      "freilegen",
      "ausclipsen",
      "abbauen",
      "ausrasten",
      "einstellen",
      "anlernen",
      "adaptieren",
      "grundeinstellung",
      "service zurückstellen",
      "zurückstellen",
      "zurücksetzen",
      "öffnen",
      "verkleidung ab",
      "verkleidung entfernen",
      "reparaturanleitung",
      "schritt für schritt",
      "druckbar",
    ];

    return instructionTerms.some(
      (term) => text.includes(term) || normalizedText.includes(term),
    );
  }

  function buildUnifiedDiagnosisInput(currentInput: string) {
    const cleanInput = currentInput.trim();
    const detectedTechnicalSpecContext = detectTechnicalSpecContext(cleanInput);

    if (isInstructionRequest(cleanInput)) {
      const instructionMode =
        audienceModeRef.current === "hobby"
          ? "verständliche Hobby-Anleitung"
          : "präzise Werkstatt-Anleitung";
      const instructionToneRule =
        audienceModeRef.current === "hobby"
          ? "- In normaler Sprache schreiben und Fachbegriffe kurz erklären."
          : "- Fachlich knapp und entscheidungsorientiert schreiben.";
      const instructionBoundaryRule =
        audienceModeRef.current === "hobby"
          ? "- Am Ende klar sagen, wann der Nutzer nicht weiter selbst arbeiten sollte."
          : "- Am Ende klar sagen, wann Herstellerdaten, Spezialwerkzeug, DSG-Grundeinstellung oder ein Spezialist nötig sind.";
      const instructionFinalHeading =
        audienceModeRef.current === "hobby"
          ? "# Wann in die Werkstatt?"
          : "# Abbruchgrenze / Eskalation";

      return appendTechnicalSpecPrompt(
        `Erstelle direkt im aktuellen Diagnosefall eine ${instructionMode}.

Aktuelle Eingabe:
${cleanInput}

Regeln für diese Anleitung:
${instructionToneRule}
${instructionBoundaryRule}
- Keine allgemeine Diagnose wiederholen, sondern eine konkrete Anleitung aus Eingabe und Fallverlauf erstellen.
- Erst klären, welches Ziel bewiesen oder repariert werden soll.
- Fehlende Fahrzeugdaten nennen, wenn sie die Genauigkeit der Anleitung begrenzen.
- Arbeitsschritte so schreiben, dass ein echter Zugang, eine echte Prüfung oder eine echte Montage daraus möglich wird.
- Nicht pauschal "Zugang schaffen" schreiben, sondern typische Verkleidungen, Abdeckungen, Stecker, Halter, Befestigungen, Lage und Richtung nennen, wenn sinnvoll.
- Messpunkte, Sollzustand und Entscheidung nur nennen, wenn ein Prüfschritt davon abhängt.
- Soll-/Richtwerte bei Anleitungen nicht pauschal nennen. Nur angeben, wenn der Arbeitsschritt ohne diesen Wert fachlich nicht korrekt ausführbar ist.
- Bei DSG-Getriebeölwechsel DQ250 als zwingenden Prozesswert nennen: nach dem Durchschalten der Fahrstufen Öltemperatur für die Ölstandseinstellung auf 35-45 °C bringen und per Diagnosetester überwachen.
- Unsichere oder fahrzeugabhängige Werte klar als fehlende Herstellerdaten kennzeichnen.
- Linksgewinde nennen, wenn möglich oder typisch.
- Schrauben, Exzenter, Einstellpunkte oder Markierungen nennen, die nicht gelöst oder nicht verstellt werden dürfen.
- Daten sichern nur nennen, wenn Steuergerät, Codierung, Programmierung oder Anlernung betroffen ist.
- Batterie abklemmen nur nennen, wenn technisch notwendig.
- Warnhinweise nur dort setzen, wo ein echtes Risiko besteht.

Antwortformat exakt:
# Datenqualität
# Ziel der Anleitung
# Selbst machbar?
# Werkzeug
# Teile / Material
# Vorbereitung
# Zugang
# Arbeitsschritte
# Prüfpunkte / zwingende Prozesswerte
# Risiken
# Abschlussprüfung
${instructionFinalHeading}`,
        detectedTechnicalSpecContext,
        "instruction",
      );
    }

    const inlineFaultCode = getFaultCodeQuickInfo(
      detectFirstFaultCodeInput(cleanInput),
    );
    const diagnosisInput = inlineFaultCode
      ? buildObdQuickStartDiagnosisInput(cleanInput, inlineFaultCode)
      : cleanInput;

    return appendTechnicalSpecPrompt(
      diagnosisInput,
      detectedTechnicalSpecContext,
    );
  }

  async function sendDiagnosis(questionOverride?: string) {
    const currentInput = (questionOverride ?? search).trim();

    if (currentInput === "") {
      alert(
        "Bitte gib zuerst ein Fahrzeug, einen Fehlercode oder ein Symptom ein.",
      );
      return;
    }

    if (loading) {
      return;
    }

    if (!user) {
      setError(
        "Bitte zuerst einloggen. Free-Diagnosen werden serverseitig gezählt, damit die Monatslimits fair bleiben.",
      );
      return;
    }

    const usageBeforeRequest = normalizeDiagnosisUsage(diagnosisUsage);
    const requestPlan = getPlanConfig(userPlan);
    const limitBeforeRequest = requestPlan.dailyDiagnosisLimit;

    if (usageBeforeRequest.count >= limitBeforeRequest) {
      setDiagnosisUsage(usageBeforeRequest);
      saveUsageToLocalStorage(usageBeforeRequest);

      setError(
        `Monatslimit erreicht: Im ${requestPlan.label}-Plan sind aktuell ${limitBeforeRequest} KI-Anfragen pro Monat vorgesehen. Folgefragen zählen mit.`,
      );

      return;
    }

    const diagnosisInput = buildUnifiedDiagnosisInput(currentInput);
    const currentAudienceMode = audienceModeRef.current;

    const userMessage: ChatMessage = {
      role: "user",
      content: currentInput,
      audienceMode: currentAudienceMode,
    };

    const nextMessages = [...messages, userMessage];

    shouldAutoScrollRef.current = true;

    setMessages(nextMessages);
    setSearch("");
    setLoading(true);
    setError("");
    setQualityCheck("");
    setTechnicalSpecContext(null);
    setSaveSuccess(false);
    setCopiedMessageIndex(null);

    try {
      const accessToken = await getAccessTokenForServerLimit();

      const { response, data } =
        await fetchJsonWithTimeout<DiagnosisApiResponse>(
          "/api/diagnose",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              input: diagnosisInput,
              messages,
              accessToken,
              audienceMode: currentAudienceMode,
            }),
          },
          65000
        );

      if (!response.ok) {
        if (data.usageLimit) {
          applyServerUsageLimit(data.usageLimit);
        }

        throw new Error(
          data.error || "Unbekannter Fehler bei der KI-Diagnose.",
        );
      }

      if (!data.result || !data.engineContext) {
        throw new Error(
          "Die API hat keine vollständige Diagnose zurückgegeben.",
        );
      }

      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: data.result,
        audienceMode: currentAudienceMode,
      };

      setMessages([...nextMessages, assistantMessage]);
      setEngineContext(data.engineContext);
      setFaultCodeContext(data.faultCodeContext || null);
      setTechnicalSpecContext(data.technicalSpecContext || null);
      setQualityCheck(data.qualityCheck || "");

      if (data.usageLimit?.enabled) {
        applyServerUsageLimit(data.usageLimit);
      } else {
        registerLocalSuccessfulDiagnosis();
      }
    } catch (error) {
      setError(getFriendlyDiagnosisError(error));
      shouldAutoScrollRef.current = false;
    } finally {
      setLoading(false);
    }
  }

  function resetDiagnosis() {
    setSearch("");
    setCausingPart("");
    setMessages([]);
    setEngineContext(null);
    setFaultCodeContext(null);
    setTechnicalSpecContext(null);
    setQualityCheck("");
    setSaveSuccess(false);
    setCopiedMessageIndex(null);
    setOpenedCaseId(null);
    setSaveDetailsOpen(false);
    setError("");
    shouldAutoScrollRef.current = false;
    removeAccountScopedLocalStorage(STORAGE_KEY, user?.id);
  }

  function openSaveDetails() {
    if (messages.length === 0 || savedCaseLimitReached) {
      return;
    }

    setSaveDetailsOpen(true);
    setSaveSuccess(false);
    setCopiedMessageIndex(null);
    setError("");
  }

  async function saveCurrentCase() {
    if (messages.length === 0) {
      return;
    }

    if (savingDisabledForPlan) {
      setError(
        `Speichern ist im ${currentPlan.label}-Plan nicht enthalten. Für gespeicherte Fälle brauchst du Pro.`,
      );
      setSaveSuccess(false);
      setCopiedMessageIndex(null);
      return;
    }

    if (savedCaseLimitReached) {
      setError(
        `Falllimit erreicht: Im ${currentPlan.label}-Plan können aktuell ${currentPlan.savedCaseLimit} Fälle gespeichert werden.`,
      );
      setSaveSuccess(false);
      setCopiedMessageIndex(null);
      return;
    }

    const now = new Date().toISOString();

    const existingCase = savedCases.find(
      (savedCase) => savedCase.id === openedCaseId,
    );

    const caseToSave: SavedDiagnosisCase = {
      id: openedCaseId ?? crypto.randomUUID(),
      title: getCaseTitle(messages),
      createdAt: existingCase?.createdAt ?? now,
      updatedAt: now,
      messages,
      engineContext,
      faultCodeContext,
      qualityCheck,
    };

    let persistedCase = caseToSave;

    if (user) {
      setCaseSyncLoading(true);

      try {
        persistedCase = await saveDiagnosisCaseToSupabase(
          supabase,
          user,
          caseToSave,
        );
        setCaseStorageSource("supabase");
        setCaseSyncMessage("Fall wurde gespeichert.");
      } catch (error) {
        console.error(
          "Fall konnte nicht gespeichert werden:",
          error,
        );
        setError(
          "Fall konnte nicht gespeichert werden. Speichern wurde abgebrochen.",
        );
        setCaseSyncLoading(false);
        return;
      } finally {
        setCaseSyncLoading(false);
      }
    }

    const updatedSavedCases = [
      persistedCase,
      ...savedCases.filter((savedCase) => savedCase.id !== persistedCase.id),
    ].slice(0, currentPlan.savedCaseLimit);

    setSavedCases(updatedSavedCases);
    setOpenedCaseId(persistedCase.id);
    saveCasesToLocalStorage(updatedSavedCases, user?.id);

    setSaveSuccess(true);
    setSaveDetailsOpen(false);
    setCopiedMessageIndex(null);
    setError("");

    window.setTimeout(() => {
      setSaveSuccess(false);
      setCaseSyncMessage("");
    }, 2500);
  }

  function openSavedCase(savedCase: SavedDiagnosisCase) {
    shouldAutoScrollRef.current = false;

    setMessages(savedCase.messages);
    setEngineContext(savedCase.engineContext);
    setFaultCodeContext(savedCase.faultCodeContext);
    setTechnicalSpecContext(
      detectTechnicalSpecContext(
        savedCase.messages.map((message) => message.content).join("\n"),
      ),
    );
    setQualityCheck(savedCase.qualityCheck);
    setOpenedCaseId(savedCase.id);
    setSearch("");
    setSaveDetailsOpen(false);
    setError("");
    setSaveSuccess(false);
    setCopiedMessageIndex(null);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function deleteSavedCase(caseId: string) {
    if (user) {
      setCaseSyncLoading(true);

      try {
        await deleteDiagnosisCaseFromSupabase(supabase, user, caseId);
        setCaseSyncMessage("Fall wurde gelöscht.");
      } catch (error) {
        console.error("Fall konnte nicht gelöscht werden:", error);
        setError(
          "Fall konnte nicht gelöscht werden. Löschen wurde abgebrochen.",
        );
        setCaseSyncLoading(false);
        return;
      } finally {
        setCaseSyncLoading(false);
      }
    }

    const updatedSavedCases = savedCases.filter(
      (savedCase) => savedCase.id !== caseId,
    );

    setSavedCases(updatedSavedCases);
    saveCasesToLocalStorage(updatedSavedCases, user?.id);

    if (openedCaseId === caseId) {
      setOpenedCaseId(null);
    }

    setError("");

    window.setTimeout(() => {
      setCaseSyncMessage("");
    }, 2500);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendDiagnosis();
    }
  }

  function buildFaultCodeReport() {
    if (!faultCodeContext || faultCodeContext.foundCodes.length === 0) {
      return "Keine bekannten Fehlercodes erkannt.";
    }

    return faultCodeContext.foundCodes
      .map((faultCode) => {
        return `${faultCode.code} - ${faultCode.title}
System: ${faultCode.system}
Beschreibung: ${faultCode.description}

Typische Ursachen:
${faultCode.typicalCauses.map((cause) => `- ${cause}`).join("\n")}

Empfohlene Prüfungen:
${faultCode.suggestedChecks.map((check) => `- ${check}`).join("\n")}`;
      })
      .join("\n\n---\n\n");
  }

  function buildTechnicalSpecReport() {
    const detectedContext =
      technicalSpecContext ||
      detectTechnicalSpecContext(
        messages.map((message) => message.content).join("\n"),
      );

    if (detectedContext.foundSpecs.length === 0) {
      return "Keine Soll-/Richtwerte erkannt.";
    }

    return formatTechnicalSpecContext(detectedContext);
  }

  function buildCaseReport() {
    const createdAt = new Date().toLocaleString("de-DE");

    const motorInfo = engineContext
      ? [
          `Motortyp: ${engineContext.engineType}`,
          `Erkennung: ${engineContext.source}`,
          `Motorcode: ${engineContext.code ?? "nicht erkannt"}`,
          `Motor: ${engineContext.label}`,
          engineContext.notes ? `Hinweis: ${engineContext.notes}` : "",
        ]
          .filter(Boolean)
          .join("\n")
      : "Motorkontext: nicht erkannt";

    const causingPartText = causingPart.trim()
      ? `Schadensverursachendes Teil:\n${causingPart.trim()}`
      : "Schadensverursachendes Teil:\nüber Eingabe/Fallverlauf";

    const chatText = messages
      .map((message) => {
        const sender =
          message.role === "user"
            ? getUserMessageLabel(message.audienceMode ?? audienceMode)
            : "DiagnoseHUB";
        return `${sender}:\n${message.content}`;
      })
      .join("\n\n---\n\n");

    return `DiagnoseHUB Fallbericht
=========================

Erstellt am:
${createdAt}

Ausgabemodus:
${audienceMode === "workshop" ? "Werkstatt-Modus" : "Hobby-Modus"}

Motorkontext:
${motorInfo}

${causingPartText}

Fehlercode-Kontext:
${buildFaultCodeReport()}

Soll-/Richtwerte:
${buildTechnicalSpecReport()}

Qualitätsprüfung:
${qualityCheck || "Keine Qualitätsprüfung vorhanden."}

Diagnoseverlauf:
${chatText}
`;
  }

  async function copySingleMessage(content: string, index: number) {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageIndex(index);
      setSaveSuccess(false);
      setError("");

      window.setTimeout(() => {
        setCopiedMessageIndex(null);
      }, 2500);
    } catch (error) {
      console.error(error);
      setError("Antwort konnte nicht in die Zwischenablage kopiert werden.");
    }
  }

  return (
    <div className="w-full">
      <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-4 shadow-2xl shadow-blue-950/30">
        {!user && (
          <div className="mb-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-black uppercase tracking-wide text-blue-300">
                  Ausgabemodus
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  Gleicher Inhalt, aber Sprache, Risiko und Detailtiefe passen
                  sich an.
                </p>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[32rem]">
                {audienceModeOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => changeAudienceMode(option.value)}
                    className={
                      audienceMode === option.value
                        ? "rounded-2xl border border-blue-500 bg-blue-600 px-4 py-3 text-left text-white shadow-lg shadow-blue-950/30"
                        : "rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-left text-slate-300 transition hover:border-blue-500 hover:text-blue-200"
                    }
                  >
                    <span className="block text-sm font-black">
                      {option.label}
                    </span>
                    <span className="mt-1 block text-xs leading-5 opacity-85">
                      {option.description}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <p className="mb-3 text-sm leading-6 text-slate-400">
          Je mehr Fahrzeugdaten du eingibst, desto genauer wird die Antwort:
          Modell, Baujahr, Motorcode, Kilometerstand, Fehlercode, Symptome,
          Messwerte und was bereits geprüft wurde.
        </p>

        <textarea
          id="diagnosehub-main-diagnosis-input"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            messages.length === 0
              ? "Diagnose oder Anleitung eingeben, z. B. VW Passat P0299 Leistungsverlust oder Qashqai Gebläsemotor ausbauen..."
              : "Folgefrage, Messwertfrage oder Anleitung eingeben, z. B. Ladedruck Sollwert? oder Ausbauanleitung AGR-Ventil..."
          }
          rows={4}
          className="w-full resize-none rounded-2xl border border-slate-800 bg-slate-950 p-5 text-white outline-none placeholder:text-slate-400 focus:border-blue-500"
        />

        <VoiceAssistant
          placement="inline"
          targetElementId="diagnosehub-main-diagnosis-input"
          targetLabel="Diagnosefeld"
        />

        {search.trim() ? (
          <InputQualityPreview profile={typedInputQualityProfile} />
        ) : null}

        {typedTechnicalSpecContext.foundSpecs.length > 0 ? (
          <div className="mt-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-50">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-emerald-200">
                  Soll-/Richtwerte erkannt
                </p>
                <h3 className="mt-1 text-lg font-black text-white">
                  {typedTechnicalSpecContext.foundSpecs
                    .map((spec) => spec.title)
                    .join(", ")}
                </h3>
                <p className="mt-2 max-w-3xl leading-6 text-emerald-100">
                  Die Werte werden beim Absenden automatisch als generischer
                  Richtwert-Kontext mitgegeben. Exakte Herstellerdaten bleiben
                  fahrzeugabhängig.
                </p>
              </div>
              <span className="rounded-full border border-emerald-400/40 bg-emerald-950/40 px-3 py-1 text-xs font-black text-emerald-100">
                Sollwerte
              </span>
            </div>

            <div className="mt-4 space-y-4">
              {typedTechnicalSpecContext.foundSpecs.map((spec) => (
                <div
                  key={spec.id}
                  className="rounded-2xl border border-emerald-400/20 bg-emerald-950/20 p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-black text-white">
                      {spec.category}
                    </span>
                    <h4 className="text-base font-black text-white">
                      {spec.title}
                    </h4>
                  </div>

                  <p className="mt-2 leading-6 text-emerald-100">
                    {spec.summary}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-emerald-200">
                    {spec.applicability}
                  </p>

                  <div className="mt-3 grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
                    <TechnicalSpecValueList spec={spec} />
                    <div className="grid gap-3">
                      <TechnicalSpecBulletList
                        title="Prüfen"
                        items={spec.checks.slice(0, 4)}
                      />
                      <TechnicalSpecBulletList
                        title="Wenn Wert abweicht"
                        items={spec.deviations.slice(0, 3)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {typedFaultCodeValue ? (
          typedFaultCodeInfo ? (
            <div className="mt-3 rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4 text-sm text-blue-50">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-blue-200">
                    Fehlercode erkannt
                  </p>
                  <h3 className="mt-1 text-lg font-black text-white">
                    {typedFaultCodeInfo.code}: {typedFaultCodeInfo.title}
                  </h3>
                  <p className="mt-2 max-w-3xl leading-6 text-blue-100">
                    {typedFaultCodeInfo.description}
                  </p>
                </div>
                <span className="rounded-full border border-blue-400/40 bg-blue-950/40 px-3 py-1 text-xs font-black text-blue-100">
                  {typedFaultCodeInfo.system}
                </span>
              </div>

              <p className="mt-3 text-sm leading-6 text-blue-100">
                Dieser Fehlercode wird beim Absenden automatisch als
                Diagnose-Kontext mitgegeben. Du musst nichts in ein zweites
                Feld kopieren.
              </p>

              <div
                className={`mt-3 rounded-xl border p-3 text-sm leading-6 ${getFaultCodeRiskClass(
                  typedFaultCodeInfo.riskLevel,
                )}`}
              >
                <span className="font-black uppercase">
                  Risiko {typedFaultCodeInfo.riskLevel}
                </span>
                <span className="ml-2">{typedFaultCodeInfo.riskNote}</span>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <ObdQuickInfoList
                  title="Symptome"
                  items={typedFaultCodeInfo.symptomHints.slice(0, 4)}
                />
                <ObdQuickInfoList
                  title="Ursachen"
                  items={typedFaultCodeInfo.typicalCauses.slice(0, 5)}
                />
                <ObdQuickInfoList
                  title="Prüfplan"
                  items={typedFaultCodeInfo.suggestedChecks.slice(0, 5)}
                />
                <ObdQuickInfoList
                  title="Nächste Schritte"
                  items={typedFaultCodeInfo.nextSteps.slice(0, 5)}
                />
              </div>
            </div>
          ) : (
            <div className="mt-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
              <span className="font-black">{typedFaultCodeValue}</span> erkannt.
              Der Code ist noch nicht in der Fehlercode-Liste, wird aber
              mit dem normalen Diagnosefall mitgesendet.
            </div>
          )
        ) : null}

        {saveDetailsOpen && (
          <div className="mt-4 rounded-2xl border border-green-500/30 bg-green-500/10 p-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-black uppercase tracking-wide text-green-300">
                  Fall speichern
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-300">
                  Interne Notiz und Schadensursache werden nur beim Speichern
                  gepflegt.
                </p>
              </div>
            </div>

            <label className="mt-3 grid gap-2">
              <span className="text-xs font-black uppercase tracking-wide text-slate-400">
                Interne Notiz / Schadensursache
              </span>
              <input
                value={causingPart}
                onChange={(event) => setCausingPart(event.target.value)}
                placeholder="z. B. Ladeluftschlauch gerissen, AGR klemmt, noch offen"
                className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-blue-500"
              />
            </label>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void saveCurrentCase()}
                disabled={messages.length === 0 || savedCaseLimitReached}
                className="rounded-xl bg-green-600 px-4 py-2 text-sm font-black text-white transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Jetzt speichern
              </button>
              <button
                type="button"
                onClick={() => setSaveDetailsOpen(false)}
                className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-bold text-slate-300 transition hover:bg-slate-800"
              >
                Abbrechen
              </button>
            </div>
          </div>
        )}

        {!user && (
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-400">
          <span className="rounded-full border border-slate-800 bg-slate-950/70 px-3 py-1.5">
            Ein Feld für alles
          </span>
          <span className="rounded-full border border-slate-800 bg-slate-950/70 px-3 py-1.5">
            Diagnose
          </span>
          <span className="rounded-full border border-slate-800 bg-slate-950/70 px-3 py-1.5">
            Anleitung
          </span>
          <span className="rounded-full border border-slate-800 bg-slate-950/70 px-3 py-1.5">
            Folgefrage
          </span>
          <span className="rounded-full border border-slate-800 bg-slate-950/70 px-3 py-1.5">
            Messwerte
          </span>
          <span className="rounded-full border border-slate-800 bg-slate-950/70 px-3 py-1.5">
            Sollwerte
          </span>
        </div>
        )}

        {!user && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4">
            <p className="text-sm font-semibold leading-6 text-blue-100">
              Zum Starten bitte einloggen. Konto, Plan und Nutzung verwaltest
              du im Accountbereich.
            </p>
            <a
              href="/login"
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white transition hover:bg-blue-500"
            >
              Login öffnen
            </a>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-semibold text-red-300">
            {error}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void sendDiagnosis()}
            disabled={loading || diagnosisLimitReached || !user}
            className="rounded-xl bg-blue-600 px-6 py-3 font-bold text-white shadow-lg shadow-blue-950/30 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? "DiagnoseHUB arbeitet..."
              : !user
                ? "Login erforderlich"
              : diagnosisLimitReached
                ? "Monatslimit erreicht"
                : search.trim() && isInstructionRequest(search)
                  ? "Anleitung erstellen"
                  : typedFaultCodeInfo
                    ? "OBD-Diagnose starten"
                    : typedTechnicalSpecContext.foundSpecs.length > 0
                      ? "Diagnose mit Sollwerten starten"
                      : messages.length === 0
                        ? "Diagnose starten"
                        : "Senden"}
          </button>

          <button
            type="button"
            onClick={resetDiagnosis}
            className="rounded-xl border border-slate-700 px-5 py-3 font-bold text-slate-300 transition hover:bg-slate-800"
          >
            Neuer Fall
          </button>

          <button
            type="button"
            onClick={openSaveDetails}
            disabled={messages.length === 0 || savedCaseLimitReached}
            className="rounded-xl border border-green-500/40 px-5 py-3 font-bold text-green-300 transition hover:bg-green-500 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {savingDisabledForPlan
              ? "Speichern ab Pro"
              : saveDetailsOpen
                ? "Speicherbereich offen"
                : "Fall speichern"}
          </button>

        </div>

        {saveSuccess && (
          <div className="mt-4 rounded-2xl border border-green-500/30 bg-green-500/10 p-4 text-sm font-semibold text-green-300">
            Fall wurde gespeichert.
          </div>
        )}
      </div>

      {loading && (
        <div
          ref={loadingMessageRef}
          className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
        >
          <p className="font-black text-slate-950 dark:text-slate-100">
            DiagnoseHUB analysiert den Fall...
          </p>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Fehlercode, Motorkontext und bisherigen Verlauf werden verarbeitet.
          </p>
        </div>
      )}

      {messages.length > 0 && (
        <div className="mt-6 space-y-5">
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              ref={
                index === latestAssistantMessageIndex
                  ? latestAssistantMessageRef
                  : null
              }
              data-diagnosehub-read-aloud={
                message.role === "assistant" ? "answer" : undefined
              }
              className={
                message.role === "user"
                  ? "rounded-3xl border border-slate-200 bg-slate-50 p-6 text-slate-950 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                  : "rounded-3xl border border-slate-200 bg-white p-6 text-slate-950 shadow-sm dark:border-slate-800 dark:bg-slate-900/90 dark:text-slate-100"
              }
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <p
                  className={
                    message.role === "user"
                      ? "text-sm font-black uppercase tracking-wide text-slate-500 dark:text-slate-400"
                      : "text-sm font-black uppercase tracking-wide text-slate-600 dark:text-slate-400"
                  }
                >
                  {message.role === "user"
                    ? getUserMessageLabel(message.audienceMode ?? audienceMode)
                    : "DiagnoseHUB"}
                </p>

                {message.role === "assistant" && (
                  <button
                    type="button"
                    onClick={() =>
                      void copySingleMessage(message.content, index)
                    }
                    className="rounded-xl border border-slate-700 px-3 py-1.5 text-xs font-bold text-slate-300 transition hover:bg-slate-800"
                  >
                    {copiedMessageIndex === index
                      ? "Kopiert"
                      : "Antwort kopieren"}
                  </button>
                )}
              </div>

              {message.role === "assistant" ? (
                <AssistantAnswer
                  content={message.content}
                  audienceMode={message.audienceMode ?? audienceMode}
                />
              ) : (
                <div className="whitespace-pre-wrap leading-8">
                  {message.content}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {messages.length > 0 && (
        <div className="mt-5">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              Schnellfragen
            </p>

            <ProtocolPrintButton
              source="diagnosis"
              label="PDF-Prüfprotokoll"
              className="inline-flex w-fit rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-800 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            {quickQuestions.map((question) => (
              <button
                key={question}
                type="button"
                onClick={() => void sendDiagnosis(question)}
                disabled={loading || diagnosisLimitReached || !user}
                className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-blue-500 hover:text-blue-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      )}

      {messages.length > 0 && (
        <CaseFeedbackPanel
          caseTitle={getCaseTitle(messages)}
          caseContext={buildCaseReport()}
        />
      )}

      {messages.length > 0 && (
        <RelatedLearningPanel
          faultCodes={
            faultCodeContext?.foundCodes.map((faultCode) => faultCode.code) ??
            []
          }
          parts={causingPart.trim() ? [causingPart.trim()] : []}
          systems={[
            engineContext?.engineType ?? "",
            ...(faultCodeContext?.foundCodes.map(
              (faultCode) => faultCode.system,
            ) ?? []),
            ...(activeTechnicalSpecContext?.foundSpecs.map(
              (spec) => spec.category,
            ) ?? []),
          ].filter(Boolean)}
        />
      )}

      {(engineContext ||
        (faultCodeContext && faultCodeContext.foundCodes.length > 0) ||
        hasTechnicalSpecContext ||
        qualityCheck) && (
        <div className="mt-6 rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-blue-300">
                Technische Zusatzinfos
              </p>

              <p className="mt-1 text-sm text-slate-400">
                Motorkontext, Fehlercodes, Sollwerte und Qualitätsprüfung bei
                Bedarf öffnen.
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {engineContext && (
              <details className="group rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-black text-slate-100">
                      Erkannter Motorkontext
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      {engineContext.engineType} ·{" "}
                      {engineContext.code ?? "Motorcode nicht erkannt"}
                    </p>
                  </div>

                  <span className="rounded-xl border border-slate-700 px-3 py-1 text-xs font-bold text-slate-400 transition group-open:bg-slate-800 group-open:text-slate-200">
                    Öffnen
                  </span>
                </summary>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl bg-slate-900/80 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-400">
                      Motortyp
                    </p>
                    <p className="mt-1 font-bold text-white">
                      {engineContext.engineType}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-slate-900/80 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-400">
                      Motor
                    </p>
                    <p className="mt-1 font-bold text-white">
                      {engineContext.label}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-slate-900/80 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-400">
                      Motorcode
                    </p>
                    <p className="mt-1 font-bold text-white">
                      {engineContext.code ?? "nicht erkannt"}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-slate-900/80 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-400">
                      Erkennung
                    </p>
                    <p className="mt-1 font-bold text-white">
                      {engineContext.source}
                    </p>
                  </div>
                </div>

                {engineContext.notes && (
                  <p className="mt-4 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm leading-6 text-yellow-100">
                    {engineContext.notes}
                  </p>
                )}
              </details>
            )}

            {faultCodeContext && faultCodeContext.foundCodes.length > 0 && (
              <details className="group rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-black text-slate-100">
                      Erkannte Fehlercodes
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      {faultCodeContext.foundCodes.length} erkannte Codes
                    </p>
                  </div>

                  <span className="rounded-xl border border-slate-700 px-3 py-1 text-xs font-bold text-slate-400 transition group-open:bg-slate-800 group-open:text-slate-200">
                    Öffnen
                  </span>
                </summary>

                <div className="mt-4 grid gap-4">
                  {faultCodeContext.foundCodes.map((faultCode) => (
                    <div
                      key={faultCode.code}
                      className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5"
                    >
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="rounded-full bg-blue-600 px-3 py-1 text-sm font-black text-white">
                          {faultCode.code}
                        </span>

                        <h3 className="text-lg font-black text-white">
                          {faultCode.title}
                        </h3>
                      </div>

                      <p className="mt-2 text-sm font-semibold text-slate-400">
                        {faultCode.system}
                      </p>

                      <p className="mt-3 leading-7 text-slate-300">
                        {faultCode.description}
                      </p>
                    </div>
                  ))}
                </div>
              </details>
            )}

            {hasTechnicalSpecContext && activeTechnicalSpecContext && (
              <details className="group rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-black text-slate-100">
                      Erkannte Soll-/Richtwerte
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      {activeTechnicalSpecContext.foundSpecs.length} erkannte
                      Datensätze
                    </p>
                  </div>

                  <span className="rounded-xl border border-slate-700 px-3 py-1 text-xs font-bold text-slate-400 transition group-open:bg-slate-800 group-open:text-slate-200">
                    Öffnen
                  </span>
                </summary>

                <div className="mt-4 grid gap-4">
                  {activeTechnicalSpecContext.foundSpecs.map((spec) => (
                    <div
                      key={spec.id}
                      className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5"
                    >
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="rounded-full bg-emerald-600 px-3 py-1 text-sm font-black text-white">
                          {spec.category}
                        </span>
                        <h3 className="text-lg font-black text-white">
                          {spec.title}
                        </h3>
                      </div>

                      <p className="mt-3 leading-7 text-slate-300">
                        {spec.summary}
                      </p>

                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <TechnicalSpecValueList spec={spec} />
                        <TechnicalSpecBulletList
                          title="Prüfhinweise"
                          items={spec.checks.slice(0, 5)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            )}

            {qualityCheck && (
              <details className="group rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-black text-slate-100">
                      Qualitätsprüfung
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      Technische Plausibilitätskontrolle der Antwort
                    </p>
                  </div>

                  <span className="rounded-xl border border-slate-700 px-3 py-1 text-xs font-bold text-slate-400 transition group-open:bg-slate-800 group-open:text-slate-200">
                    Öffnen
                  </span>
                </summary>

                <p className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-4 text-sm leading-6 text-slate-300">
                  {qualityCheck}
                </p>
              </details>
            )}
          </div>
        </div>
      )}

      {savedCases.length > 0 && (
        <div className="mt-8 rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-blue-300">
                Fallhistorie
              </p>

              <h2 className="mt-1 text-2xl font-black text-white">
                Gespeicherte Fälle
              </h2>
            </div>

            <p className="text-sm text-slate-400">
              {savingDisabledForPlan
                ? "Speichern erst ab Pro"
                : `${savedCases.length} / ${savedCaseLimitLabel}`}
            </p>
          </div>

          <div className="mt-5 grid gap-3">
            {savedCases.map((savedCase) => (
              <div
                key={savedCase.id}
                className="rounded-2xl border border-slate-800 bg-slate-950 p-4"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-bold text-white">{savedCase.title}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      Aktualisiert: {formatDateTime(savedCase.updatedAt)}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openSavedCase(savedCase)}
                      className="rounded-xl border border-blue-500/40 px-4 py-2 text-sm font-bold text-blue-300 transition hover:bg-blue-500 hover:text-white"
                    >
                      Öffnen
                    </button>

                    <button
                      type="button"
                      onClick={() => void deleteSavedCase(savedCase.id)}
                      className="rounded-xl border border-red-500/40 px-4 py-2 text-sm font-bold text-red-300 transition hover:bg-red-500 hover:text-white"
                    >
                      Löschen
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
