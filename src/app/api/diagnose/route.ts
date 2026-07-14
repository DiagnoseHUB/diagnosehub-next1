import OpenAI from "openai";
import { NextResponse } from "next/server";
import {
  createClient as createSupabaseClient,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";
import {
  detectEngineContext,
  type EngineContext,
  type EngineType,
} from "../../../services/engineDatabase";
import {
  detectFaultCodeContext,
  formatFaultCodeContext,
  type FaultCodeContext,
} from "../../../services/faultCodeDatabase";
import {
  detectTechnicalSpecContext,
  formatTechnicalSpecContext,
  type TechnicalSpecContext,
} from "../../../services/technicalSpecs";
import {
  detectTorqueSpecContext,
  formatTorqueSpecTitle,
  formatTorqueSpecContext,
  formatTorqueValue,
  hasTorqueSpecIntent,
  toTorqueSpec,
  type TorqueSpecContext,
  type TorqueSpecRow,
} from "@/services/torqueSpecs";
import {
  PLAN_DAILY_LIMITS,
  PLAN_LABELS,
  isValidUserPlan,
  type UserPlan,
} from "@/config/plans";
import { findSimilarDiagnosisLibraryEntry } from "@/lib/supabase/diagnosisLibraryStorage";
import {
  detectSignalLibraryContext,
  formatSignalLibraryContextForPrompt,
} from "@/services/signalLibrary";
import {
  formatDiagnosisCorrectionsForPrompt,
  loadApprovedDiagnosisCorrections,
  type ApprovedDiagnosisCorrection,
} from "@/services/diagnosisCorrections";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const FALLBACK_DIAGNOSIS_MODEL = "gpt-4o-mini";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type DiagnosisAudienceMode = "workshop" | "hobby";
type DiagnosisRequestIntent = "diagnosis" | "instruction";

type WorkshopProfileDatabaseRow = {
  id: string;
  full_name: string;
  workshop_name: string;
  email: string;
  role: string;
  plan: UserPlan;
  created_at: string;
  updated_at: string;
};

type DiagnosisUsageDatabaseRow = {
  id: string;
  user_id: string;
  usage_date: string;
  diagnosis_count: number;
  created_at: string;
  updated_at: string;
};

type UsageControl = {
  enabled: boolean;
  source: "supabase";
  supabase: SupabaseClient;
  user: User;
  plan: UserPlan;
  planLabel: string;
  todayKey: string;
  countBefore: number;
  maxDailyDiagnoses: number;
};

type UsageLimitPayload = {
  enabled: boolean;
  source: "supabase";
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

type DiagnosisInputQualityProfile = {
  score: number;
  level: "niedrig" | "mittel" | "hoch" | "sehr hoch";
  found: string[];
  missing: string[];
  nextBestQuestions: string[];
  hasVehicleIdentity: boolean;
  hasFaultCode: boolean;
  hasSymptom: boolean;
  hasOperatingCondition: boolean;
  hasMeasurements: boolean;
  hasPreviousChecks: boolean;
};

function getTodayKeyGermany() {
  const currentDateGermany = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const currentMonth = currentDateGermany.slice(0, 7);

  return `${currentMonth}-01`;
}

function sanitizeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function normalizeTechnicalSearchText(value: string) {
  return value
    .toLowerCase()
    .replace(/\u00e4/g, "ae")
    .replace(/\u00f6/g, "oe")
    .replace(/\u00fc/g, "ue")
    .replace(/\u00df/g, "ss");
}

function includesAnyNormalized(text: string, terms: string[]) {
  const normalizedText = normalizeTechnicalSearchText(text);

  return terms.some((term) =>
    normalizedText.includes(normalizeTechnicalSearchText(term))
  );
}

function hasMeasurementContext(text: string) {
  return (
    /\b\d+([,.]\d+)?\s?(v|volt|a|ampere|ohm|kpa|bar|mbar|psi|grad|°c|celsius|rpm|u\/min|g\/s|mg\/hub|%|hz)\b/i.test(
      text
    ) ||
    includesAnyNormalized(text, [
      "live daten",
      "livedaten",
      "messwert",
      "messwerte",
      "soll ist",
      "istwert",
      "spannung",
      "widerstand",
      "druck",
      "temperatur",
      "raildruck",
      "ladedruck",
      "luftmasse",
      "fuel trim",
      "lambda",
      "differenzdruck",
    ])
  );
}

function hasVehicleIdentityContext(text: string) {
  return (
    includesAnyNormalized(text, [
      "audi",
      "bmw",
      "mercedes",
      "vw",
      "volkswagen",
      "skoda",
      "seat",
      "cupra",
      "opel",
      "ford",
      "renault",
      "peugeot",
      "citroen",
      "toyota",
      "nissan",
      "hyundai",
      "kia",
      "mazda",
      "fiat",
      "volvo",
      "porsche",
      "tesla",
      "golf",
      "passat",
      "a3",
      "a4",
      "a6",
      "octavia",
      "qashqai",
      "focus",
      "astra",
      "corsa",
      "sprinter",
    ]) ||
    /\b(19|20)\d{2}\b/.test(text) ||
    /\b(mkb|motorcode|motorkennbuchstabe|vin|fahrgestellnummer)\b/i.test(text)
  );
}

function hasSymptomContext(text: string) {
  return (
    text.trim().length >= 30 ||
    includesAnyNormalized(text, [
      "ruckelt",
      "springt nicht an",
      "geht aus",
      "leistungsverlust",
      "notlauf",
      "warnlampe",
      "motorkontrollleuchte",
      "geräusch",
      "vibration",
      "qualmt",
      "rauch",
      "stinkt",
      "undicht",
      "zieht nicht",
      "startet schlecht",
      "kaltstart",
      "heißstart",
      "sporadisch",
    ])
  );
}

function hasOperatingConditionContext(text: string) {
  return includesAnyNormalized(text, [
    "kalt",
    "warm",
    "heiß",
    "leerlauf",
    "teillast",
    "vollast",
    "beim starten",
    "beim beschleunigen",
    "beim bremsen",
    "unter last",
    "nach regen",
    "sporadisch",
    "dauerhaft",
    "nur morgens",
    "nur warm",
    "nur kalt",
    "autobahn",
    "stadtverkehr",
    "nach reparatur",
  ]);
}

function hasPreviousChecksContext(text: string) {
  return includesAnyNormalized(text, [
    "geprüft",
    "prüft",
    "gemessen",
    "getauscht",
    "erneuert",
    "ersetzt",
    "gereinigt",
    "abgedrückt",
    "abgenebelt",
    "ausgelesen",
    "fehler gelöscht",
    "stellgliedtest",
    "sichtprüfung",
  ]);
}

function buildDiagnosisInputQualityProfile(
  input: string,
  messages: ChatMessage[]
): DiagnosisInputQualityProfile {
  const combinedText = `${formatHistory(messages)}\n${input}`;
  const hasVehicleIdentity = hasVehicleIdentityContext(combinedText);
  const hasFaultCode = /\b[PCBU][0-3][0-9A-F]{3}\b/i.test(combinedText);
  const hasSymptom = hasSymptomContext(combinedText);
  const hasOperatingCondition = hasOperatingConditionContext(combinedText);
  const hasMeasurements = hasMeasurementContext(combinedText);
  const hasPreviousChecks = hasPreviousChecksContext(combinedText);

  const checks = [
    {
      ok: hasVehicleIdentity,
      found: "Fahrzeugdaten vorhanden",
      missing: "Fahrzeug: Hersteller, Modell, Baujahr, Motorcode",
      question: "Welches Fahrzeug genau? Hersteller, Modell, Baujahr, Motorcode?",
      points: 20,
    },
    {
      ok: hasFaultCode,
      found: "Fehlercode vorhanden",
      missing: "Fehlercode oder Testertext",
      question: "Welche Fehlercodes mit vollständigem Testertext sind gespeichert?",
      points: 16,
    },
    {
      ok: hasSymptom,
      found: "Symptom beschrieben",
      missing: "konkretes Symptom",
      question: "Was passiert genau und wie äußert sich der Fehler?",
      points: 18,
    },
    {
      ok: hasOperatingCondition,
      found: "Betriebszustand beschrieben",
      missing: "Betriebszustand: kalt/warm, Last, Drehzahl, Fahrzustand",
      question: "Tritt der Fehler kalt, warm, im Leerlauf, unter Last oder sporadisch auf?",
      points: 14,
    },
    {
      ok: hasMeasurements,
      found: "Messwerte oder Live-Daten vorhanden",
      missing: "Messwerte oder Live-Daten",
      question: "Welche Istwerte liegen vor: Spannung, Druck, Temperatur, Soll/Ist, Live-Daten?",
      points: 18,
    },
    {
      ok: hasPreviousChecks,
      found: "bisherige Prüfungen vorhanden",
      missing: "bereits geprüfte oder getauschte Teile",
      question: "Was wurde bereits geprüft, gemessen, gereinigt oder ersetzt?",
      points: 14,
    },
  ];

  const score = checks.reduce((sum, check) => sum + (check.ok ? check.points : 0), 0);
  const level =
    score >= 86 ? "sehr hoch" : score >= 66 ? "hoch" : score >= 38 ? "mittel" : "niedrig";

  return {
    score,
    level,
    found: checks.filter((check) => check.ok).map((check) => check.found),
    missing: checks.filter((check) => !check.ok).map((check) => check.missing),
    nextBestQuestions: checks
      .filter((check) => !check.ok)
      .map((check) => check.question)
      .slice(0, 4),
    hasVehicleIdentity,
    hasFaultCode,
    hasSymptom,
    hasOperatingCondition,
    hasMeasurements,
    hasPreviousChecks,
  };
}

function formatInputQualityPrompt(profile: DiagnosisInputQualityProfile) {
  return `Diagnose-Datenqualität:
- Genauigkeit: ${profile.score}/100 (${profile.level})
- Vorhanden: ${profile.found.length > 0 ? profile.found.join("; ") : "noch keine belastbaren Eckdaten"}
- Fehlend: ${profile.missing.length > 0 ? profile.missing.join("; ") : "keine wesentlichen Pflichtdaten fehlen"}
- Beste Rückfragen: ${profile.nextBestQuestions.length > 0 ? profile.nextBestQuestions.join(" | ") : "keine Rückfrage nötig"}`;
}

function formatHistory(messages: ChatMessage[]) {
  return messages
    .map((message) => {
      const speaker = message.role === "user" ? "Nutzer" : "DiagnoseHUB";
      return `${speaker}: ${message.content}`;
    })
    .join("\n\n");
}

function normalizeMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .flatMap((entry): ChatMessage[] => {
      if (!entry || typeof entry !== "object") {
        return [];
      }

      const candidate = entry as {
        role?: unknown;
        content?: unknown;
      };

      if (
        (candidate.role === "user" || candidate.role === "assistant") &&
        typeof candidate.content === "string"
      ) {
        const content = sanitizeText(candidate.content, 1600);

        if (!content) {
          return [];
        }

        return [
          {
            role: candidate.role,
            content,
          },
        ];
      }

      return [];
    })
    .slice(-8);
}

function normalizeAudienceMode(value: unknown): DiagnosisAudienceMode {
  return value === "hobby" ? "hobby" : "workshop";
}

function createAuthenticatedSupabaseClient(accessToken: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL fehlt in .env.local");
  }

  if (!supabaseKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY oder NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY fehlt in .env.local"
    );
  }

  return createSupabaseClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

