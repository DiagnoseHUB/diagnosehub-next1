import OpenAI from "openai";
import { NextResponse } from "next/server";
import {
  findSimilarSavedInstructionGuides,
  saveInstructionGuideToDatabase,
} from "@/lib/supabase/instructionGuideStorage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type GuideStep = {
  title: string;
  description: string;
  check?: string;
  warning?: string;
};

type Guide = {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  category: "Motor" | "Elektrik" | "Klima" | "Fahrwerk" | "Bremse" | "Diagnose";
  difficulty: "leicht" | "mittel" | "schwer";
  estimatedTime: string;
  vehicleApplicability: string;
  tags: string[];
  symptoms: string[];
  tools: string[];
  safetyNotes: string[];
  initialChecks: string[];
  steps: GuideStep[];
  commonCauses: string[];
  nextActions: string[];
  proHint?: string;
  lastUpdated: string;
};

type GenerateInstructionRequestBody = {
  query?: string;
  source?: "search" | "diagnosis";
  diagnosisText?: string;
};

const instructionGuideTextFormat = {
  type: "json_schema",
  name: "instruction_guide",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      title: {
        type: "string",
      },
      subtitle: {
        type: "string",
      },
      category: {
        type: "string",
        enum: ["Motor", "Elektrik", "Klima", "Fahrwerk", "Bremse", "Diagnose"],
      },
      difficulty: {
        type: "string",
        enum: ["leicht", "mittel", "schwer"],
      },
      estimatedTime: {
        type: "string",
      },
      vehicleApplicability: {
        type: "string",
      },
      tags: {
        type: "array",
        items: {
          type: "string",
        },
      },
      symptoms: {
        type: "array",
        items: {
          type: "string",
        },
      },
      tools: {
        type: "array",
        items: {
          type: "string",
        },
      },
      safetyNotes: {
        type: "array",
        items: {
          type: "string",
        },
      },
      initialChecks: {
        type: "array",
        items: {
          type: "string",
        },
      },
      steps: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: {
              type: "string",
            },
            description: {
              type: "string",
            },
            check: {
              type: "string",
            },
            warning: {
              type: "string",
            },
          },
          required: ["title", "description", "check", "warning"],
        },
      },
      commonCauses: {
        type: "array",
        items: {
          type: "string",
        },
      },
      nextActions: {
        type: "array",
        items: {
          type: "string",
        },
      },
      proHint: {
        type: "string",
      },
    },
    required: [
      "title",
      "subtitle",
      "category",
      "difficulty",
      "estimatedTime",
      "vehicleApplicability",
      "tags",
      "symptoms",
      "tools",
      "safetyNotes",
      "initialChecks",
      "steps",
      "commonCauses",
      "nextActions",
      "proHint",
    ],
  },
} as const;

const allowedCategories = [
  "Motor",
  "Elektrik",
  "Klima",
  "Fahrwerk",
  "Bremse",
  "Diagnose",
] as const;

const allowedDifficulties = ["leicht", "mittel", "schwer"] as const;

function sanitizeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function truncate(value: string, maxLength: number) {
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replaceAll("ae", "ae")
    .replaceAll("oe", "oe")
    .replaceAll("ue", "ue")
    .replaceAll("ß", "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function extractJsonObject(text: string) {
  const firstBraceIndex = text.indexOf("{");
  const lastBraceIndex = text.lastIndexOf("}");

  if (firstBraceIndex === -1 || lastBraceIndex === -1) {
    throw new Error("KI-Antwort enthaelt kein JSON-Objekt.");
  }

  return text.slice(firstBraceIndex, lastBraceIndex + 1);
}

function normalizeStringArray(value: unknown, fallback: string[], maxItems = 8) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const cleanedItems = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => truncate(item, 220))
    .filter(Boolean)
    .slice(0, maxItems);

  return cleanedItems.length > 0 ? cleanedItems : fallback;
}

function normalizeCategory(value: unknown): Guide["category"] {
  if (
    typeof value === "string" &&
    allowedCategories.includes(value as Guide["category"])
  ) {
    return value as Guide["category"];
  }

  return "Diagnose";
}

