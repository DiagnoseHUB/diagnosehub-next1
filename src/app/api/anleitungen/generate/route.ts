import OpenAI from "openai";
import { NextResponse } from "next/server";
import {
  findSimilarSavedInstructionGuides,
  saveInstructionGuideToDatabase,
} from "@/lib/supabase/instructionGuideStorage";
import { loadAuthenticatedUserFromRequest } from "@/lib/supabase/auth";
import {
  applySafetyToGuide,
  buildSafetyPrompt,
  classifyInstructionRisk,
  createLimitedSafetyGuide,
  evaluateSafetyAccess,
  loadSafetyProfile,
  logSafetyAccess,
  type SafetyEvaluation,
} from "@/services/safetyQualification";

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
  measurement?: string;
  expectedResult?: string;
  decision?: string;
  qualityCheck?: string;
  imageHint?: string;
  imageAlt?: string;
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
  diagnosisGoal?: string;
  missingVehicleData?: string[];
  requiredSkill?: string;
  escalationCriteria?: string[];
  symptoms: string[];
  tools: string[];
  partsAndMaterials?: string[];
  safetyNotes: string[];
  initialChecks: string[];
  measurementPlan?: string[];
  steps: GuideStep[];
  commonCauses: string[];
  nextActions: string[];
  finalChecks?: string[];
  proHint?: string;
  lastUpdated: string;
};

type GenerateInstructionRequestBody = {
  query?: string;
  source?: "search" | "diagnosis";
  diagnosisText?: string;
};