async function loadUserFromAccessToken(
  supabase: SupabaseClient,
  accessToken: string
) {
  const { data, error } = await supabase.auth.getUser(accessToken);

  if (error) {
    throw new Error(`Anmeldung ungültig: ${error.message}`);
  }

  if (!data.user) {
    throw new Error("Keine gültige Anmeldung gefunden.");
  }

  return data.user;
}

async function loadUserPlanFromSupabase(
  supabase: SupabaseClient,
  user: User
): Promise<UserPlan> {
  const { data, error } = await supabase
    .from("workshop_profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error(`Plan konnte nicht geladen werden: ${error.message}`);
  }

  if (!data) {
    return "free";
  }

  const profile = data as WorkshopProfileDatabaseRow;

  if (!isValidUserPlan(profile.plan)) {
    return "free";
  }

  return profile.plan;
}

async function loadDiagnosisUsageCount(
  supabase: SupabaseClient,
  user: User,
  todayKey: string
) {
  const { data, error } = await supabase
    .from("diagnosis_usage")
    .select("*")
    .eq("user_id", user.id)
    .eq("usage_date", todayKey)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Nutzungszähler konnte nicht geladen werden: ${error.message}`
    );
  }

  if (!data) {
    return 0;
  }

  const usageRow = data as DiagnosisUsageDatabaseRow;

  return usageRow.diagnosis_count || 0;
}

async function saveDiagnosisUsageCount(
  supabase: SupabaseClient,
  user: User,
  todayKey: string,
  nextCount: number
) {
  const { data, error } = await supabase
    .from("diagnosis_usage")
    .upsert(
      {
        user_id: user.id,
        usage_date: todayKey,
        diagnosis_count: nextCount,
      },
      {
        onConflict: "user_id,usage_date",
      }
    )
    .select("*")
    .single();

  if (error) {
    throw new Error(
      `Nutzungszähler konnte nicht gespeichert werden: ${error.message}`
    );
  }

  const usageRow = data as DiagnosisUsageDatabaseRow;

  return usageRow.diagnosis_count || nextCount;
}

function createEmptyTorqueSpecContext(): TorqueSpecContext {
  return {
    foundSpecs: [],
    summary: "Keine freigegebenen Drehmomentwerte erkannt.",
  };
}

async function loadApprovedTorqueSpecContext(
  supabase: SupabaseClient,
  combinedContext: string
): Promise<TorqueSpecContext> {
  if (!hasTorqueSpecIntent(combinedContext)) {
    return createEmptyTorqueSpecContext();
  }

  const { data, error } = await supabase
    .from("torque_specs")
    .select("*")
    .eq("status", "approved")
    .eq("visibility", "shared")
    .order("updated_at", { ascending: false })
    .limit(500);

  if (error) {
    console.error("Freigegebene Drehmomentwerte konnten nicht geladen werden:", error);
    return createEmptyTorqueSpecContext();
  }

  return detectTorqueSpecContext(
    combinedContext,
    ((data || []) as TorqueSpecRow[]).map(toTorqueSpec)
  );
}

async function resolveUsageControl(
  accessToken: string
): Promise<UsageControl> {
  const todayKey = getTodayKeyGermany();

  if (!accessToken) {
    throw new Error(
      "Für serverseitige Plan-Limits fehlt der Zugriffstoken."
    );
  }

  const supabase = createAuthenticatedSupabaseClient(accessToken);
  const user = await loadUserFromAccessToken(supabase, accessToken);
  let plan: UserPlan = "free";
  let countBefore = 0;

  try {
    plan = await loadUserPlanFromSupabase(supabase, user);
  } catch (error) {
    console.error("Plan konnte nicht geladen werden, Free-Fallback aktiv:", error);
  }

  try {
    countBefore = await loadDiagnosisUsageCount(supabase, user, todayKey);
  } catch (error) {
    console.error(
      "Nutzungszähler konnte nicht geladen werden, Diagnose läuft ohne Blockade weiter:",
      error
    );
  }

  return {
    enabled: true,
    source: "supabase",
    supabase,
    user,
    plan,
    planLabel: PLAN_LABELS[plan],
    todayKey,
    countBefore,
    maxDailyDiagnoses: PLAN_DAILY_LIMITS[plan],
  };
}

function buildUsageLimitPayload(
  usageControl: UsageControl,
  countAfter: number | null,
  warning?: string
): UsageLimitPayload {
  const effectiveCountAfter = countAfter ?? null;

  return {
    enabled: usageControl.enabled,
    source: usageControl.source,
    plan: usageControl.plan,
    planLabel: usageControl.planLabel,
    todayKey: usageControl.todayKey,
    countBefore: usageControl.countBefore,
    countAfter: effectiveCountAfter,
    maxDailyDiagnoses: usageControl.maxDailyDiagnoses,
    remainingBefore: Math.max(
      usageControl.maxDailyDiagnoses - usageControl.countBefore,
      0
    ),
    remainingAfter:
      effectiveCountAfter === null
        ? null
        : Math.max(usageControl.maxDailyDiagnoses - effectiveCountAfter, 0),
    limitReached:
      usageControl.enabled &&
      usageControl.countBefore >= usageControl.maxDailyDiagnoses,
    warning,
  };
}

function termHasNegationContext(text: string, term: string) {
  const normalizedText = text.toLowerCase();
  const normalizedTerm = term.toLowerCase();

  let searchIndex = 0;

  while (searchIndex < normalizedText.length) {
    const termIndex = normalizedText.indexOf(normalizedTerm, searchIndex);

    if (termIndex === -1) {
      return true;
    }

    const contextStart = Math.max(0, termIndex - 80);
    const contextEnd = Math.min(
      normalizedText.length,
      termIndex + normalizedTerm.length + 80
    );

    const context = normalizedText.slice(contextStart, contextEnd);

    const allowedPatterns = [
      `keine ${normalizedTerm}`,
      `keinen ${normalizedTerm}`,
      `nicht ${normalizedTerm}`,
      `${normalizedTerm} nicht`,
      `${normalizedTerm} gibt es nicht`,
      `ohne ${normalizedTerm}`,
      `statt ${normalizedTerm}`,
      `keinesfalls ${normalizedTerm}`,
      `niemals ${normalizedTerm}`,
    ];

    const isAllowed = allowedPatterns.some((pattern) =>
      context.includes(pattern)
    );

    if (!isAllowed) {
      return false;
    }

    searchIndex = termIndex + normalizedTerm.length;
  }

  return true;
}

function hasForbiddenTermWithoutCorrection(answer: string, terms: string[]) {
  const text = normalizeTechnicalSearchText(answer);

  return terms.some((term) => {
    if (!text.includes(term)) {
      return false;
    }

    return !termHasNegationContext(text, term);
  });
}

function hasTechnicalConflict(engineType: EngineType, answer: string) {
  if (engineType === "Diesel") {
    return hasForbiddenTermWithoutCorrection(answer, [
      "zuendkerze",
      "zuendkerzen",
      "zuendspule",
      "zuendspulen",
      "zuendfunke",
      "zuendanlage",
    ]);
  }

  if (engineType === "Benziner") {
    return hasForbiddenTermWithoutCorrection(answer, [
      "gluehkerze",
      "gluehkerzen",
      "gluehsteuergerät",
    ]);
  }

  return false;
}

function getDiagnosisModel() {
  return (
    process.env.OPENAI_DIAGNOSIS_MODEL ||
    process.env.OPENAI_MODEL ||
    FALLBACK_DIAGNOSIS_MODEL
  );
}

function getOpenAiErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }

  return String(error);
}

function shouldRetryWithFallbackModel(error: unknown, model: string) {
  if (model === FALLBACK_DIAGNOSIS_MODEL) {
    return false;
  }

  const message = getOpenAiErrorMessage(error).toLowerCase();

  return (
    message.includes("model") &&
    (message.includes("not found") ||
      message.includes("does not exist") ||
      message.includes("unsupported") ||
      message.includes("invalid"))
  );
}

function modelSupportsReasoning(model: string) {
  return (
    model.startsWith("gpt-5") ||
    model.startsWith("o1") ||
    model.startsWith("o3") ||
    model.startsWith("o4")
  );
}

function getDiagnosisReasoningEffort(): "minimal" | "low" | "medium" | "high" {
  const effort =
    process.env.OPENAI_DIAGNOSIS_REASONING_EFFORT ||
    process.env.OPENAI_REASONING_EFFORT;

  if (effort === "minimal") return "minimal";
  if (effort === "medium") return "medium";
  if (effort === "high") return "high";

  return "low";
}

function getDiagnosisMaxOutputTokens() {
  const value = Number(process.env.OPENAI_DIAGNOSIS_MAX_OUTPUT_TOKENS || 4200);

  if (Number.isNaN(value)) {
    return 4200;
  }

  return Math.min(Math.max(value, 1200), 6000);
}

function shouldAutoRetryDiagnosis() {
  return process.env.DIAGNOSIS_AUTO_RETRY === "true";
}

function getAudienceModeLabel(audienceMode: DiagnosisAudienceMode) {
  return audienceMode === "hobby" ? "Hobby-Modus" : "Werkstatt-Modus";
}

function detectDiagnosisRequestIntent(input: string): DiagnosisRequestIntent {
  const normalizedInput = normalizeTechnicalSearchText(input);

  const instructionTerms = [
    "anleitung",
    "arbeitsanweisung",
    "schritt fuer schritt",
    "schritt-fuer-schritt",
    "notentriegelung",
    "notentriegeln",
    "entriegelung",
    "entriegeln",
    "ausbau",
    "ausbauen",
    "einbau",
    "einbauen",
    "demontage",
    "demontieren",
    "montage",
    "montieren",
    "wechsel",
    "wechseln",
    "tausch",
    "tauschen",
    "ersetzen",
    "erneuern",
    "freilegen",
    "ausclipsen",
    "abbauen",
    "ausbauen",
    "ausrasten",
    "einstellen",
    "anlernen",
    "adaptieren",
    "grundeinstellung",
    "service zurueckstellen",
    "zurueckstellen",
    "zuruecksetzen",
    "oeffnen",
    "verkleidung ab",
    "verkleidung entfernen",
  ];

  if (instructionTerms.some((term) => normalizedInput.includes(term))) {
    return "instruction";
  }

  const compactProcedurePattern =
    /\b(ausbau|einbau|wechsel|tausch|reset|notentriegelung|entriegelung|grundeinstellung)\b/i;

  return compactProcedurePattern.test(normalizedInput) ? "instruction" : "diagnosis";
}

function getRequestIntentLabel(intent: DiagnosisRequestIntent) {
  return intent === "instruction" ? "Anleitung" : "Diagnose";
}

function buildDiagnosisToneInstructions(audienceMode: DiagnosisAudienceMode) {
  if (audienceMode === "hobby") {
    return `
Antworte in normaler Sprache für private Fahrzeughalter und Hobbyschrauber.
Der technische Inhalt bleibt korrekt, aber Ton, Risiko und Detailtiefe sind auf Nicht-Profis angepasst.
Erkläre Fachbegriffe kurz in Klammern oder mit einem einfachen Satz.
Keine Werkstatt-Abkürzungen ohne Erklärung.
Keine Werkstatt-Abschnitte wie "# Diagnosepfad", "# Ursachen / typische Fehler" oder "# Speicherung / Notizen" verwenden.
Wenn eine Arbeit für Laien riskant ist, klar "nicht selbst machen" oder "nur eingeschränkt" schreiben.
`;
  }

  return `
Antworte kurz, direkt und werkstattnah.
Keine Textwand, aber auch keine groben Allgemeinplätze.
Die Antwort soll so sein, dass ein Kfz-Mechatroniker daraus direkt den nächsten Arbeitsschritt ableiten kann.
`;
}

function buildAudienceModeInstructions(audienceMode: DiagnosisAudienceMode) {
  if (audienceMode === "hobby") {
    return `
Ausgabemodus: Hobby-Modus.
Gleicher technischer Inhalt wie im Werkstatt-Modus, aber in normaler Sprache.
Fachbegriffe kurz erklären, ohne die Antwort aufzublasen.
Risiko höher gewichten: Bremsen, Airbag, Hochvolt, Kraftstoff, Steuerzeiten, Lenkung, Klima-Kältemittel und ein möglicherweise fahruntüchtiges Fahrzeug klar markieren.

Pflichtinhalt Hobby-Modus:
- Fehlercode: Was bedeutet der Code normalsprachlich? Welche Systeme sind betroffen?
- Soll-/Richtwerte: immer angeben, wenn interne Werte zum Fall erkannt wurden.
- Selbst machbar?: Ja, nein oder eingeschränkt, mit Begründung.
- Schwierigkeit: Einfach, mittel, schwer oder Profi.
- Werkzeug: Grundwerkzeug, Diagnosegerät, Messmittel, Spezialwerkzeug und Hebebühne getrennt nennen.
- Benötigte Ersatzteile / Material: nicht auf Verdacht; nur "bereitlegen" oder "nur bei Befund ersetzen" nennen.
- Risiko: nur relevante Risiken nennen, aber klar.
- Prüfreihenfolge: erst einfache Checks, dann Messungen, dann Teiletausch.
- Werkstattkosten grob: optional; wenn genannt, immer als grobe Schätzung kennzeichnen.
- Nächste Schritte: konkret und für den Nutzer verständlich.

Antwortformat Hobby-Modus:
# Fehlercode
# Soll-/Richtwerte
# Selbst machbar?
# Schwierigkeit
# Werkzeug
# Benötigte Ersatzteile / Material
# Risiko
# Prüfreihenfolge
# Werkstattkosten grob
# Nächste Schritte
`;
  }

  return `
Ausgabemodus: Werkstatt-Modus.
Gleicher technischer Inhalt wie im Hobby-Modus, aber knapp, fachlich und entscheidungsorientiert.
Fokus: Diagnosepfad, Messlogik, Plausibilität und nächster Arbeitsschritt.

Pflichtinhalt Werkstatt-Modus:
- Diagnosepfad: Symptom -> Ursachen/typische Fehler -> Prüfungen -> Messwerte -> Entscheidung.
- Soll-/Richtwerte: erkannte Werte immer nennen und in die Messwertlogik einbauen.
- Benötigte Werkzeuge: Diagnosetester, Messmittel, Grundwerkzeug, Spezialwerkzeug und Hebebühne/Arbeitsplatz getrennt nennen.
- Benötigte Ersatzteile / Material: nur wenn prüf- oder arbeitsbedingt plausibel; sonst klar "erst nach Befund/Herstellerdaten festlegen" schreiben.
- Ersatzteile nicht als Diagnoseersatz verwenden: Dichtungen, Einmalschrauben, Betriebsstoffe und Befestigungsmaterial nur nennen, wenn sie für die Arbeit realistisch benötigt werden.
- Ursachen / typische Fehler: mögliche Ursachen, Fehldiagnosen, bekannte Schwachstellen und Plausibilitätschecks zusammen bewerten.
- Format für Ursachen / typische Fehler: je Bullet mit Priorität und Feldern schreiben:
  - [hoch] Ursache: ... | Typischer Fehler: ... | Prüfbeweis: ...
  - [mittel] Ursache: ... | Typischer Fehler: ... | Prüfbeweis: ...
- Speicherung: Fall speichern, später wiederfinden, interne Notizen/Schadteil dokumentieren.

Antwortformat Werkstatt-Modus:
# Diagnosepfad
# Ursachen / typische Fehler
# Soll-/Richtwerte
# Prüfungen und Messwerte
# Entscheidung
# Benötigte Werkzeuge
# Benötigte Ersatzteile / Material
# Speicherung / Notizen
`;
}

function buildFallbackResponseFormatInstructions(audienceMode: DiagnosisAudienceMode) {
  if (audienceMode === "hobby") {
    return `
Antwortformat-Fallback bei normaler Diagnose im Hobby-Modus:
Verwende zwingend die Hobby-Abschnitte. Keine Werkstatt-Abschnitte ausgeben.
Wenn ein Pflichtabschnitt im Einzelfall nicht sinnvoll ist, kurz "nicht relevant" oder "fahrzeugabhängig" schreiben.

# Fehlercode
Falls ein Fehlercode vorhanden ist: Bedeutung in normaler Sprache, betroffene Systeme und was der Code nicht sicher beweist.
Falls kein Fehlercode vorhanden ist: "Kein Fehlercode genannt" und mit Symptomdiagnose fortfahren.

# Soll-/Richtwerte
Passende interne Werte nennen. Wenn keine Werte vorhanden sind: "Keine passenden Sollwerte hinterlegt."

# Selbst machbar?
Ja, nein oder eingeschränkt. Kurz begründen und klare Grenze nennen.

# Schwierigkeit
Einfach, mittel, schwer oder Profi.

# Werkzeug
Getrennt nennen:
- Grundwerkzeug
- Diagnosegerät / Messmittel
- Spezialwerkzeug
- Hebebühne / Arbeitsplatz
Nur relevante Werkzeuge nennen. Keine erfundenen Spezialwerkzeugnummern.

# Benötigte Ersatzteile / Material
Trennen zwischen:
- vorher bereitlegen
- nur bei Befund ersetzen
- Einmalteile / Dichtungen / Schrauben
- Betriebsstoffe
Keine Teile auf Verdacht empfehlen. Wenn unklar: "erst nach Prüfung und Herstellerdaten festlegen".

# Risiko
Nur relevante Risiken nennen: Bremse, Airbag, Hochvolt, Kraftstoff, Steuerzeiten, Lenkung, Klima-Kältemittel oder Fahrzeug bleibt liegen.

# Prüfreihenfolge
Erst einfache Sicht- und Steckverbindungschecks, dann Messungen, dann Teiletausch.

# Werkstattkosten grob
Nur wenn sinnvoll. Immer als grobe Schätzung kennzeichnen.

# Nächste Schritte
Konkrete, verständliche Reihenfolge. Bei riskanten Arbeiten an Werkstatt verweisen.

Antwortformat bei ausdrücklicher Anleitung im Hobby-Modus:
# Werkzeug
# Vorbereitung
# Schritte
# Prüfpunkte
# Risiken
# Abschlussprüfung

Antwortformat bei kurzer Folgefrage:
- Direkt antworten.
- Normale Sprache.
- Maximal 5 bis 8 Bulletpoints.
`;
  }

  return `
Antwortformat-Fallback bei normaler Diagnose im Werkstatt-Modus:
Verwende zwingend das Werkstatt-Format.
Wenn ein Pflichtabschnitt im Einzelfall nicht sinnvoll ist, kurz "nicht relevant" oder "fahrzeugabhängig" schreiben.

# Datenqualität
Genauigkeit der Antwort anhand der vorhandenen Angaben.
Kurz nennen, welche Daten fehlen und welche 2 bis 4 Rückfragen die Diagnose am meisten verbessern.

# Kurzdiagnose
2 bis 4 Sätze. Direkt sagen, was am wahrscheinlichsten ist.

# Wahrscheinlichkeiten
3 bis 5 Ursachen priorisieren.
Jeweils mit "Warum plausibel", "typischer Fehler/Fehldiagnose" und "Wie beweisen/ausschließen".
Bevorzugtes Format: [hoch] Ursache: ... | Typischer Fehler: ... | Prüfbeweis: ...

# Sofort prüfen
3 bis 6 konkrete Prüfpunkte.
Nicht nur Bauteile nennen, sondern kurz sagen, wie geprüft wird.

# Messplan
Konkrete Messpunkte mit Messort, Betriebszustand, Soll-/Richtwert falls vorhanden und Entscheidung.

# Nächste Schritte
Konkrete Arbeitsfolge.
Bei Ausbau/Reparatur typische Demontage nennen:
- welche Abdeckung
- welche Verkleidung
- welcher Stecker
- welche Befestigung
- welche Richtung / Lage, wenn sinnvoll

# Kritische Punkte
Nur wenn relevant:
- Linksgewinde
- Schrauben nicht lösen
- Einstellpunkte nicht verstellen
- Clips/Verriegelungen
- Dichtflächen
- Steuerzeiten
- Hochdruck/Klima/Bremse/Airbag

# Abschluss
Kurz nennen, was danach geprüft werden muss.

Antwortformat bei ausdrücklicher Anleitung:
Wenn der Nutzer schreibt "genaue Anleitung", "Schritt für Schritt", "Ausbauanleitung", "Einbauanleitung" oder "druckbar", dann ausführlicher, aber weiterhin kompakt:

# Werkzeug
Getrennt nennen:
- Grundwerkzeug
- Diagnosegerät / Messmittel
- Spezialwerkzeug
- Hebebühne / Arbeitsplatz
Nur relevante Werkzeuge nennen. Keine erfundenen Spezialwerkzeugnummern.

# Benötigte Ersatzteile / Material
Trennen zwischen:
- vorher bereitlegen
- nur bei Befund ersetzen
- Einmalteile / Dichtungen / Schrauben
- Betriebsstoffe
Keine Teile auf Verdacht empfehlen. Wenn unklar: "erst nach Prüfung und Herstellerdaten festlegen".

# Zugang
Konkrete Demontage bis zum Bauteil.
Keine groben Formulierungen wie "Zugang schaffen".

# Arbeitsschritte
Nummerierte Schritte mit konkreter Reihenfolge.

# Mess-/Entscheidungspunkte
Welche Messung entscheidet, ob repariert, weitergesucht oder nicht weitergefahren wird.

# Kritische Punkte
Nur relevante Hinweise direkt und knapp.

# Abschlussprüfung
Funktionstest, Fehlerspeicher, Live-Daten, Dichtheit, Probefahrt oder Anlernung nur wenn relevant.

Antwortformat bei kurzer Folgefrage:
- Direkt antworten.
- Keine komplette neue Diagnose.
- Maximal 5 bis 8 Bulletpoints.
`;
}

function buildRequestIntentInstructions(
  requestIntent: DiagnosisRequestIntent,
  audienceMode: DiagnosisAudienceMode
) {
  if (requestIntent === "instruction") {
    const modeText =
      audienceMode === "hobby"
        ? "normalsprachliche, vorsichtige Hobby-Anleitung"
        : "präzise Werkstatt-Anleitung";
    const instructionBoundaryRule =
      audienceMode === "hobby"
        ? "- Am Ende klar sagen, wann der Nutzer nicht weiter selbst arbeiten sollte."
        : "- Am Ende klar sagen, wann Herstellerdaten, Spezialwerkzeug, DSG-Grundeinstellung oder ein Spezialist nötig sind.";
    const instructionFinalHeading =
      audienceMode === "hobby"
        ? "# Wann in die Werkstatt?"
        : "# Abbruchgrenze / Eskalation";

    return `
Erkannte Anfrageart: Anleitung.
Die aktuelle Eingabe ist als Arbeitsanweisung zu behandeln, nicht als Fehlerdiagnose.
Beispiele: "Superb 2018 DSG Notentriegelung", "Gebläsemotor ausbauen", "Batterie anlernen".

Pflicht:
- Liefere eine ${modeText}.
- Keine normale Diagnose mit Ursachenliste ausgeben, außer ein Prüfschritt ist für die Anleitung nötig.
- Wenn es um Notentriegelung, Entriegelung, Ausbau, Einbau, Wechsel, Anlernen, Grundeinstellung, Zurückstellen oder Demontage geht, steht der Ablauf im Vordergrund.
- Nenne Werkzeug und Teile / Material getrennt. Ersatzteile nur empfehlen, wenn sie zur Arbeit sicher gehören oder klar als "nur bei Befund" gekennzeichnet sind.
- Nenne fehlende Daten, aber blockiere die Antwort nicht, wenn ein typischer sicherer Ablauf möglich ist.
- Bei DSG/Automatik-Notentriegelung: klar zwischen Pannen-/Rangierhilfe und Reparaturdiagnose unterscheiden.
- Soll-/Richtwerte bei Anleitungen nicht pauschal nennen. Nur angeben, wenn der Arbeitsschritt ohne diesen Wert fachlich nicht korrekt ausführbar ist.
- Bei DSG-Getriebeölwechsel DQ250 als zwingenden Prozesswert nennen: nach dem Durchschalten der Fahrstufen Öltemperatur für die Ölstandseinstellung auf 35-45 °C bringen und per Diagnosetester überwachen.
- Unsichere oder fahrzeugabhängige Werte klar als fehlende Herstellerdaten kennzeichnen.
- Keine illegalen Umgehungen, Wegfahrsperren-, Airbag-, Abgas- oder Sicherheitsmanipulationen erklären.
${instructionBoundaryRule}

Antwortformat bei erkannter Anleitung:
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
${instructionFinalHeading}
`;
  }

  return `
Erkannte Anfrageart: Diagnose.
Die aktuelle Eingabe ist als Fehlersuche/Prüfplan zu behandeln.
Wenn der Nutzer nur ein Arbeitsziel ohne Symptom nennt, nicht künstlich eine Diagnose erfinden.
`;
}

function answerMatchesRequestIntent(
  answer: string,
  requestIntent: DiagnosisRequestIntent
) {
  const normalizedAnswer = normalizeAnswerForModeCheck(answer);

  if (requestIntent === "instruction") {
    return (
      normalizedAnswer.includes("# ziel der anleitung") &&
      normalizedAnswer.includes("# arbeitsschritte") &&
      (normalizedAnswer.includes("# abschlussprüfung") ||
        normalizedAnswer.includes("# abschlusspruefung"))
    );
  }

  return true;
}

function enforceInstructionHeadingForAudience(
  answer: string,
  audienceMode: DiagnosisAudienceMode,
  requestIntent: DiagnosisRequestIntent
) {
  if (requestIntent !== "instruction" || audienceMode !== "workshop") {
    return answer;
  }

  return answer.replace(
    /^(\s*#{1,6}\s*)Wann\s+in\s+die\s+Wer(?:kstatt)?\??\s*$/gim,
    "$1Abbruchgrenze / Eskalation"
  );
}

function buildRequestIntentRetryWarning(
  requestIntent: DiagnosisRequestIntent,
  audienceMode: DiagnosisAudienceMode
) {
  if (requestIntent !== "instruction") {
    return "";
  }
  const instructionFinalHeading =
    audienceMode === "hobby"
      ? "# Wann in die Werkstatt?"
      : "# Abbruchgrenze / Eskalation";
  const instructionModeRule =
    audienceMode === "hobby"
      ? "Schreibe normalsprachlich und mit klarer Risikogrenze."
      : "Schreibe werkstattnah, knapp und mit fachlicher Abbruchgrenze statt Werkstattverweis.";

  return `
ACHTUNG: Die vorherige Antwort hat die Anfrage fälschlich als Diagnose behandelt.
Erzeuge die Antwort neu.
Die erkannte Anfrageart ist Anleitung.
Verwende zwingend diese Abschnitte:
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
${instructionFinalHeading}
${instructionModeRule}
  `;
}

function buildSystemPrompt(
  engineContext: EngineContext,
  faultCodeContext: FaultCodeContext,
  technicalSpecContext: TechnicalSpecContext,
  torqueSpecContext: TorqueSpecContext,
  approvedCorrections: ApprovedDiagnosisCorrection[],
  inputQualityProfile: DiagnosisInputQualityProfile,
  audienceMode: DiagnosisAudienceMode,
  requestIntent: DiagnosisRequestIntent,
  retryWarning?: string
) {
  return `
Du bist DiagnoseHUB, ein technischer KI-Diagnoseassistent für ${
    audienceMode === "hobby"
      ? "private Fahrzeughalter und Hobbyschrauber"
      : "freie Kfz-Werkstätten"
  }.

Antworte immer auf Deutsch.
Aktiver Ausgabemodus: ${getAudienceModeLabel(audienceMode)}.
Erkannte Anfrageart: ${getRequestIntentLabel(requestIntent)}.
Der aktive Ausgabemodus ist verbindlich und hat Vorrang vor allgemeinen Diagnose-Regeln.
Die erkannte Anfrageart ist ebenfalls verbindlich.

${buildDiagnosisToneInstructions(audienceMode)}

${buildRequestIntentInstructions(requestIntent, audienceMode)}

Maximaler Diagnoseanspruch:
- Arbeite wie ein Diagnosetechniker, nicht wie ein Teileberater.
- Trenne Beobachtung, Ursache, Prüfung, Messwert und Entscheidung klar.
- Jede Hauptursache braucht einen Prüfbeweis oder einen Ausschlussweg.
- Beginne mit den billigsten, schnellsten und plausibelsten Prüfungen.
- Nenne Abbruchkriterien: wann nicht weiterfahren, wann nicht weiter zerlegen, wann Herstellerdaten nötig sind.
- Wenn Daten fehlen, trotzdem helfen, aber die Unsicherheit sichtbar machen.
- Je mehr Fahrzeugdaten vorhanden sind, desto konkreter werden Sollwerte, Zugang, Messpunkte und nächste Schritte.
- Keine falsche Sicherheit: Wenn Fahrzeugvariante, Motorcode oder Systemvariante fehlt, klar als Annahme kennzeichnen.

Grundregeln:
- Keine langen Einleitungen.
- Keine pauschalen Disclaimer.
- Keine unnötigen Sicherheitshinweise.
- Keine erfundenen Drehmomente, Füllmengen, Spezialwerkzeugnummern oder Herstellersollwerte.
- Wenn genaue Werte fahrzeugabhängig sind, schreibe kurz: "nach Herstellervorgabe prüfen".
- Benötigte Werkzeuge konkret und nach Zweck nennen: Diagnose, Messung, Demontage, Spezialwerkzeug, Arbeitsplatz.
- Benötigte Ersatzteile und Material nie als pauschalen Teiletausch ausgeben; immer zwischen "bereitlegen", "nur bei Befund" und "nach Herstellerdaten" unterscheiden.
- Keine illegalen Manipulationen erklären.
- Keine Deaktivierung von Abgas-, Airbag-, ABS-, ESP- oder Assistenzsystemen erklären.

Wichtig zur Antwortlänge:
- Standardantwort kompakt halten; die Pflichtabschnitte des aktiven Ausgabemodus haben Vorrang.
- Maximal 3 bis 7 Bulletpoints pro Abschnitt.
- Kurze Sätze.
- Keine Roman-Erklärung.
- Trotzdem konkrete Arbeitsschritte nennen.
- Nicht schreiben: "Zugang schaffen", sondern genauer beschreiben, welche Verkleidung, Abdeckung, Stecker, Halter oder Baugruppe typischerweise entfernt wird.
- Wenn der genaue Aufbau fahrzeugabhängig ist, schreibe: "typischer Zugang" und nenne die wahrscheinlichste Demontagefolge.

Strukturregeln:
- Jeder Abschnitt beginnt mit der wichtigsten Aussage, danach erst Details.
- Pro Bullet nur eine Aussage oder eine Prüfung.
- Keine verschachtelten Listen.
- Ursachen, Prüfung und Entscheidung nicht in einen langen Absatz mischen.
- Wenn möglich: Ursache -> Prüfbeweis -> Entscheidung immer in gleicher Reihenfolge.
- Warnungen nur im Abschnitt Risiko/Kritische Punkte oder direkt am betroffenen Schritt nennen.

Werkstatt-Präzision:
- Bei Aus-/Einbau immer konkrete Demontagereihenfolge nennen.
- Beispiel: nicht "Verkleidung ausbauen", sondern "Handschuhfach ausbauen, untere Fußraumverkleidung lösen, seitliche Mittelkonsole-Verkleidung entfernen".
- Beispiel: nicht "Stecker abziehen", sondern "Stecker entriegeln, Verriegelungsnase nicht abbrechen, auf verschmorte Pins prüfen".
- Beispiel: nicht "Befestigung lösen", sondern "Schrauben lösen oder Bajonettverschluss gegen Anschlag drehen, je nach Ausführung".
- Bauteillage und Zugang kurz, aber konkret beschreiben.
- Stecker, Verriegelungen, Clips, Halter, Kunststoffnasen und Bruchstellen erwähnen, wenn relevant.
- Linksgewinde ausdrücklich erwähnen, wenn es bei diesem Bauteil/System möglich oder typisch ist.
- Schrauben, Muttern, Exzenter, Einstellpunkte oder Markierungen nennen, die nicht gelöst oder nicht verstellt werden dürfen.
- Bei Steuerzeiten, Achsgeometrie, Lenkung, Bremse, Hochvolt, Airbag, Klimaanlage und Kraftstoffsystem besonders präzise sein.
- Erst prüfen, dann ersetzen. Keine reine Teiletausch-Empfehlung.
- "Daten sichern" nur nennen, wenn Steuergerät, Codierung, Programmierung, Anlernung oder Batterieabklemmen mit relevanten Speicherwerten betroffen ist.
- "Batterie abklemmen" nur nennen, wenn technisch nötig: Airbag, Starter, Generator, Hochstromleitung, Steuergerätetausch oder Kurzschlussgefahr.
- Kritische Hinweise direkt am passenden Schritt nennen.

Diagnose-Architektur:
- Bewerte die Datenqualität am Anfang kurz.
- Nenne zuerst die wahrscheinlichste Richtung, aber markiere Unsicherheit.
- Baue einen Prüfpfad: Symptom -> Hypothese -> Prüfung -> Soll/Ist -> Entscheidung.
- Verwende eine kleine Priorisierung: "hoch", "mittel", "niedrig" oder "erst später".
- Messungen immer mit Messort, Betriebszustand und erwarteter Aussage nennen.
- Teiletausch erst nennen, wenn ein Prüfergebnis ihn stützt.
- Nach jeder Reparatur: Verifikation nennen, z. B. Fehlerspeicher, Live-Daten, Dichtheit, Probefahrt, Adaptions-/Anlernwerte.
- Wenn der Nutzer eine Anleitung möchte, liefere keine reine Diagnose, sondern einen arbeitsfähigen Ablauf mit Prüfschritten.

Der Nutzer kann Folgefragen stellen.
Kurze Folgefragen wie "Wo messen?", "Was als nächstes?", "Welche Schraube?", "Linksgewinde?", "Wie ausbauen?" beziehen sich auf den bisherigen Verlauf.
Nutze den bisherigen Fall als Kontext.

${buildAudienceModeInstructions(audienceMode)}

${formatInputQualityPrompt(inputQualityProfile)}

Erkannter Motortyp:
${engineContext.engineType}

Quelle der Motortyp-Erkennung:
${engineContext.source}

Erkannter Motor:
${engineContext.label}

Motorcode:
${engineContext.code ?? "nicht erkannt"}

Motorkontext-Hinweis:
${engineContext.notes ?? "Kein Zusatzhinweis vorhanden."}

Erkannte Fehlercodes aus interner Datenbank:
${formatFaultCodeContext(faultCodeContext)}

Generische Soll-/Richtwerte aus interner Datenbank:
${formatTechnicalSpecContext(technicalSpecContext)}

Manuell freigegebene Drehmomentwerte:
${formatTorqueSpecContext(torqueSpecContext)}

Freigegebene Fachkorrekturen aus DiagnoseHUB:
${formatDiagnosisCorrectionsForPrompt(approvedCorrections)}

Fachkorrektur-Regel:
- Freigegebene Fachkorrekturen sind verbindlich.
- Wenn eine freigegebene Fachkorrektur zur aktuellen Eingabe passt, darf keine widersprechende Aussage ausgegeben werden.
- Bei sicherheitskritischen Korrekturen die korrigierte Arbeitsweise direkt im passenden Schritt nennen.
- Ungeprüfte Nutzervorschläge, Entwürfe oder nicht freigegebene Korrekturen nicht verwenden.

${retryWarning ?? ""}

Motortyp-Regeln:

Diesel:
- Keine Zündkerzen, Zündspulen, Zündfunken oder Zündanlage nennen.
- Bei Kaltstart nur Glühkerzen/Glühsteuergerät nennen, wenn passend.
- Bei Laufproblemen bevorzugt prüfen: Injektoren, Raildruck, Kraftstoffversorgung, Luftmasse, Ladedruck, AGR, DPF-Differenzdruck, Ladeluftstrecke.

Benziner:
- Zündkerzen und Zündspulen dürfen genannt werden.
- Keine Glühkerzen oder Glühsteuergerät nennen.
- Bei TSI/TFSI/FSI auch Falschluft, KGE, Injektoren, Hochdruckpumpe, Verkokung, Ladedruck und Steuerzeiten berücksichtigen.

Unbekannter Motortyp:
- Keine Diesel-/Benziner-spezifischen Bauteile blind nennen.
- Fehlende Fahrzeugdaten kurz nennen.

Fehlercode-Regel:
- Erkannte Fehlercodes aus der internen Datenbank vorrangig nutzen.
- Unbekannte Fehlercodes nicht sicher erklären. Dann Testertext anfordern.

Sollwerte-Regel:
- Bei Diagnoseanfragen erkannte Soll-/Richtwerte aus der internen generischen Datenbank sichtbar nennen, wenn sie zum Fall passen.
- Bei Anleitungen Soll-/Richtwerte nicht als eigenen Pflichtblock ausgeben. Nur zwingende Prozesswerte nennen, wenn der Arbeitsschritt ohne diesen Wert falsch oder unvollständig wäre.
- Beispiel für zwingenden Prozesswert: DQ250-DSG-Getriebeölwechsel. Nach dem Durchschalten der Fahrstufen Öltemperatur für die Ölstandseinstellung auf 35-45 °C bringen und per Diagnosetester überwachen.
- Bei Diagnoseanfragen die Soll-/Richtwerte in einem eigenen Abschnitt "# Soll-/Richtwerte" oder direkt im Abschnitt "Prüfungen und Messwerte" mit angeben.
- Diese Werte als Richtwerte kennzeichnen, wenn Fahrzeugdaten fehlen.
- Exakte Herstellerdaten, Sicherungsnummern, Pinbelegungen, Drehmomente oder Spezialvorgaben nicht erfinden.
- Bei Diagnoseanfragen ohne passende Werte kurz schreiben: "Keine passenden Sollwerte hinterlegt." Bei Anleitungen diesen Satz weglassen, wenn kein zwingender Wert nötig ist.
- Wenn Modell, Baujahr, Motorcode, Lampentyp oder Systemvariante fehlen, kurz sagen, welche Daten die Antwort genauer machen.

Drehmoment-Regel:
- Manuell freigegebene Drehmomentwerte aus der DiagnoseHUB-Drehmomenttabelle dürfen genannt werden.
- Drehmomente aus Entwürfen, ungeprüften Einreichungen oder Vermutungen nicht verwenden.
- Wenn kein passender freigegebener Wert vorhanden ist, schreibe kurz: "Kein freigegebener Drehmomentwert hinterlegt."
- Bei sicherheitsrelevanten Verschraubungen den hinterlegten Fahrzeugbezug, die Schraubstelle und eine Neuteilpflicht mit nennen.
- Je genauer Hersteller, Modell, Baujahr, Motorcode, System und Schraubstelle angegeben sind, desto genauer kann der passende Wert gefunden werden.

${buildFallbackResponseFormatInstructions(audienceMode)}
`;
}

function buildAutomaticTechnicalSpecBlock(
  technicalSpecContext: TechnicalSpecContext
) {
  if (technicalSpecContext.foundSpecs.length === 0) {
    return "";
  }

  const specs = technicalSpecContext.foundSpecs
    .map((spec) => {
      const values = spec.values
        .map((value) => {
          const note = value.note ? ` Hinweis: ${value.note}` : "";

          return `- ${value.label}: ${value.value} (${value.condition}).${note}`;
        })
        .join("\n");

      return `**${spec.title}** (${spec.category})
${values}`;
    })
    .join("\n\n");

  return `# Soll-/Richtwerte
${specs}

Hinweis: Das sind interne generische Richtwerte. Exakte Herstellerdaten, Drehmomente, Pinbelegungen, Sicherungsnummern und Spezialvorgaben bleiben fahrzeugabhängig.`;
}

function appendAutomaticTechnicalSpecBlock(
  answer: string,
  technicalSpecContext: TechnicalSpecContext
) {
  const technicalSpecBlock = buildAutomaticTechnicalSpecBlock(
    technicalSpecContext
  );

  if (!technicalSpecBlock) {
    return answer;
  }

  return `${answer}

${technicalSpecBlock}`;
}

function buildAutomaticTorqueSpecBlock(torqueSpecContext: TorqueSpecContext) {
  if (torqueSpecContext.foundSpecs.length === 0) {
    return "";
  }

  const specs = torqueSpecContext.foundSpecs
    .map((spec) => {
      const details = [
        `- Fahrzeugbezug: ${[
          spec.manufacturer,
          spec.model,
          spec.series,
          spec.engineCode ? `Motor ${spec.engineCode}` : "",
        ]
          .filter(Boolean)
          .join(" ") || "fahrzeugübergreifend hinterlegt"}`,
        `- Schraubstelle: ${formatTorqueSpecTitle(spec)}`,
        `- Drehmoment: ${formatTorqueValue(spec)}`,
        spec.torqueSequence ? `- Reihenfolge: ${spec.torqueSequence}` : "",
        spec.threadCondition ? `- Gewinde/Zustand: ${spec.threadCondition}` : "",
        spec.newFastenerRequired ? "- Neue Schraube/Mutter erforderlich: ja" : "",
        spec.sourceReference
          ? `- Quelle: ${spec.sourceType}, ${spec.sourceReference}`
          : `- Quelle: ${spec.sourceType || "manuell geprüft"}`,
      ].filter(Boolean);

      return `**${formatTorqueSpecTitle(spec)}**
${details.join("\n")}`;
    })
    .join("\n\n");

  return `# Drehmomentwerte
${specs}

Hinweis: Diese Drehmomentwerte wurden manuell geprüft und freigegeben. Nicht passende oder fehlende Drehmomente nicht ableiten.`;
}

function appendAutomaticTorqueSpecBlock(
  answer: string,
  torqueSpecContext: TorqueSpecContext
) {
  const torqueSpecBlock = buildAutomaticTorqueSpecBlock(torqueSpecContext);

  if (!torqueSpecBlock) {
    return answer;
  }

  return `${answer}

${torqueSpecBlock}`;
}

function buildAutomaticInputQualityBlock(
  profile: DiagnosisInputQualityProfile
) {
  const missing =
    profile.missing.length > 0
      ? profile.missing.map((item) => `- ${item}`).join("\n")
      : "- keine wesentlichen Pflichtdaten fehlen";
  const questions =
    profile.nextBestQuestions.length > 0
      ? profile.nextBestQuestions.map((item) => `- ${item}`).join("\n")
      : "- keine Rückfrage nötig";

  return `# Datenqualität
Genauigkeit: ${profile.score}/100 (${profile.level}).

Fehlende Daten:
${missing}

Beste Rückfragen:
${questions}`;
}

function appendAutomaticInputQualityBlock(
  answer: string,
  profile: DiagnosisInputQualityProfile
) {
  if (answer.toLowerCase().includes("# datenqualität")) {
    return answer;
  }

  return `${buildAutomaticInputQualityBlock(profile)}

${answer}`;
}

function normalizeAnswerForModeCheck(answer: string) {
  return answer
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function answerMatchesAudienceMode(
  answer: string,
  audienceMode: DiagnosisAudienceMode
) {
  const normalizedAnswer = normalizeAnswerForModeCheck(answer);

  if (audienceMode === "hobby") {
    const hobbyHeadings = [
      "# selbst machbar",
      "# schwierigkeit",
      "# werkzeug",
      "# benötigte ersatzteile / material",
      "# risiko",
      "# prüfreihenfolge",
      "# nächste schritte",
    ];

    return hobbyHeadings.every((heading) => normalizedAnswer.includes(heading));
  }

  const workshopHeadings = [
    "# diagnosepfad",
    "# ursachen / typische fehler",
    "# prüfungen und messwerte",
    "# entscheidung",
    "# benötigte werkzeuge",
    "# benötigte ersatzteile / material",
  ];

  return workshopHeadings.every((heading) => normalizedAnswer.includes(heading));
}

function buildAudienceModeRetryWarning(audienceMode: DiagnosisAudienceMode) {
  if (audienceMode === "hobby") {
    return `
ACHTUNG: Die vorherige Antwort hat den Hobby-Modus nicht eingehalten.
Erzeuge die Antwort neu.
Verwende zwingend die Hobby-Abschnitte:
# Fehlercode
# Soll-/Richtwerte
# Selbst machbar?
# Schwierigkeit
# Werkzeug
# Benötigte Ersatzteile / Material
# Risiko
# Prüfreihenfolge
# Werkstattkosten grob
# Nächste Schritte
Keine Werkstatt-Abschnitte wie "# Diagnosepfad" oder "# Ursachen / typische Fehler" verwenden.
    `;
  }

  return `
ACHTUNG: Die vorherige Antwort hat den Werkstatt-Modus nicht eingehalten.
Erzeuge die Antwort neu.
Verwende zwingend die Werkstatt-Abschnitte:
# Diagnosepfad
# Ursachen / typische Fehler
# Soll-/Richtwerte
# Prüfungen und Messwerte
# Entscheidung
# Benötigte Werkzeuge
# Benötigte Ersatzteile / Material
# Speicherung / Notizen
  `;
}

function shouldEnforceAudienceModeFormat(input: string, messages: ChatMessage[]) {
  if (messages.length === 0) {
    return true;
  }

  const normalizedInput = input.toLowerCase();

  return (
    input.length > 80 ||
    /\bp[0-9a-f]{4}\b/i.test(input) ||
    normalizedInput.includes("diagnose") ||
    normalizedInput.includes("anleitung") ||
    normalizedInput.includes("messplan") ||
    normalizedInput.includes("fehlercode")
  );
}

async function createDiagnosisAnswer(
  engineContext: EngineContext,
  faultCodeContext: FaultCodeContext,
  technicalSpecContext: TechnicalSpecContext,
  torqueSpecContext: TorqueSpecContext,
  approvedCorrections: ApprovedDiagnosisCorrection[],
  inputQualityProfile: DiagnosisInputQualityProfile,
  messages: ChatMessage[],
  input: string,
  audienceMode: DiagnosisAudienceMode,
  requestIntent: DiagnosisRequestIntent,
  retryWarning?: string,
  modelOverride?: string
) {
  const model = modelOverride || getDiagnosisModel();
  const reasoningEffort = getDiagnosisReasoningEffort();
  const maxOutputTokens = getDiagnosisMaxOutputTokens();

  const responseInput: Parameters<typeof client.responses.create>[0] = {
    model,
    ...(modelSupportsReasoning(model)
      ? {
          reasoning: {
            effort: reasoningEffort,
          },
        }
      : {}),
    max_output_tokens: maxOutputTokens,
    input: [
      {
        role: "system",
        content: buildSystemPrompt(
          engineContext,
          faultCodeContext,
          technicalSpecContext,
          torqueSpecContext,
          approvedCorrections,
          inputQualityProfile,
          audienceMode,
          requestIntent,
          retryWarning
        ),
      },
      {
        role: "user",
        content: `
Aktiver Ausgabemodus:
${getAudienceModeLabel(audienceMode)}

Erkannte Anfrageart:
${getRequestIntentLabel(requestIntent)}

Wichtig:
Halte dich an genau diesen Ausgabemodus und das dazugehörige Antwortformat.
Wenn die Anfrageart "Anleitung" ist, liefere eine Anleitung und keine normale Diagnose.

Bisheriger Diagnoseverlauf:
${formatHistory(messages) || "Noch kein Verlauf vorhanden."}

Aktuelle Eingabe / Folgefrage:
${input}
        `,
      },
    ],
  };

  let response: OpenAI.Responses.Response;

  try {
    response = (await client.responses.create(
      responseInput
    )) as OpenAI.Responses.Response;
  } catch (error) {
    if (shouldRetryWithFallbackModel(error, model)) {
      console.error(
        `Diagnosemodell ${model} nicht verfügbar, Fallback ${FALLBACK_DIAGNOSIS_MODEL} aktiv:`,
        error
      );

      return createDiagnosisAnswer(
        engineContext,
        faultCodeContext,
        technicalSpecContext,
        torqueSpecContext,
        approvedCorrections,
        inputQualityProfile,
        messages,
        input,
        audienceMode,
        requestIntent,
        retryWarning,
        FALLBACK_DIAGNOSIS_MODEL
      );
    }

    throw error;
  }

  const answer = response.output_text?.trim();

  if (!answer) {
    throw new Error("Die KI hat keine auslesbare Diagnose-Antwort geliefert.");
  }

  return answer;
}

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          error:
            "OPENAI_API_KEY fehlt. Bitte in .env.local oder Vercel eintragen.",
        },
        { status: 500 }
      );
    }

    const body = await request.json();

    const input = sanitizeText(body.input, 2500);
    const messages = normalizeMessages(body.messages);
    const audienceMode = normalizeAudienceMode(body.audienceMode);
    const accessToken =
      typeof body.accessToken === "string" ? body.accessToken : "";

    if (!input) {
      return NextResponse.json(
        { error: "Keine gültige Diagnose-Eingabe erhalten." },
        { status: 400 }
      );
    }

    if (!accessToken) {
      return NextResponse.json(
        {
          error:
            "Bitte zuerst einloggen. Auch Free-Diagnosen werden serverseitig gezählt, damit die Monatslimits fair bleiben.",
        },
        { status: 401 }
      );
    }

    const usageControl = await resolveUsageControl(accessToken);

    if (
      usageControl.enabled &&
      usageControl.countBefore >= usageControl.maxDailyDiagnoses
    ) {
      return NextResponse.json(
        {
          error: `Monatslimit erreicht. Dein aktueller Plan ${usageControl.planLabel} erlaubt ${usageControl.maxDailyDiagnoses} KI-Anfragen pro Monat. Folgefragen zählen mit.`,
          usageLimit: buildUsageLimitPayload(usageControl, null),
        },
        { status: 429 }
      );
    }

    const combinedContext = `${formatHistory(
      messages
    )}\n\nAktuelle Eingabe: ${input}`;
    const engineContext = detectEngineContext(combinedContext);
    const faultCodeContext = detectFaultCodeContext(combinedContext);
    const technicalSpecContext = detectTechnicalSpecContext(combinedContext);
    const torqueSpecContext = await loadApprovedTorqueSpecContext(
      usageControl.supabase,
      combinedContext
    );
    const signalLibraryContext = detectSignalLibraryContext(combinedContext);
    const signalLibraryPrompt =
      formatSignalLibraryContextForPrompt(signalLibraryContext);
    const diagnosisInput = signalLibraryPrompt
      ? `${input}\n\n${signalLibraryPrompt}`
      : input;
    const inputQualityProfile = buildDiagnosisInputQualityProfile(
      input,
      messages
    );
    const requestIntent = detectDiagnosisRequestIntent(input);
    const approvedCorrections = await loadApprovedDiagnosisCorrections(
      combinedContext
    );

    let diagnosisLibraryMatch: Awaited<
      ReturnType<typeof findSimilarDiagnosisLibraryEntry>
    > = null;

    if (requestIntent === "diagnosis" && approvedCorrections.length === 0) {
      try {
        diagnosisLibraryMatch = await findSimilarDiagnosisLibraryEntry(
          combinedContext,
          audienceMode,
          {
            limit: 1500,
            minScore: audienceMode === "hobby" ? 74 : 72,
          }
        );
      } catch (error) {
        console.error(
          "Gespeicherte Diagnosebibliothek konnte nicht geprüft werden:",
          error
        );
      }
    }

    if (diagnosisLibraryMatch) {
      let cachedResult = diagnosisLibraryMatch.entry.answer;

      cachedResult = appendAutomaticInputQualityBlock(
        cachedResult,
        inputQualityProfile
      );
      cachedResult = appendAutomaticTechnicalSpecBlock(
        cachedResult,
        technicalSpecContext
      );
      cachedResult = appendAutomaticTorqueSpecBlock(
        cachedResult,
        torqueSpecContext
      );

      return NextResponse.json({
        result: cachedResult,
        engineContext,
        faultCodeContext,
        technicalSpecContext,
        torqueSpecContext,
        qualityCheck: `Gespeicherte Diagnose verwendet. Treffer: ${diagnosisLibraryMatch.score} %. Datenqualität: ${inputQualityProfile.score}/100 (${inputQualityProfile.level}).`,
        reusedExistingDiagnosis: true,
        diagnosisLibraryMatch: {
          score: diagnosisLibraryMatch.score,
          matchedTerms: diagnosisLibraryMatch.matchedTerms,
          title: diagnosisLibraryMatch.entry.title,
          slug: diagnosisLibraryMatch.entry.slug,
          source: diagnosisLibraryMatch.entry.source,
        },
        diagnosisConfig: {
          model: "gespeicherte Diagnosebibliothek",
          reasoningEffort: "not_used",
          maxOutputTokens: 0,
          autoRetry: false,
          audienceMode,
          requestIntent,
        },
        inputQuality: inputQualityProfile,
        usageLimit: buildUsageLimitPayload(
          usageControl,
          usageControl.countBefore
        ),
      });
    }

    let result = await createDiagnosisAnswer(
      engineContext,
      faultCodeContext,
      technicalSpecContext,
      torqueSpecContext,
      approvedCorrections,
      inputQualityProfile,
      messages,
      diagnosisInput,
      audienceMode,
      requestIntent
    );
    let audienceModeRetryApplied = false;
    let requestIntentRetryApplied = false;

    if (!answerMatchesRequestIntent(result, requestIntent)) {
      requestIntentRetryApplied = true;
      result = await createDiagnosisAnswer(
        engineContext,
        faultCodeContext,
        technicalSpecContext,
        torqueSpecContext,
        approvedCorrections,
        inputQualityProfile,
        messages,
        diagnosisInput,
        audienceMode,
        requestIntent,
        buildRequestIntentRetryWarning(requestIntent, audienceMode)
      );
    }

    if (
      requestIntent === "diagnosis" &&
      shouldEnforceAudienceModeFormat(input, messages) &&
      !answerMatchesAudienceMode(result, audienceMode)
    ) {
      audienceModeRetryApplied = true;
      result = await createDiagnosisAnswer(
        engineContext,
        faultCodeContext,
        technicalSpecContext,
        torqueSpecContext,
        approvedCorrections,
        inputQualityProfile,
        messages,
        diagnosisInput,
        audienceMode,
        requestIntent,
        buildAudienceModeRetryWarning(audienceMode)
      );
    }

    const inputQualityNote = `Datenqualität: ${inputQualityProfile.score}/100 (${inputQualityProfile.level}).`;
    let qualityCheck = requestIntentRetryApplied
      ? `Anfrageart als ${getRequestIntentLabel(requestIntent)} korrigiert und Antwort neu erstellt. ${inputQualityNote}`
      : audienceModeRetryApplied
        ? `Ausgabemodus korrigiert und Antwort neu erstellt. ${inputQualityNote}`
        : `Antwort ohne technischen Konflikt erstellt. ${inputQualityNote}`;

    if (approvedCorrections.length > 0) {
      qualityCheck = `${qualityCheck} Freigegebene Fachkorrekturen angewendet: ${approvedCorrections.length}.`;
    }

    if (hasTechnicalConflict(engineContext.engineType, result)) {
      if (shouldAutoRetryDiagnosis()) {
        qualityCheck =
          `Technischer Konflikt erkannt. Antwort wurde automatisch neu generiert. ${inputQualityNote}`;

        result = await createDiagnosisAnswer(
          engineContext,
          faultCodeContext,
          technicalSpecContext,
          torqueSpecContext,
          approvedCorrections,
          inputQualityProfile,
          messages,
          diagnosisInput,
          audienceMode,
          requestIntent,
          `
ACHTUNG: Die vorherige Antwort enthielt ein Bauteil, das zum erkannten Motortyp nicht passt.
Erzeuge die Antwort neu und beachte den Motortyp zwingend.
Bei Diesel keine Zündkerzen, Zündspulen, Zündfunken oder Zündanlage als Ursache oder Prüfpunkt nennen.
Bei Benziner keine Glühkerzen oder Glühsteuergerät als Ursache oder Prüfpunkt nennen.
          `
        );
      } else {
        qualityCheck =
          `Technischer Konflikt erkannt. Automatische Neugenerierung ist deaktiviert, um Kosten zu sparen. ${inputQualityNote}`;
      }
    }

    result = enforceInstructionHeadingForAudience(
      result,
      audienceMode,
      requestIntent
    );
    result = appendAutomaticInputQualityBlock(result, inputQualityProfile);
    if (requestIntent !== "instruction") {
      result = appendAutomaticTechnicalSpecBlock(result, technicalSpecContext);
    }
    result = appendAutomaticTorqueSpecBlock(result, torqueSpecContext);

    let countAfter: number | null = null;
    let usageWarning: string | undefined;

    if (usageControl.enabled && usageControl.supabase && usageControl.user) {
      try {
        countAfter = await saveDiagnosisUsageCount(
          usageControl.supabase,
          usageControl.user,
          usageControl.todayKey,
          usageControl.countBefore + 1
        );
      } catch (error) {
        console.error(
          "Serverseitige Nutzung konnte nicht erhöht werden:",
          error
        );
        usageWarning =
          "Diagnose wurde erstellt, aber der serverseitige Nutzungszähler konnte nicht aktualisiert werden.";
      }
    }

    return NextResponse.json({
      result,
      engineContext,
      faultCodeContext,
      technicalSpecContext,
      torqueSpecContext,
      qualityCheck,
      diagnosisConfig: {
        model: getDiagnosisModel(),
        reasoningEffort: modelSupportsReasoning(getDiagnosisModel())
          ? getDiagnosisReasoningEffort()
          : "not_used",
        maxOutputTokens: getDiagnosisMaxOutputTokens(),
        autoRetry: shouldAutoRetryDiagnosis(),
        audienceMode,
        requestIntent,
        appliedCorrections: approvedCorrections.map((correction) => ({
          id: correction.id,
          title: correction.title,
          severity: correction.severity,
        })),
      },
      inputQuality: inputQualityProfile,
      usageLimit: buildUsageLimitPayload(
        usageControl,
        countAfter,
        usageWarning
      ),
    });
  } catch (error) {
    console.error("KI-Diagnosefehler:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Die KI-Diagnose konnte nicht erstellt werden.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