function normalizeDifficulty(value: unknown): Guide["difficulty"] {
  if (
    typeof value === "string" &&
    allowedDifficulties.includes(value as Guide["difficulty"])
  ) {
    return value as Guide["difficulty"];
  }

  return "mittel";
}

function normalizeSteps(value: unknown): GuideStep[] {
  const fallbackSteps: GuideStep[] = [
    {
      title: "Fahrzeugdaten prüfen",
      description:
        "Modell, Baujahr, Motorisierung, Motorkennbuchstaben und Getriebeart eindeutig erfassen.",
      check: "MKB und Fahrzeugdaten notieren.",
      warning: "",
    },
    {
      title: "Arbeitsumfang festlegen",
      description:
        "Prüfen, ob nur Diagnose, Teilprüfung oder kompletter Austausch der Baugruppe geplant ist.",
      check: "Reparaturumfang eindeutig festlegen.",
      warning: "",
    },
  ];

  if (!Array.isArray(value)) {
    return fallbackSteps;
  }

  const steps = value
    .map((item): GuideStep | null => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const rawStep = item as Partial<GuideStep>;

      if (
        typeof rawStep.title !== "string" ||
        typeof rawStep.description !== "string"
      ) {
        return null;
      }

      const title = truncate(rawStep.title, 80);
      const description = truncate(rawStep.description, 260);

      if (!title || !description) {
        return null;
      }

      return {
        title,
        description,
        check:
          typeof rawStep.check === "string"
            ? truncate(rawStep.check, 140)
            : "",
        warning:
          typeof rawStep.warning === "string"
            ? truncate(rawStep.warning, 140)
            : "",
      };
    })
    .filter((step): step is GuideStep => Boolean(step))
    .slice(0, 28);

  return steps.length > 0 ? steps : fallbackSteps;
}

function normalizeGuide(rawGuide: unknown, query: string): Guide {
  const raw =
    rawGuide && typeof rawGuide === "object"
      ? (rawGuide as Partial<Guide>)
      : {};

  const title =
    typeof raw.title === "string" && raw.title.trim()
      ? truncate(raw.title, 150)
      : `KI-Anleitung: ${query}`;

  const slugBase = slugify(title || query) || `ki-anleitung-${Date.now()}`;

  return {
    id: `ki-${Date.now()}`,
    slug: `ki-${slugBase}`,
    title,
    subtitle:
      typeof raw.subtitle === "string" && raw.subtitle.trim()
        ? truncate(raw.subtitle, 360)
        : "Kompakte KI-Werkstatt-Anleitung. Fahrzeugdaten und Herstellerwerte vor Arbeitsbeginn prüfen.",
    category: normalizeCategory(raw.category),
    difficulty: normalizeDifficulty(raw.difficulty),
    estimatedTime:
      typeof raw.estimatedTime === "string" && raw.estimatedTime.trim()
        ? truncate(raw.estimatedTime, 80)
        : "Fahrzeugabhaengig",
    vehicleApplicability:
      typeof raw.vehicleApplicability === "string" &&
      raw.vehicleApplicability.trim()
        ? truncate(raw.vehicleApplicability, 420)
        : "Nur nach eindeutiger Fahrzeugidentifikation, Motorkennbuchstaben und Reparaturumfang anwenden.",
    tags: normalizeStringArray(raw.tags, [query, "KI-Anleitung"], 8),
    symptoms: normalizeStringArray(
      raw.symptoms,
      ["Fehlerbild anhand Kundenbeanstandung eingrenzen."],
      6
    ),
    tools: normalizeStringArray(
      raw.tools,
      [
        "Diagnosetester",
        "Drehmomentschluessel",
        "geeignetes Handwerkzeug",
        "fahrzeugabhaengiges Spezialwerkzeug",
      ],
      10
    ),
    safetyNotes: normalizeStringArray(
      raw.safetyNotes,
      [
        "Herstellerdaten, Drehmomente und Spezialwerkzeug vor Arbeitsbeginn prüfen.",
        "Bei sicherheitsrelevanten Systemen fachgerecht arbeiten.",
      ],
      4
    ),
    initialChecks: normalizeStringArray(
      raw.initialChecks,
      [
        "Fahrzeug, Baujahr, Motorisierung und Motorkennbuchstaben prüfen.",
        "Teile, Dichtungen, Schrauben und Spezialwerkzeug bereitlegen.",
        "Fehlerspeicher und Istwerte prüfen, falls relevant.",
      ],
      5
    ),
    steps: normalizeSteps(raw.steps),
    commonCauses: normalizeStringArray(
      raw.commonCauses,
      ["Ursache erst nach Prüfung, Messung und Sichtkontrolle festlegen."],
      6
    ),
    nextActions: normalizeStringArray(
      raw.nextActions,
      [
        "Nach Montage Fehlerspeicher prüfen, Probefahrt durchführen und Dichtheit kontrollieren.",
      ],
      6
    ),
    proHint:
      typeof raw.proHint === "string" && raw.proHint.trim()
        ? truncate(raw.proHint, 320)
        : "Praxis-Hinweis: Die Anleitung gibt den Werkstattablauf vor. Exakte Werte bei Bedarf gegen Herstellerdaten prüfen.",
    lastUpdated: new Date().toISOString().slice(0, 10),
  };
}

