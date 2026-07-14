import { NextResponse } from "next/server";
import { loadAuthenticatedUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type MediaUploadInput = {
  id?: unknown;
  name?: unknown;
  mimeType?: unknown;
  sizeBytes?: unknown;
  dataUrl?: unknown;
};

type MediaAnalysisRequestBody = {
  caseId?: unknown;
  context?: unknown;
  files?: unknown;
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

const MEDIA_ANALYSIS_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "summary",
    "detectedObjects",
    "damageFindings",
    "leakFindings",
    "gaugeReadings",
    "readableText",
    "risks",
    "nextChecks",
    "confidence",
    "limitations",
  ],
  properties: {
    summary: { type: "string" },
    detectedObjects: { type: "array", items: { type: "string" } },
    damageFindings: { type: "array", items: { type: "string" } },
    leakFindings: { type: "array", items: { type: "string" } },
    gaugeReadings: { type: "array", items: { type: "string" } },
    readableText: { type: "array", items: { type: "string" } },
    risks: { type: "array", items: { type: "string" } },
    nextChecks: { type: "array", items: { type: "string" } },
    confidence: { type: "string", enum: ["niedrig", "mittel", "hoch"] },
    limitations: { type: "array", items: { type: "string" } },
  },
};

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

const MAX_FILE_BYTES = 12 * 1024 * 1024;

function cleanText(value: unknown, maxLength = 3000) {
  return typeof value === "string"
    ? value.trim().replace(/\r\n/g, "\n").slice(0, maxLength)
    : "";
}

function cleanUuid(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  )
    ? value
    : "";
}

function safeFileName(value: string) {
  return (
    value
      .trim()
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 80) || "diagnose-medium"
  );
}

function extensionForMimeType(mimeType: string) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "video/mp4") return "mp4";
  if (mimeType === "video/webm") return "webm";
  if (mimeType === "video/quicktime") return "mov";
  return "jpg";
}

function parseDataUrl(dataUrl: unknown) {
  if (typeof dataUrl !== "string") {
    throw new Error("Datei konnte nicht gelesen werden.");
  }

  const match = dataUrl.match(/^data:([^;,]+);base64,([a-zA-Z0-9+/=\r\n]+)$/);

  if (!match) {
    throw new Error("Datei hat kein gültiges Upload-Format.");
  }

  const mimeType = match[1].toLowerCase();

  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error("Bitte JPG, PNG, WebP, MP4, WebM oder MOV hochladen.");
  }

  const buffer = Buffer.from(match[2].replace(/\s+/g, ""), "base64");

  if (buffer.length === 0) {
    throw new Error("Die Datei ist leer.");
  }

  if (buffer.length > MAX_FILE_BYTES) {
    throw new Error("Eine Datei darf maximal 12 MB groß sein.");
  }

  return {
    buffer,
    mimeType,
    sizeBytes: buffer.length,
    mediaType: mimeType.startsWith("video/") ? "video" : "image",
  } as const;
}

function normalizeFiles(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.slice(0, 6).map((entry) => {
    const input = entry as MediaUploadInput;
    const parsed = parseDataUrl(input.dataUrl);
    const name = cleanText(input.name, 180) || "Diagnose-Medium";

    return {
      id: cleanText(input.id, 80),
      name,
      ...parsed,
      dataUrl: input.dataUrl as string,
    };
  });
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

function parseAnalysisJson(text: string) {
  if (!text) {
    throw new Error("OpenAI hat keine auswertbare Medienanalyse geliefert.");
  }

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(
      `OpenAI hat keine gültige JSON-Antwort geliefert: ${text.slice(0, 300)}`,
    );
  }
}

function getVisionModel() {
  return process.env.OPENAI_VISION_MODEL || "gpt-4o-mini";
}

