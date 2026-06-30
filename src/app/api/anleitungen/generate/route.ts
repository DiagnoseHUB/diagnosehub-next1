import OpenAI from "openai";
import { NextResponse } from "next/server";

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

function slugify(value: string) {
  return value
    .toLowerCase()
    .replaceAll("ä", "ae")
    .replaceAll("ö", "oe")
    .replaceAll("ü", "ue")
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

function normalizeStringArray(value: unknown, fallback: string[], maxItems = 14) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const cleanedItems = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
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
  if (!Array.isArray(value)) {
    return [
      {
        title: "Fahrzeug eindeutig identifizieren",
        description:
          "Fahrzeugmodell, Baujahr, Motorisierung, Motorkennbuchstaben, Getriebeart und relevante Ausstattungscodes erfassen.",
        warning:
          "Ohne eindeutige Fahrzeugidentifikation keine fahrzeugspezifische Reparaturfreigabe ableiten.",
      },
      {
        title: "Herstellerdaten prüfen",
        description:
          "Reparaturleitfaden, Spezialwerkzeug, Einmalschrauben, Dichtmittel, Drehmomente und Anzugswinkel vor Arbeitsbeginn prüfen.",
      },
    ];
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

      return {
        title: rawStep.title.trim(),
        description: rawStep.description.trim(),
        check:
          typeof rawStep.check === "string" && rawStep.check.trim()
            ? rawStep.check.trim()
            : undefined,
        warning:
          typeof rawStep.warning === "string" && rawStep.warning.trim()
            ? rawStep.warning.trim()
            : undefined,
      };
    })
    .filter((step): step is GuideStep => Boolean(step))
    .slice(0, 45);

  return steps.length > 0
    ? steps
    : [
        {
          title: "Fahrzeug eindeutig identifizieren",
          description:
            "Fahrzeugmodell, Baujahr, Motorisierung und Motorkennbuchstaben erfassen.",
        },
      ];
}

function normalizeGuide(rawGuide: unknown, query: string): Guide {
  const raw =
    rawGuide && typeof rawGuide === "object"
      ? (rawGuide as Partial<Guide>)
      : {};

  const title =
    typeof raw.title === "string" && raw.title.trim()
      ? raw.title.trim().slice(0, 160)
      : `KI-Anleitung: ${query}`;

  const slugBase = slugify(title || query) || `ki-anleitung-${Date.now()}`;

  return {
    id: `ki-${Date.now()}`,
    slug: `ki-${slugBase}`,
    title,
    subtitle:
      typeof raw.subtitle === "string" && raw.subtitle.trim()
        ? raw.subtitle.trim().slice(0, 650)
        : "KI-generierte Werkstatt-Anleitung. Herstellerdaten, Motorkennbuchstaben, Spezialwerkzeug und Drehmomente müssen geprüft werden.",
    category: normalizeCategory(raw.category),
    difficulty: normalizeDifficulty(raw.difficulty),
    estimatedTime:
      typeof raw.estimatedTime === "string" && raw.estimatedTime.trim()
        ? raw.estimatedTime.trim().slice(0, 120)
        : "Fahrzeugabhängig",
    vehicleApplicability:
      typeof raw.vehicleApplicability === "string" &&
      raw.vehicleApplicability.trim()
        ? raw.vehicleApplicability.trim().slice(0, 750)
        : "Nur nach eindeutiger Fahrzeugidentifikation, Motorkennbuchstaben und Herstellerunterlagen anwenden.",
    tags: normalizeStringArray(raw.tags, [query, "KI-Anleitung"], 12),
    symptoms: normalizeStringArray(
      raw.symptoms,
      ["Fehlerbild anhand der Kundenbeanstandung eingrenzen"],
      14
    ),
    tools: normalizeStringArray(
      raw.tools,
      [
        "Diagnosetester",
        "Hersteller-Reparaturleitfaden",
        "Drehmomentschlüssel",
        "geeignetes Handwerkzeug",
        "Spezialwerkzeug fahrzeugabhängig",
      ],
      16
    ),
    safetyNotes: normalizeStringArray(
      raw.safetyNotes,
      [
        "Herstellervorgaben, Arbeitsschutz und sicherheitsrelevante Systeme beachten.",
        "Keine Drehmomente oder Einstellwerte ohne geprüfte Herstellerdaten übernehmen.",
      ],
      14
    ),
    initialChecks: normalizeStringArray(
      raw.initialChecks,
      [
        "Fahrzeug, Baujahr, Motorisierung und Motorkennbuchstaben eindeutig erfassen.",
        "Fehlerspeicher vollständig auslesen.",
        "Hersteller-Reparaturleitfaden, Spezialwerkzeug und Drehmomente prüfen.",
      ],
      14
    ),
    steps: normalizeSteps(raw.steps),
    commonCauses: normalizeStringArray(
      raw.commonCauses,
      ["Ursache erst nach Messung, Sichtprüfung und Herstellerdaten festlegen."],
      14
    ),
    nextActions: normalizeStringArray(
      raw.nextActions,
      [
        "Vor Arbeitsbeginn Motorkennbuchstaben, Reparaturleitfaden, Spezialwerkzeug und Drehmomentdaten prüfen.",
      ],
      12
    ),
    proHint:
      typeof raw.proHint === "string" && raw.proHint.trim()
        ? raw.proHint.trim().slice(0, 900)
        : "KI-generierte Anleitung niemals als alleinige Reparaturfreigabe verwenden. Besonders bei Steuertrieb, Bremse, Lenkung, Airbag, Hochvolt, Kältemittel und Motorinnenarbeiten immer Herstellerdaten abgleichen.",
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
    "fuehrungsschiene",
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
    "kältemittel",
    "kaeltemittel",
    "kompressor",
    "verdampfer",
    "kondensator",
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
    "kältemittel",
    "kaeltemittel",
  ]);
}

