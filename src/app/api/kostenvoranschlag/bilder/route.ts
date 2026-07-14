import { NextResponse } from "next/server";
import { loadAuthenticatedUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/supabaseAdmin";
import { createCommunityReputationEvent } from "@/services/communityReputation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type EstimateRequestBody = {
  title?: unknown;
  vehicleData?: unknown;
  damageDescription?: unknown;
  laborRate?: unknown;
  images?: unknown;
};

type OpenAiResponse = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  error?: {
    message?: string;
  };
};

const ESTIMATE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "summary",
    "visibleDamage",
    "notSafelyAssessableFromImages",
    "likelyParts",
    "laborOperations",
    "paintOrBodyWork",
    "checksBeforeQuote",
    "estimateRange",
    "confidence",
    "missingInformation",
    "riskNotes",
    "customerText",
  ],
  properties: {
    summary: { type: "string" },
    visibleDamage: {
      type: "array",
      items: { type: "string" },
    },
    notSafelyAssessableFromImages: {
      type: "array",
      items: { type: "string" },
    },
    likelyParts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "reason", "certainty", "newOrUsedPossible"],
        properties: {
          name: { type: "string" },
          reason: { type: "string" },
          certainty: {
            type: "string",
            enum: ["niedrig", "mittel", "hoch"],
          },
          newOrUsedPossible: { type: "string" },
        },
      },
    },
    laborOperations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["operation", "reason", "hoursMin", "hoursMax", "certainty"],
        properties: {
          operation: { type: "string" },
          reason: { type: "string" },
          hoursMin: { type: "number" },
          hoursMax: { type: "number" },
          certainty: {
            type: "string",
            enum: ["niedrig", "mittel", "hoch"],
          },
        },
      },
    },
    paintOrBodyWork: {
      type: "array",
      items: { type: "string" },
    },
    checksBeforeQuote: {
      type: "array",
      items: { type: "string" },
    },
    estimateRange: {
      type: "object",
      additionalProperties: false,
      required: ["currency", "netMin", "netMax", "grossHint", "basis"],
      properties: {
        currency: { type: "string" },
        netMin: { type: "number" },
        netMax: { type: "number" },
        grossHint: { type: "string" },
        basis: { type: "string" },
      },
    },
    confidence: {
      type: "string",
      enum: ["niedrig", "mittel", "hoch"],
    },
    missingInformation: {
      type: "array",
      items: { type: "string" },
    },
    riskNotes: {
      type: "array",
      items: { type: "string" },
    },
    customerText: { type: "string" },
  },
};

function cleanText(value: unknown, maxLength = 3000) {
  return typeof value === "string"
    ? value.trim().replace(/\r\n/g, "\n").slice(0, maxLength)
    : "";
}

function parseLaborRateCents(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.round(value * 100));
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.replace(/\./g, "").replace(",", ".").trim();
  const parsed = Number.parseFloat(normalized);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return Math.round(parsed * 100);
}

function normalizeImages(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => /^data:image\/(png|jpe?g|webp);base64,/i.test(entry))
    .filter((entry) => entry.length <= 7_500_000)
    .slice(0, 5);
}

function getOpenAiVisionModel() {
  return process.env.OPENAI_VISION_MODEL || "gpt-4o-mini";
}

function extractResponseText(data: OpenAiResponse) {
  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const outputText = data.output
    ?.flatMap((item) => item.content || [])
    .map((content) => content.text || "")
    .join("\n")
    .trim();

  return outputText || "";
}

function parseEstimateJson(text: string) {
  if (!text) {
    throw new Error("OpenAI hat keine auswertbare Antwort geliefert.");
  }

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(
      `OpenAI hat keine gültige JSON-Antwort geliefert: ${text.slice(0, 300)}`
    );
  }
}