function includesAny(text: string, words: string[]) {
  const normalized = text.toLowerCase();
  return words.some((word) => normalized.includes(word.toLowerCase()));
}

function isTimingChainTopic(query: string) {
  return includesAny(query, [
    "steuerkette",
    "steuertrieb",
    "kette wechseln",
    "kettenwechsel",
    "kettenspanner",
    "gleitschiene",
    "führungsschiene",
    "führungsschiene",
    "nockenwellenversteller",
  ]);
}

function isTimingBeltTopic(query: string) {
  return includesAny(query, [
    "zahnriemen",
    "zahnriemensatz",
    "zahnriemen wechseln",
    "wasserpumpe zahnriemen",
  ]);
}

function isBrakeTopic(query: string) {
  return includesAny(query, [
    "bremse",
    "bremsen",
    "bremsscheibe",
    "bremsbelag",
    "bremssattel",
    "sattelhalter",
  ]);
}

function isClimateTopic(query: string) {
  return includesAny(query, [
    "klima",
    "klimaanlage",
    "kaeltemittel",
    "kaeltemittel",
    "kompressor",
    "verdampfer",
    "kondensator",
  ]);
}

function isTurboTopic(query: string) {
  return includesAny(query, [
    "turbo",
    "turbolader",
    "ladedruck",
    "oelversorgung turbo",
    "oelversorgung turbo",
    "laderschaden",
  ]);
}

function isVagTopic(query: string) {
  return includesAny(query, [
    "audi",
    "vw",
    "volkswagen",
    "skoda",
    "seat",
    "cupra",
    "vag",
    "tdi",
    "tsi",
    "tfsi",
  ]);
}

function isAudiBiTdiTopic(query: string) {
  return includesAny(query, [
    "bitdi",
    "bi tdi",
    "a6 4g",
    "a7 4g",
    "3.0 tdi",
    "3,0 tdi",
    "v6 tdi",
  ]);
}

function isHighRiskTopic(query: string) {
  return includesAny(query, [
    "airbag",
    "hochvolt",
    "lenkung",
    "bremse",
    "steuerkette",
    "steuertrieb",
    "zahnriemen",
    "kupplung",
    "motor ausbauen",
    "turbolader",
    "kraftstoff",
    "kaeltemittel",
    "kaeltemittel",
  ]);
}

