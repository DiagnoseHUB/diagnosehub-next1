import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type SchemaImageContext = "diagnosis" | "instruction" | "learning";

type SchemaImageRequestBody = {
  context?: unknown;
  title?: unknown;
  subject?: unknown;
  details?: unknown;
};

type OpenAiImageResponse = {
  data?: Array<{
    b64_json?: string;
    url?: string;
    revised_prompt?: string;
  }>;
  error?: {
    message?: string;
  };
};

type ImageRequestBody = {
  model: string;
  prompt: string;
  size: string;
  n: number;
  quality?: string;
  output_format?: string;
};

const CONTEXT_LABELS: Record<SchemaImageContext, string> = {
  diagnosis: "Diagnosefall",
  instruction: "Werkstatt-Anleitung",
  learning: "Lerninhalt",
};

const CONTEXT_COMPOSITION: Record<SchemaImageContext, string> = {
  diagnosis:
    "diagnostic checkpoint board: left column shows the symptom as a simple icon, center columns show the inspected system with exact test points, right column shows OK/NOK decision branches.",
  instruction:
    "repair instruction checkpoint board: left column shows access area, center columns show concrete inspection points before disassembly, right column shows mounting, locking and final-check points.",
  learning:
    "learning checkpoint board: left column shows functional flow, center columns show typical measurement points, right column shows plausible and implausible OK/NOK result branches.",
};

const MARKER_ROLE_GUIDE = `
Fixed marker roles:
- P1 = first visual inspection at the most likely physical fault area.
- P2 = connector, wiring, fuse, supply voltage or ground test point.
- P3 = signal, live data, sensor plausibility or actuator command test point.
- P4 = pressure, vacuum, leak, flow, mechanical movement or load test point.
- P5 = final confirmation: clear fault, plausibility check, road-test or repeat measurement.
- M1 = multimeter icon, M2 = diagnostic scanner icon, M3 = pressure gauge / hand pump icon, M4 = smoke tester / leak finder icon.
`.trim();

const DIAGNOSIS_LAYOUT_BLUEPRINT = `
Diagnostic layout blueprint:
- Use a strict 4-column technical board.
- Column 1: symptom/source icon and first suspected area, with P1 only.
- Column 2: component access and connector/electrical checks, with P2 and M1/M2 where useful.
- Column 3: system function, sensor/actuator relation, pressure/leak/flow checks, with P3 and P4.
- Column 4: decision result path with two clean branches: OK and NOK, plus P5 as final verification.
- Add one lower measurement lane that connects P1 -> P2 -> P3 -> P4 -> P5 with numbered arrows.
- Use 2 to 4 zoom insets, each tied to a marker: connector pins, hose clamp, gasket edge, sensor tip, pressure port, ground point, leak point or actuator linkage.
- Highlight exactly 2 to 4 realistic fault candidates with small yellow warning triangles near the related marker.
- Keep the drawing orthographic or clean isometric; do not use cinematic perspective.
`.trim();

function sanitizeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function normalizeContext(value: unknown): SchemaImageContext {
  if (value === "instruction" || value === "learning") {
    return value;
  }

  return "diagnosis";
}

function getImageModel() {
  return process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
}

function getImageSize() {
  return process.env.OPENAI_IMAGE_SIZE || "1536x1024";
}

function getImageQuality() {
  return process.env.OPENAI_IMAGE_QUALITY || "high";
}