async function requestImageEstimate({
  apiKey,
  title,
  vehicleData,
  damageDescription,
  laborRateCents,
  images,
}: {
  apiKey: string;
  title: string;
  vehicleData: string;
  damageDescription: string;
  laborRateCents: number | null;
  images: string[];
}) {
  const laborRateText = laborRateCents
    ? `${(laborRateCents / 100).toFixed(2)} EUR pro Stunde`
    : "kein Stundensatz angegeben";
  const userText = `
Aufgabe:
Erstelle einen nicht verbindlichen Kostenvoranschlag-Entwurf anhand der Bilder und Angaben.

Fahrzeugdaten:
${vehicleData || "Nicht angegeben"}

Beschreibung:
${damageDescription || "Nicht angegeben"}

Interner Titel:
${title || "Bild-Kostenschätzung"}

Stundensatz:
${laborRateText}

Regeln:
- Trenne strikt zwischen sichtbar, wahrscheinlich und nicht per Bild beurteilbar.
- Keine Herstellerzeiten, Lackzeiten, Teilepreise, Drehmomente oder Teilenummern erfinden.
- Wenn Preise unsicher sind, breite Spanne und niedrige Sicherheit ausgeben.
- Sicherheitsrelevante Schäden, Airbag, Hochvolt, Lenkung, Bremse, Karosseriestruktur und Achsgeometrie immer als Prüfpunkt nennen, wenn sie betroffen sein könnten.
- Gebrauchtteile nur als mögliche Option nennen, wenn das Bauteil dafür grundsätzlich geeignet erscheint.
- Ausgabe ist ein Entwurf. Der endgültige Kostenvoranschlag entsteht erst nach Prüfung am Fahrzeug und mit realen Teilepreisen.
`.trim();

  const content = [
    {
      type: "input_text",
      text: userText,
    },
    ...images.map((imageUrl) => ({
      type: "input_image",
      image_url: imageUrl,
    })),
  ];

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: getOpenAiVisionModel(),
      input: [
        {
          role: "system",
          content:
            "Du bist ein vorsichtiger Kfz-Serviceberater. Du erstellst strukturierte Kostenschätzungen aus Bildern, erfindest keine sicheren Preise und markierst Unsicherheit klar.",
        },
        {
          role: "user",
          content,
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "diagnosehub_image_estimate",
          schema: ESTIMATE_JSON_SCHEMA,
          strict: true,
        },
      },
    }),
  });

  const responseText = await response.text();
  let data: OpenAiResponse = {};

  try {
    data = JSON.parse(responseText) as OpenAiResponse;
  } catch {
    throw new Error(
      `OpenAI hat keine gültige JSON-Antwort geliefert: ${responseText.slice(0, 300)}`
    );
  }

  if (!response.ok) {
    throw new Error(
      data.error?.message ||
        `Bild-Kostenschätzung konnte nicht erstellt werden. Status: ${response.status}`
    );
  }

  return parseEstimateJson(extractResponseText(data));
}

export async function POST(request: Request) {
  try {
    const { user } = await loadAuthenticatedUserFromRequest(request);
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "OPENAI_API_KEY fehlt. Bitte in Vercel oder .env.local eintragen.",
        },
        { status: 500 }
      );
    }

    const body = (await request.json()) as EstimateRequestBody;
    const title = cleanText(body.title, 140);
    const vehicleData = cleanText(body.vehicleData, 2000);
    const damageDescription = cleanText(body.damageDescription, 3000);
    const images = normalizeImages(body.images);
    const laborRateCents = parseLaborRateCents(body.laborRate);

    if (images.length === 0) {
      return NextResponse.json(
        {
          error: "Bitte lade mindestens ein Bild hoch.",
        },
        { status: 400 }
      );
    }

    if (!vehicleData && !damageDescription) {
      return NextResponse.json(
        {
          error:
            "Bitte gib Fahrzeugdaten oder eine kurze Schadenbeschreibung an.",
        },
        { status: 400 }
      );
    }

    const estimate = await requestImageEstimate({
      apiKey,
      title,
      vehicleData,
      damageDescription,
      laborRateCents,
      images,
    });

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("estimate_image_cases")
      .insert({
        user_id: user.id,
        title: title || "Bild-Kostenschätzung",
        vehicle_data: vehicleData,
        damage_description: damageDescription,
        labor_rate_cents: laborRateCents,
        image_count: images.length,
        ai_result: estimate,
        status: "estimated",
      })
      .select("id, title, status, created_at, ai_result")
      .single();

    if (error) {
      throw new Error(`Kostenschätzung konnte nicht gespeichert werden: ${error.message}`);
    }

    await createCommunityReputationEvent(supabase, {
      userId: user.id,
      sourceType: "estimate_case",
      sourceId: data.id,
      points: 2,
      reason: "Bild-Kostenschätzung erstellt",
    });

    return NextResponse.json({
      case: data,
      estimate,
      disclaimer:
        "Nicht verbindlicher Entwurf. Endgültige Kosten erst nach Prüfung am Fahrzeug, echten Teilepreisen und Werkstattfreigabe.",
    });
  } catch (error) {
    console.error("Bild-Kostenschätzung konnte nicht erstellt werden:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Bild-Kostenschätzung konnte nicht erstellt werden.",
      },
      { status: 500 }
    );
  }
}