function buildBaseInstructions(query: string, source: string) {
  const timingChain = isTimingChainTopic(query);
  const timingBelt = isTimingBeltTopic(query);
  const brake = isBrakeTopic(query);
  const climate = isClimateTopic(query);
  const turbo = isTurboTopic(query);
  const vag = isVagTopic(query);
  const audiBiTdi = isAudiBiTdiTopic(query);
  const highRisk = isHighRiskTopic(query);

  return `
Du bist DiagnoseHUB, ein technischer KI-Assistent für Kfz-Werkstätten.

ZIEL:
Erstelle eine direkte, kompakte und fachlich brauchbare Werkstatt-Anleitung.
Zielgruppe sind ambitionierte Schrauber, Kfz-Mechatroniker und freie Werkstätten.
Schreibe wie ein Werkstattkollege, nicht wie ein Rechtsanwalt.
Keine langen Sicherheitstexte.
Keine unnoetigen Belehrungen.
Keine wiederholten Standardhinweise.
Keine erfundenen Drehmomente, Schluesselweiten, Spezialwerkzeugnummern oder Herstellerwerte.

AUSGABE:
Du musst ausschließlich gültiges JSON im vorgegebenen Schema ausgeben.
Die Antwort muss vollständig abgeschlossen werden.
Lieber kompakter schreiben als wegen Tokenlimit unvollständig abbrechen.

KOMPAKTHEIT:
- safetyNotes maximal 2–4 kurze Punkte.
- initialChecks maximal 3–5 kurze Punkte.
- tools maximal 6–10 Eintraege.
- symptoms maximal 3–6 Eintraege.
- commonCauses maximal 3–6 Eintraege.
- nextActions maximal 3–6 Eintraege.
- proHint maximal 1–2 kurze Saetze.
- check nur ausfuellen, wenn wirklich etwas geprüft, gemessen oder kontrolliert wird.
- warning nur ausfuellen, wenn im konkreten Schritt ein echtes Risiko besteht.
- Wenn kein konkreter Check noetig ist, check als leeren String ausgeben.
- Wenn keine konkrete Warnung noetig ist, warning als leeren String ausgeben.
- Keine langen Absaetze.
- Keine doppelten Hinweise.
- Keine Disclaimer-Wiederholungen.

DETAILTIEFE:
- Einfache Arbeiten: 8–14 Schritte.
- Mittlere Arbeiten: 14–20 Schritte.
- Komplexe Arbeiten wie Steuertrieb, Motorinnenarbeiten, Bremse, Lenkung, Hochvolt, Airbag oder Klimakreis: 20–28 Schritte.
- Niemals mehr als 28 Schritte ausgeben.
- Jeder Schritt muss konkret sein, aber kurz bleiben.
- Titel pro Schritt maximal ca. 70 Zeichen.
- Beschreibung pro Schritt maximal ca. 220 Zeichen.
- Check pro Schritt maximal ca. 120 Zeichen.
- Warning pro Schritt maximal ca. 120 Zeichen.
- Keine langen Erklärtexte.
- Lieber 24 saubere Werkstattschritte als eine unvollständige XXL-Anleitung.

MIKROSCHRITT-MODUS:
- Keine groben Sammelschritte.
- Jeder Schritt beschreibt eine konkrete Handlung.
- Schlechte Beispiele: "Zugang schaffen", "Bauteile demontieren", "Steuerkette ersetzen", "alles montieren".
- Gute Beispiele:
  1. Motorabdeckung entfernen.
  2. Keilrippenriemenverlauf fotografieren.
  3. Riemenspanner mit geeignetem Werkzeug entspannen.
  4. Spanner abstecken, falls vorgesehen.
  5. Keilrippenriemen abnehmen.
  6. OT-Stellung herstellen.
  7. Steuerzeiten vor Demontage prüfen.
  8. Dichtflaechen reinigen.
  9. Motor von Hand durchdrehen.
  10. Fehlerspeicher prüfen.

AUFBAU DER SCHRITTE:
Wenn passend, diese Reihenfolge verwenden:
1. Fahrzeugidentifikation und Pflichtdaten
2. Vorprüfung / Diagnose / Fehlerspeicher / Sichtprüfung
3. Vorbereitung / Batterie / Abdeckungen / Zugang
4. Demontage fahrzeugabhaengig
5. Prüfung von Verschleiß- und Schadteilen
6. Montage / Einstellung / Dichtflaechen / Schrauben
7. Drehmomentgruppen ohne Werte nennen
8. Endkontrolle / Fehlerspeicher / Probefahrt / Dichtheitsprüfung

QUALITAeTSREGEL:
Vor Ausgabe intern prüfen:
- Passt jeder Schritt zum Suchthema "${query}"?
- Wurde eine falsche Baugruppe genannt?
- Wurden Drehmomente erfunden?
- Wurden Schluesselweiten erfunden?
- Ist die Anleitung praktisch nutzbar?
- Ist das JSON vollständig?
- Ist die Antwort kompakt genug?

${
  highRisk
    ? `
REGEL FUeR SICHERHEITS-/MOTORRELEVANTE ARBEITEN:
- Herstellerdaten einmal klar nennen, nicht staendig wiederholen.
- Relevante Drehmomentgruppen nennen, aber keine Werte erfinden.
- Kritische Endkontrolle nennen.
`
    : ""
}

${
  timingChain && !timingBelt
    ? `
SPEZIALREGEL STEUERKETTE / STEUERTRIEB:
- Steuerkette ist nicht Zahnriemen.
- Niemals "Zahnriemen abnehmen/ausbauen/demontieren" schreiben.
- Für Nebenantrieb korrekt "Keilrippenriemen" oder "Nebenaggregateriemen" verwenden.
- Motorkennbuchstabe ist Pflicht.
- OT-Stellung, Steuerzeiten und Arretierung berücksichtigen.
- Kettenspanner, Gleitschienen, Führungsschienen, Kettenraeder, Versteller, Dichtungen und Einmalschrauben berücksichtigen.
- Stirndeckel/Kettengehaeuse, Ventildeckel, Oelwanne, Motorlager und Riemenscheibe nur fahrzeugabhaengig nennen, wenn nicht sicher.
- Drehmomentgruppen nennen, aber keine Werte erfinden.
- Nach Montage Motor von Hand durchdrehen und Steuerzeiten erneut prüfen.
- Erster Start: Oeldruck, Geraeusche, Leckagen und Fehlerspeicher prüfen.
- Nicht jedes Variantenbauteil ausführlich erklären. Hauptreihenfolge kompakt darstellen.
`
    : ""
}

${
  vag && timingChain && !timingBelt
    ? `
VAG-/AUDI-STEUERTRIEB-SCHABLONE:
- Modell, Baujahr, Motorcode und Getriebeart zuerst als Pflichtdaten nennen.
- Bei VAG-Motoren keine pauschalen Aussagen treffen, wenn Motorcode fehlt.
- Steuertrieb-Zugang, Motorlage und Demontageumfang als motorabhaengig markieren.
- Reihenfolge kompakt halten: Identifikation, Zugang, OT, Arretierung, Demontage, Prüfung, Montage, Endkontrolle.
`
    : ""
}

${
  audiBiTdi && timingChain && !timingBelt
    ? `
AUDI 3.0 TDI / BITDI HINWEIS:
- Ohne exakten Motorkennbuchstaben keine motorcode-spezifische Freigabe formulieren.
- Bei A6/A7 4G 3.0 TDI/BiTDI Steuertrieb als sehr komplex einstufen.
- Motor-/Getriebeseite, Zugang und Ausbauumfang fahrzeugabhaengig formulieren.
- Keine erfundenen Spezialwerkzeugnummern, Steuerzeitenwerte oder Drehmomente.
- Kompakte Profi-Reihenfolge ausgeben, nicht jeden Ausbau-Unterfall ausformulieren.
`
    : ""
}

${
  brake
    ? `
SPEZIALREGEL BREMSE:
- Achsweise arbeiten.
- Belagführung, Führungsbolzen, Staubmanschetten, Radnabe und Auflageflaechen berücksichtigen.
- Drehmomentgruppen nennen: Radschrauben, Sattelhalter, Bremssattel/Führungsbolzen.
- Nach Montage Bremspedal vor Fahrt betaetigen.
- Endkontrolle und Probefahrt/Bremsenprüfung nennen.
`
    : ""
}

${
  climate
    ? `
SPEZIALREGEL KLIMA:
- Arbeiten am Kaeltemittelkreis nur mit Klimaservicegerät und Sachkunde.
- Fuellmenge, Oelmenge, Druckwerte und Dichtheitsprüfung nach Herstellerdaten.
- Hochdruck, Niederdruck, Lüfteransteuerung, Kompressorfreigabe, Sensorwerte und Spannungsversorgung berücksichtigen.
- Keine Kaeltemittelarbeiten als einfache Heimwerkerarbeit darstellen.
`
    : ""
}

${
  turbo
    ? `
SPEZIALREGEL TURBOLADER:
- Oelversorgung, Oelzulauf, Oelrücklauf, Kurbelgehaeuseentlueftung und Ladedruckstrecke berücksichtigen.
- Bei wiederholtem Turboschaden Ursachenprüfung vor Teiletausch nennen.
- Oelsiebe, Hohlschrauben, Leitungen und Oelqualität motorabhaengig prüfen.
- Erststart mit Oeldruckaufbau und Dichtheitskontrolle nennen.
`
    : ""
}

TOKENBUDGET-REGEL:
- Die Antwort muss vollständig abgeschlossen werden.
- Nicht versuchen, jeden Sonderfall ausführlich abzudecken.
- Bei sehr komplexen Arbeiten nur die wichtigste Hauptreihenfolge mit konkreten Mikroschritten ausgeben.
- Wenn Details fahrzeugspezifisch sind, kurz markieren statt lange erklären.
- Kompakt schreiben, damit das JSON vollständig bleibt.

Quelle: ${source}.
`;
}