function buildSchemaPrompt({
  context,
  title,
  subject,
  details,
}: {
  context: SchemaImageContext;
  title: string;
  subject: string;
  details: string;
}) {
  return `
Create a very detailed, structured technical checkpoint diagram for DiagnoseHUB.
The marker legend is shown outside the image in the app. The image itself must be almost text-free.

Context: ${CONTEXT_LABELS[context]}
Title: ${title || subject}
Topic: ${subject}
Technical diagnosis content: ${details}

Primary composition:
- Format: professional automotive service manual plate, not a poster, not an advertisement.
- Composition type: ${CONTEXT_COMPOSITION[context]}
- The graphic must show WHERE to test and IN WHAT ORDER to test. It must not be a generic component map.
- Use a clean white/light grey background with a subtle technical grid and thin alignment guides.
- Use precise CAD-like vector line art with clear separation between components, connectors, hoses, pipes, sensors, brackets, seals, clamps and mounting points.
- Use cross-section, exploded view, flow diagram or cutaway only when it helps the test sequence.
- Show 6 to 12 relevant technical elements if enough context is available.
- Arrows must show real technical flow: air, exhaust, fuel, coolant, current, signal, vacuum, pressure or mechanical force.

${context === "diagnosis" ? DIAGNOSIS_LAYOUT_BLUEPRINT : ""}

${MARKER_ROLE_GUIDE}

Marker and structure rules:
- Place large circular markers P1, P2, P3, P4 and P5 exactly at the test locations.
- The marker sequence must read visually from left to right: P1 -> P2 -> P3 -> P4 -> P5.
- Use M1, M2, M3 or M4 only as small tool badges next to the relevant P marker.
- Add clean arrows between markers. Avoid crossing arrows.
- Decision branches may contain only OK, NOK, checkmark, cross, question mark and arrows.
- Use yellow warning triangles only near concrete suspected fault locations.
- Every inset must be connected by a thin leader line to its source marker.
- Leave enough empty spacing around markers; do not overlap markers, arrows, insets or components.

Strict text rules:
- Do not write any full words inside the image.
- Allowed text inside the image only: P1, P2, P3, P4, P5, M1, M2, M3, M4, OK, NOK.
- Do not write German words. Do not write: Sicht, Sichtprüfung, Signal, Lecktest, Stecker, Druck, Masse, DiagnoseHUB, Fehler, Leistungsverlust.
- Do not add a title, logo, title block, paragraph, legend, measurements, part numbers, torque values or invented values.
- If explanation seems necessary, replace it with icons, arrows, magnifier, multimeter, pressure gauge, smoke tester, connector-pin symbol, leak symbol or warning triangle.

Style limits:
- No photorealistic repair photo.
- No humans, no hands, no workshop photo, no brand logos, no license plates.
- No decorative 3D rendering, no comic style, no chaotic cable or hose pile.
- No invented exact manufacturer values, part numbers, torque specs or special tool numbers.
- Safety-related topics must be shown only as a neutral inspection/system overview.

Quality target:
- The result must look like a structured visual diagnostic test plan at first glance.
- Prioritize test sequence, measurement points, decision paths and typical fault locations over general system overview.
- Make the image calm, legible and mechanically plausible.
  `.trim();
}

function extractImagePayload(data: OpenAiImageResponse) {
  const image = data.data?.[0];

  if (!image) {
    throw new Error("OpenAI hat kein Bild zurückgegeben.");
  }

  if (image.b64_json) {
    return {
      imageUrl: `data:image/png;base64,${image.b64_json}`,
      revisedPrompt: image.revised_prompt || "",
    };
  }

  if (image.url) {
    return {
      imageUrl: image.url,
      revisedPrompt: image.revised_prompt || "",
    };
  }

  throw new Error("OpenAI hat kein auslesbares Bildformat geliefert.");
}

function parseOpenAiResponseText(openAiText: string) {
  if (!openAiText) {
    return {};
  }

  try {
    return JSON.parse(openAiText) as OpenAiImageResponse;
  } catch {
    throw new Error(
      `OpenAI hat keine gültige JSON-Antwort geliefert: ${openAiText.slice(
        0,
        300,
      )}`,
    );
  }
}

async function requestOpenAiImage(apiKey: string, body: ImageRequestBody) {
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  const data = parseOpenAiResponseText(text);

  return {
    response,
    data,
  };
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "OPENAI_API_KEY fehlt. Bitte in .env.local oder Vercel eintragen.",
        },
        { status: 500 },
      );
    }

    const body = (await request.json()) as SchemaImageRequestBody;
    const context = normalizeContext(body.context);
    const title = sanitizeText(body.title, 180);
    const subject = sanitizeText(body.subject, 240);
    const details = sanitizeText(body.details, 3200);

    if (subject.length < 2 && details.length < 8) {
      return NextResponse.json(
        {
          error:
            "Bitte gib ein technisches Thema oder ausreichend Kontext für die Schema-Grafik an.",
        },
        { status: 400 },
      );
    }

    const prompt = buildSchemaPrompt({
      context,
      title,
      subject: subject || title || "Technisches Werkstatt-Schema",
      details: details || subject || title,
    });

    const model = getImageModel();
    const imageSize = getImageSize();
    const imageQuality = getImageQuality();
    let usedImageSize = imageSize;
    let usedImageQuality = imageQuality;

    let imageResult = await requestOpenAiImage(apiKey, {
      model,
      prompt,
      size: imageSize,
      quality: imageQuality,
      output_format: "png",
      n: 1,
    });

    if (!imageResult.response.ok) {
      usedImageSize = "1024x1024";
      usedImageQuality = "standard";

      imageResult = await requestOpenAiImage(apiKey, {
        model,
        prompt,
        size: "1024x1024",
        n: 1,
      });
    }

    if (!imageResult.response.ok) {
      return NextResponse.json(
        {
          error:
            imageResult.data.error?.message ||
            `Schema-Grafik konnte nicht erstellt werden. Status: ${imageResult.response.status}`,
        },
        { status: imageResult.response.status },
      );
    }

    const imagePayload = extractImagePayload(imageResult.data);

    return NextResponse.json({
      ...imagePayload,
      model,
      context,
      imageSize: usedImageSize,
      imageQuality: usedImageQuality,
    });
  } catch (error) {
    console.error("Schema-Bild konnte nicht erstellt werden:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Schema-Bild konnte nicht erstellt werden.",
      },
      { status: 500 },
    );
  }
}