function guideToText(guide: Guide) {
  return [
    guide.title,
    guide.subtitle,
    guide.vehicleApplicability,
    ...guide.tags,
    ...guide.symptoms,
    ...guide.tools,
    ...guide.safetyNotes,
    ...guide.initialChecks,
    ...guide.commonCauses,
    ...guide.nextActions,
    guide.proHint || "",
    ...guide.steps.flatMap((step) => [
      step.title,
      step.description,
      step.check || "",
      step.warning || "",
    ]),
  ]
    .join(" ")
    .toLowerCase();
}

function validateGuideQuality(guide: Guide, query: string) {
  const issues: string[] = [];
  const guideText = guideToText(guide);
  const timingChain = isTimingChainTopic(query);
  const timingBelt = isTimingBeltTopic(query);

  if (timingChain && !timingBelt) {
    const forbiddenPhrases = [
      "zahnriemen abnehmen",
      "zahnriemen ausbauen",
      "zahnriemen entfernen",
      "zahnriemen demontieren",
      "zahnriemen lösen",
      "zahnriemen loesen",
    ];

    const hasForbiddenTimingBeltPhrase = forbiddenPhrases.some((phrase) =>
      guideText.includes(phrase)
    );

    if (hasForbiddenTimingBeltPhrase) {
      issues.push(
        "Bei Steuerkettenarbeiten darf kein Arbeitsschritt 'Zahnriemen abnehmen/ausbauen/demontieren' enthalten sein. Korrekt ist je nach Zugang Keilrippenriemen/Nebenaggregateriemen."
      );
    }

    if (guide.steps.length < 24) {
      issues.push(
        "Bei Steuerkettenarbeiten muss die Anleitung mindestens 24 konkrete Einzelschritte enthalten."
      );
    }

    if (!guideText.includes("motorkennbuchstabe")) {
      issues.push(
        "Bei Steuerkettenarbeiten muss der Motorkennbuchstabe zwingend als Pflichtprüfung genannt werden."
      );
    }

    if (
      !guideText.includes("keilrippenriemen") &&
      !guideText.includes("nebenaggregateriemen")
    ) {
      issues.push(
        "Bei Steuerkettenarbeiten muss der Nebenaggregateriemen/Keilrippenriemen korrekt benannt werden."
      );
    }

    if (!guideText.includes("riemenspanner")) {
      issues.push(
        "Bei Steuerkettenarbeiten muss der Keilrippenriemenspanner/Nebenaggregateriemenspanner als konkreter Arbeitsschritt berücksichtigt werden."
      );
    }

    if (
      !guideText.includes("sperrwerkzeug") &&
      !guideText.includes("abstecken")
    ) {
      issues.push(
        "Bei Steuerkettenarbeiten muss erwähnt werden, dass der Riemenspanner fahrzeugabhängig mit geeignetem Sperrwerkzeug abgesteckt werden kann."
      );
    }

    if (!guideText.includes("riemenscheibe")) {
      issues.push(
        "Bei Steuerkettenarbeiten muss die Riemenscheibe/Kurbelwellenriemenscheibe als fahrzeugabhängig zu prüfender Demontageschritt genannt werden."
      );
    }

    if (
      !guideText.includes("stirndeckel") &&
      !guideText.includes("kettengehäuse") &&
      !guideText.includes("kettengehaeuse")
    ) {
      issues.push(
        "Bei Steuerkettenarbeiten muss Stirndeckel/Kettengehäuse als fahrzeugabhängig zu prüfender Bereich berücksichtigt werden."
      );
    }

    if (
      !guideText.includes("dichtfläche") &&
      !guideText.includes("dichtflaeche")
    ) {
      issues.push(
        "Bei Steuerkettenarbeiten müssen Dichtflächen von Stirndeckel/Kettengehäuse/Ventildeckel als eigener Prüf- und Reinigungsschritt genannt werden."
      );
    }

    if (
      !guideText.includes("von hand durchdrehen") &&
      !guideText.includes("motor von hand")
    ) {
      issues.push(
        "Bei Steuerkettenarbeiten muss nach Montage das Durchdrehen des Motors von Hand und erneute Steuerzeitenprüfung enthalten sein."
      );
    }

    if (
      guideText.includes("zugang schaffen") ||
      guideText.includes("bauteile demontieren") ||
      guideText.includes("alles wieder montieren")
    ) {
      issues.push(
        "Die Anleitung enthält zu grobe Sammelschritte. Jeder Arbeitsschritt muss einzeln beschrieben werden."
      );
    }
  }

  if (isHighRiskTopic(query) && !guideText.includes("herstellerdaten")) {
    issues.push(
      "Bei sicherheits- oder motorrelevanten Arbeiten muss ausdrücklich auf Herstellerdaten verwiesen werden."
    );
  }

  if (isHighRiskTopic(query) && !guideText.includes("drehmoment")) {
    issues.push(
      "Bei sicherheits- oder motorrelevanten Arbeiten müssen relevante Drehmoment-/Anzugswinkelgruppen genannt werden, ohne Werte zu erfinden."
    );
  }

  return issues;
}