async function analyzeImages({
  apiKey,
  context,
  images,
  videoCount,
}: {
  apiKey: string;
  context: string;
  images: string[];
  videoCount: number;
}) {
  const userText = `
Aufgabe:
Analysiere Diagnosebilder für einen Kfz-Diagnosefall.

Fallkontext:
${context || "Nicht angegeben"}

Regeln:
- Erkenne Bauteile, sichtbare Schäden, Undichtigkeiten, Korrosion, Steckerschäden, Schlauchzustand, Riemenlauf, Messgeräteanzeigen und lesbaren Text.
- Trenne strikt zwischen sichtbar, wahrscheinlich und nicht sicher beurteilbar.
- Keine Reparaturfreigabe nur aus Bildern ableiten.
- Keine Teilenummern, Sollwerte oder Drehmomente erfinden.
- Bei Messgerätebildern den ablesbaren Wert nennen und Unsicherheit markieren.
- Bei Videoanlagen nur erwähnen, dass ${videoCount} Video(s) zusätzlich dokumentiert wurden; bewegte Inhalte können ohne Standbild nur eingeschränkt bewertet werden.
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
      model: getVisionModel(),
      input: [
        {
          role: "system",
          content:
            "Du bist ein vorsichtiger Kfz-Diagnosetechniker. Du beschreibst nur, was aus Bildern plausibel erkennbar ist.",
        },
        {
          role: "user",
          content,
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "diagnosehub_media_analysis",
          schema: MEDIA_ANALYSIS_JSON_SCHEMA,
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
      `OpenAI hat keine gültige JSON-Antwort geliefert: ${responseText.slice(0, 300)}`,
    );
  }

  if (!response.ok) {
    throw new Error(
      data.error?.message ||
        `Medienanalyse konnte nicht erstellt werden. Status: ${response.status}`,
    );
  }

  return parseAnalysisJson(extractResponseText(data));
}

function buildFallbackAnalysis(videoCount: number) {
  return {
    summary:
      videoCount > 0
        ? `${videoCount} Video(s) wurden als Anlage gespeichert. Für eine belastbare Analyse bitte zusätzlich klare Standbilder hochladen.`
        : "Medien wurden gespeichert, aber noch nicht KI-analysiert.",
    detectedObjects: [],
    damageFindings: [],
    leakFindings: [],
    gaugeReadings: [],
    readableText: [],
    risks: ["Medienbefund immer am Fahrzeug bestätigen."],
    nextChecks: [
      "Sichtbefund am Fahrzeug prüfen.",
      "Bei Videoanalyse ein Standbild der relevanten Stelle ergänzen.",
    ],
    confidence: "niedrig",
    limitations: [
      "Videos werden aktuell als Anlage gespeichert; die automatische Detailanalyse nutzt Standbilder.",
    ],
  };
}

export async function POST(request: Request) {
  try {
    const { user } = await loadAuthenticatedUserFromRequest(request);
    const body = (await request.json().catch(() => ({}))) as MediaAnalysisRequestBody;
    const context = cleanText(body.context, 6000);
    const caseId = cleanUuid(body.caseId);
    const files = normalizeFiles(body.files);

    if (files.length === 0) {
      return NextResponse.json(
        {
          error: "Bitte lade mindestens ein Foto oder Video hoch.",
        },
        { status: 400 },
      );
    }

    const imageFiles = files.filter((file) => file.mediaType === "image");
    const videoFiles = files.filter((file) => file.mediaType === "video");
    let analysis: Record<string, unknown>;

    if (imageFiles.length > 0 && process.env.OPENAI_API_KEY) {
      analysis = await analyzeImages({
        apiKey: process.env.OPENAI_API_KEY,
        context,
        images: imageFiles.map((file) => file.dataUrl),
        videoCount: videoFiles.length,
      });
    } else {
      analysis = buildFallbackAnalysis(videoFiles.length);
    }

    const analysisText =
      typeof analysis.summary === "string"
        ? analysis.summary
        : "Medienanalyse wurde gespeichert.";
    const supabase = createSupabaseAdminClient();
    const storedAssets = [];

    for (const file of files) {
      const extension = extensionForMimeType(file.mimeType);
      const storagePath = `${user.id}/${caseId || "draft"}/${Date.now()}-${
        file.mediaType
      }-${safeFileName(file.name)}.${extension}`;

      const upload = await supabase.storage
        .from("diagnosis-media")
        .upload(storagePath, file.buffer, {
          contentType: file.mimeType,
          upsert: false,
        });

      if (upload.error) {
        throw new Error(`Medium konnte nicht gespeichert werden: ${upload.error.message}`);
      }

      const { data, error } = await supabase
        .from("diagnosis_media_assets")
        .insert({
          user_id: user.id,
          case_id: caseId || null,
          file_name: file.name,
          media_type: file.mediaType,
          mime_type: file.mimeType,
          file_size_bytes: file.sizeBytes,
          storage_path: storagePath,
          analysis,
          analysis_text: analysisText,
          status: imageFiles.length > 0 ? "analyzed" : "needs_review",
        })
        .select(
          "id, case_id, file_name, media_type, mime_type, file_size_bytes, storage_path, analysis_text, status, created_at",
        )
        .single();

      if (error) {
        await supabase.storage.from("diagnosis-media").remove([storagePath]);
        throw new Error(`Medienbefund konnte nicht gespeichert werden: ${error.message}`);
      }

      storedAssets.push({
        id: data.id,
        caseId: data.case_id,
        name: data.file_name,
        mediaType: data.media_type,
        mimeType: data.mime_type,
        sizeBytes: data.file_size_bytes,
        storagePath: data.storage_path,
        analysisText: data.analysis_text,
        status: data.status,
        createdAt: data.created_at,
      });
    }

    return NextResponse.json({
      analysis,
      assets: storedAssets,
      warning:
        imageFiles.length === 0
          ? "Videos wurden gespeichert. Für eine genaue automatische Analyse bitte Standbilder ergänzen."
          : "",
    });
  } catch (error) {
    console.error("Medienanalyse konnte nicht erstellt werden:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Medienanalyse konnte nicht erstellt werden.",
      },
      { status: 500 },
    );
  }
}