function serializeSafetyEvaluation(evaluation: SafetyEvaluation) {
  return {
    riskClass: evaluation.riskClass,
    decision: evaluation.decision,
    warningType: evaluation.warningType,
    role: evaluation.profile.role,
    qualificationLevel: evaluation.profile.qualificationLevel,
    hvVerified: evaluation.profile.hvVerified,
    allowedFullInstruction: evaluation.allowedFullInstruction,
    limitedReason: evaluation.limitedReason,
    blacklistReason: evaluation.blacklistReason,
  };
}

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
      diagnosisGoal: {
        type: "string",
      },
      missingVehicleData: {
        type: "array",
        items: {
          type: "string",
        },
      },
      requiredSkill: {
        type: "string",
      },
      escalationCriteria: {
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
        description:
          "Benötigte Werkzeuge nach Zweck. Mit kurzen Präfixen arbeiten: Pflicht, Diagnose, Messung, Spezial, Optional, Arbeitsplatz.",
        items: {
          type: "string",
        },
      },
      partsAndMaterials: {
        type: "array",
        description:
          "Benötigte Ersatzteile und Material. Keine Teile auf Verdacht. Mit Präfixen arbeiten: Bereitlegen, Nur bei Befund, Einmalteil, Dichtung, Betriebsstoff, Nach Herstellerdaten.",
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
      measurementPlan: {
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
            measurement: {
              type: "string",
            },
            expectedResult: {
              type: "string",
            },
            decision: {
              type: "string",
            },
            qualityCheck: {
              type: "string",
            },
            imageHint: {
              type: "string",
            },
            imageAlt: {
              type: "string",
            },
          },
          required: [
            "title",
            "description",
            "check",
            "warning",
            "measurement",
            "expectedResult",
            "decision",
            "qualityCheck",
            "imageHint",
            "imageAlt",
          ],
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
      finalChecks: {
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
      "diagnosisGoal",
      "missingVehicleData",
      "requiredSkill",
      "escalationCriteria",
      "symptoms",
      "tools",
      "partsAndMaterials",
      "safetyNotes",
      "initialChecks",
      "measurementPlan",
      "steps",
      "commonCauses",
      "nextActions",
      "finalChecks",
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
    throw new Error("KI-Antwort enthält kein JSON-Objekt.");
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
      imageHint: "Fahrzeugschein, Diagnosegerät und Motorraum-Übersicht.",
      imageAlt: "Fahrzeugdaten vor Arbeitsbeginn prüfen.",
    },
    {
      title: "Arbeitsumfang festlegen",
      description:
        "Prüfen, ob nur Diagnose, Teilprüfung oder kompletter Austausch der Baugruppe geplant ist.",
      check: "Reparaturumfang eindeutig festlegen.",
      warning: "",
      imageHint: "Werkzeugablage mit markierter Baugruppe und Checkliste.",
      imageAlt: "Arbeitsumfang und benötigte Werkzeuge festlegen.",
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
        measurement:
          typeof rawStep.measurement === "string"
            ? truncate(rawStep.measurement, 180)
            : "",
        expectedResult:
          typeof rawStep.expectedResult === "string"
            ? truncate(rawStep.expectedResult, 180)
            : "",
        decision:
          typeof rawStep.decision === "string"
            ? truncate(rawStep.decision, 180)
            : "",
        qualityCheck:
          typeof rawStep.qualityCheck === "string"
            ? truncate(rawStep.qualityCheck, 180)
            : "",
        imageHint:
          typeof rawStep.imageHint === "string"
            ? truncate(rawStep.imageHint, 180)
            : `Bildmotiv: ${title}`,
        imageAlt:
          typeof rawStep.imageAlt === "string"
            ? truncate(rawStep.imageAlt, 140)
            : title,
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
        : "Fahrzeugabhängig",
    vehicleApplicability:
      typeof raw.vehicleApplicability === "string" &&
      raw.vehicleApplicability.trim()
        ? truncate(raw.vehicleApplicability, 420)
        : "Nur nach eindeutiger Fahrzeugidentifikation, Motorkennbuchstaben und Reparaturumfang anwenden.",
    tags: normalizeStringArray(raw.tags, [query, "KI-Anleitung"], 8),
    diagnosisGoal:
      typeof raw.diagnosisGoal === "string" && raw.diagnosisGoal.trim()
        ? truncate(raw.diagnosisGoal, 240)
        : "Ziel: Fehlerbild eindeutig bestätigen, Ursache beweisen und unnötigen Teiletausch vermeiden.",
    missingVehicleData: normalizeStringArray(
      raw.missingVehicleData,
      [
        "Hersteller, Modell, Baujahr, Motorcode und Systemvariante prüfen.",
        "Fehlercode mit vollständigem Testertext dokumentieren, falls vorhanden.",
      ],
      6
    ),
    requiredSkill:
      typeof raw.requiredSkill === "string" && raw.requiredSkill.trim()
        ? truncate(raw.requiredSkill, 120)
        : "Fachkunde abhängig von System und Reparaturumfang.",
    escalationCriteria: normalizeStringArray(
      raw.escalationCriteria,
      [
        "Bei sicherheitsrelevanten Systemen, Hochvolt, Airbag, Bremse, Lenkung oder Steuerzeiten nicht ohne passende Qualifikation arbeiten.",
      ],
      6
    ),
    symptoms: normalizeStringArray(
      raw.symptoms,
      ["Fehlerbild anhand Kundenbeanstandung eingrenzen."],
      6
    ),
    tools: normalizeStringArray(
      raw.tools,
      [
        "Pflicht: geeignetes Handwerkzeug passend zur Baugruppe",
        "Diagnose: Diagnosetester oder Live-Daten, falls für den Fall relevant",
        "Messung: Multimeter, Prüflampe oder Druck-/Temperaturmessgerät nur bei passender Prüfung",
        "Spezial: fahrzeugabhängiges Spezialwerkzeug nach Herstellerdaten",
        "Arbeitsplatz: Hebebühne, Unterstellböcke oder sichere Abstützung nur wenn nötig",
      ],
      10
    ),
    partsAndMaterials: normalizeStringArray(
      raw.partsAndMaterials,
      [
        "Bereitlegen: nur Hilfs- und Verbrauchsmaterial, das für die Prüfung sicher benötigt wird",
        "Nur bei Befund: Ersatzteile erst nach bestätigter Ursache ersetzen",
        "Einmalteil: Dehnschrauben, Muttern, Clips oder Sicherungen nach Herstellerdaten erneuern",
        "Dichtung/Betriebsstoff: Dichtungen, Öl, Kühlmittel oder Kältemittel nur passend zum Arbeitsumfang festlegen",
      ],
      8
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
        "Benötigte Werkzeuge und nur wirklich erforderliche Ersatzteile anhand Arbeitsumfang und Herstellerdaten festlegen.",
        "Fehlerspeicher und Istwerte prüfen, falls relevant.",
      ],
      5
    ),
    measurementPlan: normalizeStringArray(
      raw.measurementPlan,
      [
        "Messwerte nur unter definiertem Betriebszustand bewerten.",
        "Soll-/Istwerte dokumentieren und Abweichung vor Teiletausch bestätigen.",
      ],
      8
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
    finalChecks: normalizeStringArray(
      raw.finalChecks,
      [
        "Fehlerspeicher löschen und nach Probefahrt erneut auslesen.",
        "Funktion, Dichtheit, Geräusche und Live-Daten prüfen.",
      ],
      8
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
Keine unnötigen Belehrungen.
Keine wiederholten Standardhinweise.
Keine erfundenen Drehmomente, Schlüsselweiten, Spezialwerkzeugnummern oder Herstellerwerte.

AUSGABE:
Du musst ausschließlich gültiges JSON im vorgegebenen Schema ausgeben.
Die Antwort muss vollständig abgeschlossen werden.
Lieber kompakter schreiben als wegen Tokenlimit unvollständig abbrechen.

STRUKTUR:
- Die Anleitung soll beim Lesen von oben nach unten wie ein Arbeitsauftrag funktionieren.
- Erst Ziel und Voraussetzungen, dann Prüfung, dann Arbeitsschritte, dann Endkontrolle.
- Jedes Feld hat eine klare Aufgabe. Keine Inhalte doppelt in safetyNotes, initialChecks, steps und finalChecks wiederholen.
- In steps immer nur eine konkrete Handlung pro Schritt.
- Messung, Sollzustand, Entscheidung und Qualitätskontrolle nur dann füllen, wenn sie den Schritt wirklich klarer machen.
- Warnungen nur dort setzen, wo im konkreten Schritt ein echtes Risiko besteht.
- Keine langen Textblöcke in einzelnen Feldern. Lieber mehrere kurze Einträge.

KOMPAKTHEIT:
- safetyNotes maximal 2–4 kurze Punkte.
- initialChecks maximal 3–5 kurze Punkte.
- tools maximal 6–10 Einträge und nach Zweck schreiben: "Pflicht:", "Diagnose:", "Messung:", "Spezial:", "Optional:" oder "Arbeitsplatz:".
- partsAndMaterials maximal 4–8 Einträge und nach Verwendung schreiben: "Bereitlegen:", "Nur bei Befund:", "Einmalteil:", "Dichtung:", "Betriebsstoff:" oder "Nach Herstellerdaten:".
- In partsAndMaterials keine pauschalen Ersatzteil-Empfehlungen. Ersatzteile nur nennen, wenn sie zum Arbeitsumfang gehören oder nach bestätigtem Befund plausibel sind.
- Wenn ein Ersatzteil fahrzeugabhängig ist, nicht raten: "Nach Herstellerdaten anhand VIN/Motorcode festlegen" schreiben.
- Bei Schrauben, Dichtungen, Clips, Sicherungen, Öl, Kühlmittel, Kältemittel und Bremsflüssigkeit klar sagen, ob sie zwingend neu müssen oder nur bei Demontage/Befund.
- symptoms maximal 3–6 Einträge.
- commonCauses maximal 3–6 Einträge und dort typische Fehler, mögliche Ursachen, bekannte Schwachstellen und Fehldiagnosen gemeinsam nennen.
- commonCauses bevorzugt mit Priorität beginnen: [hoch], [mittel] oder [niedrig].
- nextActions maximal 3–6 Einträge.
- measurementPlan maximal 3–8 Einträge.
- finalChecks maximal 3–8 Einträge.
- diagnosisGoal: ein klarer Satz, welches Problem bewiesen oder gelöst wird.
- missingVehicleData: fehlende Fahrzeug-/Systemdaten nennen, die die Anleitung genauer machen.
- requiredSkill: klar sagen, ob Hobby, fortgeschritten, Werkstatt oder Profi.
- escalationCriteria: wann abbrechen, nicht weiterfahren oder Fachbetrieb/Herstellerdaten nötig sind.
- proHint maximal 1–2 kurze Sätze.
- check nur ausfüllen, wenn wirklich etwas geprüft, gemessen oder kontrolliert wird.
- warning nur ausfüllen, wenn im konkreten Schritt ein echtes Risiko besteht.
- measurement pro Schritt ausfüllen, wenn ein Messwert, Testerwert, Spannungswert, Druckwert oder Sichtprüfkriterium entscheidet.
- expectedResult pro Schritt ausfüllen, wenn ein Sollzustand oder erwartetes Ergebnis sinnvoll ist.
- decision pro Schritt ausfüllen: was folgt aus gut/schlecht/abweichend?
- qualityCheck pro Schritt ausfüllen, wenn der Schritt nach Montage/Prüfung abgesichert werden muss.
- imageHint für jeden Schritt ausfüllen: knapp beschreiben, welches Bild oder welche Skizze den Schritt verständlich macht.
- imageAlt für jeden Schritt ausfüllen: kurzer Alternativtext für das Bild.
- Wenn kein konkreter Check nötig ist, check als leeren String ausgeben.
- Wenn keine konkrete Warnung nötig ist, warning als leeren String ausgeben.
- Wenn measurement/expectedResult/decision/qualityCheck nicht sinnvoll sind, jeweils leeren String ausgeben.
- Keine langen Absätze.
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
- ImageHint pro Schritt maximal ca. 150 Zeichen.
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
  8. Dichtflächen reinigen.
  9. Motor von Hand durchdrehen.
  10. Fehlerspeicher prüfen.

AUFBAU DER SCHRITTE:
Wenn passend, diese Reihenfolge verwenden:
1. Fahrzeugidentifikation und Pflichtdaten
2. Vorprüfung / Diagnose / Fehlerspeicher / Sichtprüfung
3. Vorbereitung / Batterie / Abdeckungen / Zugang
4. Demontage fahrzeugabhängig
5. Prüfung von Verschleiß- und Schadteilen
6. Montage / Einstellung / Dichtflächen / Schrauben
7. Drehmomentgruppen ohne Werte nennen
8. Endkontrolle / Fehlerspeicher / Probefahrt / Dichtheitsprüfung

QUALITÄTSREGEL:
Vor Ausgabe intern prüfen:
- Passt jeder Schritt zum Suchthema "${query}"?
- Wurde eine falsche Baugruppe genannt?
- Wurden Drehmomente erfunden?
- Wurden Schlüsselweiten erfunden?
- Sind benötigte Werkzeuge vollständig genug für Diagnose, Messung und Demontage?
- Sind Ersatzteile/Material klar als "bereitlegen", "nur bei Befund" oder "nach Herstellerdaten" eingeordnet?
- Ist die Anleitung praktisch nutzbar?
- Ist das JSON vollständig?
- Ist die Antwort kompakt genug?

${
  highRisk
    ? `
REGEL FÜR SICHERHEITS-/MOTORRELEVANTE ARBEITEN:
- Herstellerdaten einmal klar nennen, nicht ständig wiederholen.
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
- Kettenspanner, Gleitschienen, Führungsschienen, Kettenräder, Versteller, Dichtungen und Einmalschrauben berücksichtigen.
- Stirndeckel/Kettengehäuse, Ventildeckel, Ölwanne, Motorlager und Riemenscheibe nur fahrzeugabhängig nennen, wenn nicht sicher.
- Drehmomentgruppen nennen, aber keine Werte erfinden.
- Nach Montage Motor von Hand durchdrehen und Steuerzeiten erneut prüfen.
- Erster Start: Öldruck, Geräusche, Leckagen und Fehlerspeicher prüfen.
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
- Steuertrieb-Zugang, Motorlage und Demontageumfang als motorabhängig markieren.
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
- Motor-/Getriebeseite, Zugang und Ausbauumfang fahrzeugabhängig formulieren.
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
- Belagführung, Führungsbolzen, Staubmanschetten, Radnabe und Auflageflächen berücksichtigen.
- Drehmomentgruppen nennen: Radschrauben, Sattelhalter, Bremssattel/Führungsbolzen.
- Nach Montage Bremspedal vor Fahrt betätigen.
- Endkontrolle und Probefahrt/Bremsenprüfung nennen.
`
    : ""
}

${
  climate
    ? `
SPEZIALREGEL KLIMA:
- Arbeiten am Kältemittelkreis nur mit Klimaservicegerät und Sachkunde.
- Füllmenge, Ölmenge, Druckwerte und Dichtheitsprüfung nach Herstellerdaten.
- Hochdruck, Niederdruck, Lüfteransteuerung, Kompressorfreigabe, Sensorwerte und Spannungsversorgung berücksichtigen.
- Keine Kältemittelarbeiten als einfache Heimwerkerarbeit darstellen.
`
    : ""
}

${
  turbo
    ? `
SPEZIALREGEL TURBOLADER:
- Ölversorgung, Ölzulauf, Ölrücklauf, Kurbelgehäuseentlüftung und Ladedruckstrecke berücksichtigen.
- Bei wiederholtem Turboschaden Ursachenprüfung vor Teiletausch nennen.
- Ölsiebe, Hohlschrauben, Leitungen und Ölqualität motorabhängig prüfen.
- Erststart mit Öldruckaufbau und Dichtheitskontrolle nennen.
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

function buildOpenAiRequestBody(
  input: string,
  instructions: string
): Parameters<typeof client.responses.create>[0] {
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
    minScore: source === "diagnosis" ? 66 : 58,
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

    const { user, supabase } = await loadAuthenticatedUserFromRequest(request);
    const safetyProfile = await loadSafetyProfile(supabase, user);
    const safetyEvaluation = evaluateSafetyAccess(
      safetyProfile,
      classifyInstructionRisk(query || "KI-Anleitung")
    );

    await logSafetyAccess(supabase, safetyEvaluation, {
      action: "instruction_job_read",
      query: query || "KI-Anleitung",
      source: "job",
      metadata: { jobId },
    });

    if (safetyEvaluation.decision === "block") {
      return NextResponse.json(
        {
          error: safetyEvaluation.blacklistReason,
          safetyDecision: serializeSafetyEvaluation(safetyEvaluation),
        },
        { status: 403 }
      );
    }

    if (safetyEvaluation.decision === "limited") {
      return NextResponse.json({
        jobId,
        status: "completed",
        guide: createLimitedSafetyGuide(
          query || "sicherheitsrelevante Arbeit",
          safetyEvaluation
        ),
        safetyDecision: serializeSafetyEvaluation(safetyEvaluation),
      });
    }

    const response = (await client.responses.retrieve(jobId)) as OpenAI.Responses.Response & {
      incomplete_details?: { reason?: string } | null;
    };
    const status = response.status || "unknown";

    if (status === "queued" || status === "in_progress") {
      return NextResponse.json({
        jobId,
        status,
      });
    }

    if (status !== "completed") {
      const incompleteReason =
        response.incomplete_details &&
        typeof response.incomplete_details === "object" &&
        "reason" in response.incomplete_details
          ? String(response.incomplete_details.reason)
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
    const safetyGuide = applySafetyToGuide(guide, safetyEvaluation);

    let savedGuide = safetyGuide;
    let saveWarning: string | undefined;

    try {
      savedGuide = await saveGeneratedGuide(
        safetyGuide,
        query || safetyGuide.title,
        "ai"
      );
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
      safetyDecision: serializeSafetyEvaluation(safetyEvaluation),
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
    const { user, supabase } = await loadAuthenticatedUserFromRequest(request);
    const safetyProfile = await loadSafetyProfile(supabase, user);
    const safetyEvaluation = evaluateSafetyAccess(
      safetyProfile,
      classifyInstructionRisk(duplicateSearchText)
    );

    await logSafetyAccess(supabase, safetyEvaluation, {
      action: "instruction_generate_request",
      query: duplicateSearchText,
      source,
      metadata: {
        hasDiagnosisText: Boolean(diagnosisText),
      },
    });

    if (safetyEvaluation.decision === "block") {
      return NextResponse.json(
        {
          error: safetyEvaluation.blacklistReason,
          safetyDecision: serializeSafetyEvaluation(safetyEvaluation),
        },
        { status: 403 }
      );
    }

    if (safetyEvaluation.decision === "limited") {
      return NextResponse.json({
        status: "completed",
        guide: createLimitedSafetyGuide(duplicateSearchText, safetyEvaluation),
        safetyDecision: serializeSafetyEvaluation(safetyEvaluation),
      });
    }

    const reusableInstructionGuide = await findReusableInstructionGuide(
      duplicateSearchText,
      source
    );

    if (reusableInstructionGuide) {
      return NextResponse.json({
        ...reusableInstructionGuide,
        guide: applySafetyToGuide(
          reusableInstructionGuide.guide,
          safetyEvaluation
        ),
        safetyDecision: serializeSafetyEvaluation(safetyEvaluation),
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
Keine erfundenen Drehmomente, Schlüsselweiten, Spezialwerkzeugnummern oder Herstellerwerte.
Keine langen Disclaimer.
Die Antwort muss vollständig bleiben und darf nicht wegen Länge abbrechen.
`;

    const response = (await client.responses.create(
      buildOpenAiRequestBody(
        input,
        `${buildBaseInstructions(query || "KI-Anleitung", source)}

${buildSafetyPrompt(safetyEvaluation)}`
      )
    )) as OpenAI.Responses.Response;

    return NextResponse.json({
      jobId: response.id,
      status: response.status || "queued",
      safetyDecision: serializeSafetyEvaluation(safetyEvaluation),
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