function getReasoningEffort(): "minimal" | "low" | "medium" | "high" {
  const effort = process.env.OPENAI_REASONING_EFFORT;

  if (effort === "minimal") return "minimal";
  if (effort === "low") return "low";
  if (effort === "high") return "high";

  return "medium";
}

function getMaxOutputTokens() {
  const value = Number(process.env.OPENAI_MAX_OUTPUT_TOKENS || 12000);

  if (Number.isNaN(value)) {
    return 12000;
  }

  return Math.min(Math.max(value, 4000), 16000);
}

function modelSupportsReasoning(model: string) {
  return (
    model.startsWith("gpt-5") ||
    model.startsWith("o1") ||
    model.startsWith("o3") ||
    model.startsWith("o4")
  );
}

function buildOpenAiRequestBody(input: string, instructions: string) {
  const model = process.env.OPENAI_MODEL || "gpt-5.5";

  return {
    model,
    ...(modelSupportsReasoning(model)
      ? {
          reasoning: {
            effort: getReasoningEffort(),
          },
        }
      : {}),
    max_output_tokens: getMaxOutputTokens(),
    text: {
      format: instructionGuideTextFormat,
    },
    instructions,
    input,
    background: true,
    store: true,
  };
}

function parseGeneratedGuideFromResponseText(outputText: string, query: string) {
  if (!outputText) {
    throw new Error("Die KI hat noch keine auslesbare JSON-Antwort geliefert.");
  }

  try {
    return normalizeGuide(JSON.parse(outputText), query || "KI-Anleitung");
  } catch {
    try {
      const jsonText = extractJsonObject(outputText);
      return normalizeGuide(JSON.parse(jsonText), query || "KI-Anleitung");
    } catch {
      throw new Error(
        `Die KI-Antwort war nicht parsebar. Antwort-Auszug: ${outputText.slice(
          0,
          700
        )}`
      );
    }
  }
}