function buildBaseInstructions(query: string, source: string) {
  const timingChain = isTimingChainTopic(query);
  const timingBelt = isTimingBeltTopic(query);
  const brake = isBrakeTopic(query);
  const climate = isClimateTopic(query);

  return `
Du bist DiagnoseHUB, ein technischer KI-Assistent für professionelle Kfz-Werkstätten.

ZIEL:
Erstelle eine praktisch nutzbare Werkstatt-Anleitung.
Die Anleitung muss fachlich sauber, vorsichtig, logisch und sehr detailliert aufgebaut sein.
Sie darf keine erfundenen Herstellerdaten enthalten.

GRUNDREGELN:
- Arbeite wie ein erfahrener Kfz-Meister mit Reparaturleitfaden.
- Prüfe zuerst Fahrzeug, Baujahr, Motorisierung, Motorkennbuchstaben, Getriebeart und relevante Ausstattung.
- Wenn Angaben fehlen, nenne sie als Pflichtprüfung in der Anleitung.
- Erfinde keine Drehmomente, Anzugswinkel, Spezialwerkzeugnummern, Füllmengen, Schlüsselweiten oder Einstellwerte.
- Wenn solche Werte relevant sind, nenne die betroffene Bauteilgruppe und schreibe: "nach Herstellerdaten prüfen".
- Keine endgültige Diagnose ohne Prüfung behaupten.
- Keine illegalen Manipulationen beschreiben.
- Keine DPF-/OPF-/AdBlue-/AGR-Deaktivierung.
- Begriffe exakt verwenden. Keine Baugruppen verwechseln.

MIKROSCHRITT-MODUS:
- Schreibe keine groben Sammelschritte.
- Jeder Schritt muss eine konkrete physische Handlung beschreiben.
- Ein Schritt darf nicht mehrere große Arbeiten zusammenfassen.
- Schlechte Beispiele: "Zugang schaffen", "Bauteile demontieren", "Steuerkette ersetzen", "alles montieren".
- Gute Beispiele:
  1. Motorabdeckung entfernen.
  2. Fahrzeug vorn rechts anheben und standsicher abstützen, falls Zugang über Radhaus nötig ist.
  3. Radhausschale fahrzeugabhängig lösen und zur Seite nehmen.
  4. Verlauf des Keilrippenriemens dokumentieren oder fotografieren.
  5. Keilrippenriemenspanner mit geeignetem Ringschlüssel, Steckschlüssel oder Riemenspannerwerkzeug entspannen.
  6. Spanner fahrzeugabhängig mit passendem Sperrwerkzeug abstecken, falls vorgesehen.
  7. Keilrippenriemen abnehmen und auf Risse, Ausfransungen und Ölspuren prüfen.
  8. Kurbelwellenriemenscheibe fahrzeugabhängig lösen/demontieren, Drehmoment und Arretierung nach Herstellerdaten prüfen.
  9. Stirndeckel/Kettengehäuse fahrzeugabhängig freilegen.
  10. Dichtflächen vor Montage reinigen und auf Beschädigung prüfen.

WERKZEUGHINWEISE:
- Nenne bei jedem Schritt das benötigte Werkzeug oder Arbeitsmittel, wenn sinnvoll.
- Wenn die exakte Schlüsselweite nicht sicher ist, schreibe: "passende Schlüsselweite am Fahrzeug prüfen".
- Keine erfundenen Schlüsselweiten, Drehmomente, Spezialwerkzeugnummern oder Anzugswinkel.
- Zulässig sind Formulierungen wie:
  "mit geeignetem Ringschlüssel/Steckschlüssel",
  "mit passendem Riemenspannerwerkzeug",
  "mit geeignetem Absteck-/Sperrwerkzeug",
  "mit Drehmomentschlüssel nach Herstellerdaten".
- Bei kritischen Verschraubungen immer die Schraubgruppe nennen und "Drehmoment/Anzugswinkel nach Herstellerdaten prüfen" schreiben.

DETAILTIEFE:
- Für einfache Arbeiten: 10–18 Schritte.
- Für mittlere Arbeiten: 18–30 Schritte.
- Für Steuertrieb, Motorinnenarbeiten, Bremse, Lenkung, Hochvolt, Airbag oder Klimakreis: 25–45 Schritte.
- Wenn die Anleitung kürzer wäre, zerlege die Arbeit weiter in echte Einzelschritte.

AUFBAU DER SCHRITTE:
Die Schrittfolge soll, wenn passend, diese Logik haben:
1. Fahrzeugidentifikation und Pflichtdaten
2. Vorprüfung / Diagnose / Fehlerspeicher / Sichtprüfung
3. Vorbereitung / Batterie / Abdeckungen / Zugang
4. Demontage fahrzeugabhängig
5. Prüfung von Verschleiß-/Schadteilen
6. Montage / Einstellung / Dichtflächen / Schrauben
7. Drehmoment-/Anzugswinkelgruppen nach Herstellerdaten
8. Endkontrolle / Fehlerspeicher / Probefahrt / Dichtheitsprüfung

QUALITÄTSREGEL:
Vor Ausgabe intern prüfen:
- Passt jeder Schritt zum Suchthema "${query}"?
- Wurde eine falsche Baugruppe genannt?
- Wurden Drehmomente erfunden?
- Wurden Schlüsselweiten erfunden?
- Sind Pflichtprüfungen enthalten?
- Sind sicherheitsrelevante Hinweise enthalten?
- Ist die Anleitung für eine Werkstatt praktisch nutzbar?
- Sind die Schritte kleinteilig genug?
- Wird Werkzeug oder Arbeitsmittel genannt, wenn sinnvoll?

${
  timingChain && !timingBelt
    ? `
SPEZIALREGEL STEUERKETTE / STEUERTRIEB:
- Steuerkette ist nicht Zahnriemen.
- Verwende nicht "Zahnriemen abnehmen", "Zahnriemen ausbauen" oder "Zahnriemen demontieren".
- Falls Zugang geschaffen werden muss, heißt es Keilrippenriemen oder Nebenaggregateriemen.
- Motorkennbuchstabe ist Pflicht.
- Steuerzeiten, OT-Stellung, Kurbelwellen-/Nockenwellenarretierung und Spezialwerkzeug prüfen.
- Kettenspanner, Gleitschienen, Führungsschienen, Kettenräder, Versteller, Dichtungen und Einmalschrauben berücksichtigen.
- Stirndeckel/Kettengehäuse und Dichtflächen als fahrzeugabhängig zu prüfenden Bereich nennen.
- Riemenscheibe, Motorlager, Ventildeckel, Ölwanne, Nockenwellenversteller und Kurbelwellenrad nur als fahrzeugabhängig markieren.
- Drehmomente/Anzugswinkel nicht erfinden.
- Betroffene Drehmomentgruppen nennen: Kettengehäuse/Stirndeckel, Riemenscheibe, Motorlager, Versteller, Spanner, Gleitschienen, Ventildeckel, Ölwanne, Nebenaggregate.
- Nach Montage Motor von Hand durchdrehen und Steuerzeiten erneut prüfen.
- Erster Start: Öldruck, Geräusche, Leckagen, Fehlerspeicher und Lernwerte prüfen.
- Die Anleitung muss bei Steuerkettenarbeiten eine ausführliche Demontagereihenfolge enthalten.
- Folgende Punkte müssen, soweit fahrzeugabhängig relevant, als eigene Schritte erscheinen:
  - Fahrzeugdaten und Motorkennbuchstabe prüfen.
  - Batterie/Startfreigabe sichern, wenn erforderlich.
  - Motorabdeckung entfernen.
  - Luftführung/Ansaugteile fahrzeugabhängig demontieren.
  - Keilrippenriemenverlauf dokumentieren.
  - Keilrippenriemenspanner mit geeignetem Werkzeug entspannen.
  - Spanner mit Sperrwerkzeug abstecken, falls vorgesehen.
  - Keilrippenriemen abnehmen.
  - Riemenscheibe/Kurbelwellenriemenscheibe fahrzeugabhängig demontieren.
  - Ventildeckel fahrzeugabhängig demontieren.
  - Stirndeckel/Kettengehäuse fahrzeugabhängig demontieren.
  - Motor auf OT stellen.
  - Kurbelwelle und Nockenwelle nach Herstellerdaten arretieren.
  - Steuerzeiten vor Demontage prüfen.
  - Kettenspanner entspannen/demontieren.
  - Gleitschienen/Führungsschienen prüfen und ersetzen.
  - Steuerkette und Kettenräder/Versteller prüfen.
  - Dichtflächen reinigen.
  - Einmalschrauben und Dichtungen ersetzen.
  - Steuertrieb nach Herstellerdaten montieren.
  - Drehmomentgruppen ohne Werte nennen.
  - Motor mindestens zwei Umdrehungen von Hand durchdrehen.
  - Steuerzeiten erneut prüfen.
  - Erster Start mit Öldruck-/Geräusch-/Leckagekontrolle.
  - Fehlerspeicher löschen/prüfen und Probefahrt durchführen.
`
    : ""
}

${
  brake
    ? `
SPEZIALREGEL BREMSE:
- Achsweise arbeiten.
- Bremsflüssigkeitsstand beachten.
- Führungen, Auflageflächen, Radnabe, Staubmanschetten und Belagführung prüfen/reinigen.
- Drehmomentgruppen nennen: Radschrauben, Sattelhalter, Bremssattel, Führungsbolzen nach Herstellerdaten.
- Nach Montage Bremspedal vor Fahrt betätigen.
- Endkontrolle und Probefahrt/Bremsenprüfung nennen.
- Keine Sammelschritte. Rad abnehmen, Sichtprüfung, Sattel lösen, Sattel sichern, Beläge entnehmen, Halter lösen, Scheibe abnehmen, Radnabe reinigen usw. einzeln aufführen.
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

JSON-REGELN:
- Alle Felder müssen vorhanden sein.
- "check" und "warning" bei jedem Schritt immer ausgeben.
- Wenn kein Prüfpunkt nötig ist, "check": "" verwenden.
- Wenn keine Warnung nötig ist, "warning": "" verwenden.
- Keine Markdown-Codeblöcke.
- Kein Text außerhalb des JSON.
- Keine Kommentare im JSON.

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

  if (Number.isNaN(value) || value < 2000) {
    return 12000;
  }

  return value;
}