async function saveGeneratedGuide(
  guide: Guide,
  query: string,
  sourceType: "ai" | "diagnosis" | "manual" = "ai"
) {
  return saveInstructionGuideToDatabase(
    guide,
    query || guide.title || "KI-Anleitung",
    sourceType
  );
}

async function findReusableInstructionGuide(
  query: string,
  source: "search" | "diagnosis"
) {
  const similarGuides = await findSimilarSavedInstructionGuides(query, {
    limit: 300,
    minScore: source === "diagnosis" ? 72 : 64,
  });

  const bestExistingGuide = similarGuides[0];

  if (!bestExistingGuide) {
    return null;
  }

  return {
    status: "completed",
    reusedExisting: true,
    matchScore: bestExistingGuide.score,
    matchedTerms: bestExistingGuide.matchedTerms,
    guide: bestExistingGuide.guide,
    similarMatches: similarGuides.slice(0, 5).map((match) => ({
      score: match.score,
      matchedTerms: match.matchedTerms,
      guide: {
        id: match.guide.id,
        slug: match.guide.slug,
        title: match.guide.title,
        subtitle: match.guide.subtitle,
        category: match.guide.category,
      },
    })),
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId");
    const query = sanitizeText(searchParams.get("query"), 700);

    if (!jobId) {
      return NextResponse.json({
        status: "ok",
        message: "Anleitungen-KI API ist erreichbar.",
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          error:
            "OPENAI_API_KEY fehlt. Bitte in Vercel oder .env.local eintragen und Server neu starten.",
        },
        { status: 500 }
      );
    }

    const response = await client.responses.retrieve(jobId);
    const status = response.status || "unknown";

    if (status === "queued" || status === "in_progress") {
      return NextResponse.json({
        jobId,
        status,
      });
    }

    if (status !== "completed") {
      const responseAny = response as any;
      const incompleteReason =
        responseAny.incomplete_details &&
        typeof responseAny.incomplete_details === "object" &&
        "reason" in responseAny.incomplete_details
          ? String(responseAny.incomplete_details.reason)
          : "unbekannt";

      return NextResponse.json(
        {
          jobId,
          status,
          error:
            status === "incomplete"
              ? `KI-Job wurde unvollständig beendet. Grund: ${incompleteReason}. Die Anfrage war zu umfangreich oder das Tokenlimit wurde erreicht.`
              : `KI-Job wurde nicht abgeschlossen. Status: ${status}`,
        },
        { status: 500 }
      );
    }

    const outputText = response.output_text || "";
    const guide = parseGeneratedGuideFromResponseText(
      outputText,
      query || "KI-Anleitung"
    );

    let savedGuide = guide;
    let saveWarning: string | undefined;

    try {
      savedGuide = await saveGeneratedGuide(guide, query || guide.title, "ai");
    } catch (saveError) {
      console.error("KI-Anleitung konnte nicht gespeichert werden:", saveError);

      saveWarning =
        saveError instanceof Error
          ? saveError.message
          : "KI-Anleitung wurde erstellt, konnte aber nicht gespeichert werden.";
    }

    return NextResponse.json({
      jobId,
      status: "completed",
      guide: savedGuide,
      saveWarning,
    });
  } catch (error) {
    console.error("KI-Anleitungs-Job konnte nicht gelesen werden:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Der KI-Anleitungs-Job konnte nicht gelesen werden.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GenerateInstructionRequestBody;

    const query = sanitizeText(body.query, 700);
    const diagnosisText = sanitizeText(body.diagnosisText, 5000);
    const source = body.source === "diagnosis" ? "diagnosis" : "search";

    if (!query && !diagnosisText) {
      return NextResponse.json(
        {
          error: "Suchbegriff oder Diagnoseinhalt fehlt.",
        },
        { status: 400 }
      );
    }

    const duplicateSearchText = query || diagnosisText;
    const reusableInstructionGuide = await findReusableInstructionGuide(
      duplicateSearchText,
      source
    );

    if (reusableInstructionGuide) {
      return NextResponse.json(reusableInstructionGuide);
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          error:
            "OPENAI_API_KEY fehlt. Bitte in Vercel oder .env.local eintragen und Server neu starten.",
        },
        { status: 500 }
      );
    }

    const input = `
Quelle:
${source === "diagnosis" ? "Bestehende Diagnose" : "Anleitungssuche"}

Suchbegriff / Thema:
${query || "Nicht angegeben"}

Diagnoseinhalt:
${diagnosisText || "Nicht angegeben"}

Aufgabe:
Erstelle eine kompakte, direkte und fachlich brauchbare Werkstatt-Anleitung.
Bei fehlenden Fahrzeugdaten kurz als Pflichtprüfung markieren.
Keine erfundenen Drehmomente, Schluesselweiten, Spezialwerkzeugnummern oder Herstellerwerte.
Keine langen Disclaimer.
Die Antwort muss vollständig bleiben und darf nicht wegen Laenge abbrechen.
`;

    const response = await client.responses.create(
      buildOpenAiRequestBody(
        input,
        buildBaseInstructions(query || "KI-Anleitung", source)
      ) as any
    );

    return NextResponse.json({
      jobId: response.id,
      status: response.status || "queued",
    });
  } catch (error) {
    console.error("KI-Anleitungs-Job konnte nicht gestartet werden:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Die KI-Anleitung konnte nicht gestartet werden.",
      },
      { status: 500 }
    );
  }
}