function modelSupportsReasoning(model: string) {
  return (
    model.startsWith("gpt-5") ||
    model.startsWith("o1") ||
    model.startsWith("o3") ||
    model.startsWith("o4")
  );
}

async function generateGuideWithOpenAi(input: string, instructions: string) {
  const model = process.env.OPENAI_MODEL || "gpt-5.5";

  const requestBody = {
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
  };

  const response = await client.responses.create(requestBody as any);
  const outputText = response.output_text || "";

  if (!outputText) {
    throw new Error("Die KI hat keine auslesbare JSON-Antwort geliefert.");
  }

  try {
    return JSON.parse(outputText);
  } catch {
    try {
      const jsonText = extractJsonObject(outputText);
      return JSON.parse(jsonText);
    } catch {
      throw new Error(
        `Die KI-Antwort war trotz JSON-Schema nicht parsebar. Antwort-Auszug: ${outputText.slice(
          0,
          700
        )}`
      );
    }
  }
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Anleitungen-KI API ist erreichbar.",
  });
}

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          error:
            "OPENAI_API_KEY fehlt. Bitte in .env.local eintragen und Server neu starten.",
        },
        { status: 500 }
      );
    }

    const body = (await request.json()) as GenerateInstructionRequestBody;

    const query = sanitizeText(body.query, 900);
    const diagnosisText = sanitizeText(body.diagnosisText, 7000);
    const source = body.source === "diagnosis" ? "diagnosis" : "search";

    if (!query && !diagnosisText) {
      return NextResponse.json(
        {
          error: "Suchbegriff oder Diagnoseinhalt fehlt.",
        },
        { status: 400 }
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
Erstelle eine möglichst präzise, sichere und kleinschrittige Werkstatt-Anleitung.
Wenn eine Information fahrzeugabhängig ist oder nur mit Herstellerdaten sicher ist, markiere sie ausdrücklich.
Keine erfundenen Drehmomente, Schlüsselweiten, Spezialwerkzeugnummern oder Herstellerwerte.
`;

    const firstParsedGuide = await generateGuideWithOpenAi(
      input,
      buildBaseInstructions(query || "KI-Anleitung", source)
    );

    let guide = normalizeGuide(firstParsedGuide, query || "KI-Anleitung");
    const qualityIssues = validateGuideQuality(guide, query);

    if (qualityIssues.length > 0) {
      const correctionInput = `
Die vorherige Anleitung hatte Qualitätsprobleme und muss korrigiert werden.

Ursprünglicher Suchbegriff:
${query}

Qualitätsprobleme:
${qualityIssues.map((issue, index) => `${index + 1}. ${issue}`).join("\n")}

Vorherige Anleitung als JSON:
${JSON.stringify(guide, null, 2)}

Aufgabe:
Erstelle die Anleitung neu und behebe alle Qualitätsprobleme.
Erhöhe die Detailtiefe deutlich.
Jeder einzelne Arbeitsschritt muss separat aufgeführt werden.
Antworte wieder ausschließlich im vorgegebenen JSON-Schema.
`;

      const correctedParsedGuide = await generateGuideWithOpenAi(
        correctionInput,
        buildBaseInstructions(query || "KI-Anleitung", source)
      );

      guide = normalizeGuide(correctedParsedGuide, query || "KI-Anleitung");
    }

    return NextResponse.json({
      guide,
    });
  } catch (error) {
    console.error("KI-Anleitung konnte nicht erstellt werden:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Die KI-Anleitung konnte nicht erstellt werden.",
      },
      { status: 500 }
    );
  }
}