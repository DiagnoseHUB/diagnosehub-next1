import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 45;

type CaseEvaluationRequest = {
  examTitle?: unknown;
  taskTitle?: unknown;
  prompt?: unknown;
  expectedPoints?: unknown;
  maxPoints?: unknown;
  answer?: unknown;
};

type CaseEvaluationResult = {
  points: number;
  maxPoints: number;
  feedback: string;
  strengths: string[];
  improvements: string[];
  matchedExpectedPoints: string[];
  missingExpectedPoints: string[];
};

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function cleanStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function clampPoints(value: unknown, maxPoints: number) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    return 0;
  }

  return Math.min(Math.max(Math.round(parsedValue), 0), maxPoints);
}

function parseJsonObject(text: string) {
  const trimmedText = text.trim();

  try {
    return JSON.parse(trimmedText);
  } catch {
    const match = trimmedText.match(/\{[\s\S]*\}/);

    if (!match) {
      throw new Error("OpenAI hat kein JSON-Objekt geliefert.");
    }

    return JSON.parse(match[0]);
  }
}

function normalizeEvaluation(data: unknown, maxPoints: number): CaseEvaluationResult {
  const candidate = data as Partial<CaseEvaluationResult>;

  return {
    points: clampPoints(candidate.points, maxPoints),
    maxPoints,
    feedback:
      typeof candidate.feedback === "string"
        ? candidate.feedback.slice(0, 900)
        : "Die Antwort wurde bewertet.",
    strengths: cleanStringArray(candidate.strengths).slice(0, 5),
    improvements: cleanStringArray(candidate.improvements).slice(0, 5),
    matchedExpectedPoints: cleanStringArray(candidate.matchedExpectedPoints),
    missingExpectedPoints: cleanStringArray(candidate.missingExpectedPoints),
  };
}

function extractResponseText(data: unknown) {
  const candidate = data as {
    output_text?: unknown;
    output?: Array<{ content?: Array<{ text?: unknown }> }>;
  };

  if (typeof candidate.output_text === "string") {
    return candidate.output_text;
  }

  if (!Array.isArray(candidate.output)) {
    return "";
  }

  return candidate.output
    .flatMap((item) => item.content || [])
    .map((content) => (typeof content.text === "string" ? content.text : ""))
    .filter(Boolean)
    .join("\n")
    .trim();
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CaseEvaluationRequest;
    const examTitle = cleanText(body.examTitle, 120);
    const taskTitle = cleanText(body.taskTitle, 160);
    const prompt = cleanText(body.prompt, 900);
    const answer = cleanText(body.answer, 6000);
    const expectedPoints = cleanStringArray(body.expectedPoints);
    const maxPoints = Math.min(Math.max(Number(body.maxPoints) || 20, 1), 40);

    if (answer.length < 40) {
      return NextResponse.json(
        {
          error:
            "Bitte schreibe erst eine fachliche Antwort mit mehreren konkreten Prüfschritten.",
        },
        { status: 400 },
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "OPENAI_API_KEY fehlt. Bitte in .env.local eintragen und den Server neu starten.",
        },
        { status: 500 },
      );
    }

    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    const systemPrompt = `
Du bist ein fairer, strenger Kfz-Prüfer für eine Gesellenprüfung.
Bewerte die Antwort fachlich nach Erwartungshorizont.
Bewerte nicht nach schönem Schreibstil, sondern nach korrekter Diagnose-Reihenfolge, Sicherheit, Plausibilität, Messlogik, Reparaturentscheidung und Abschlussprüfung.
Keine erfundenen Herstellerwerte verlangen.
Gib nur gültiges JSON zurück.
`.trim();

    const userPrompt = `
Prüfung: ${examTitle}
Fallaufgabe: ${taskTitle}
Aufgabe: ${prompt}
Maximalpunkte: ${maxPoints}

Erwartungshorizont:
${expectedPoints.map((point, index) => `${index + 1}. ${point}`).join("\n")}

Antwort des Prüflings:
${answer}

Bewerte als JSON in exakt dieser Form:
{
  "points": 0,
  "feedback": "kurzes fachliches Feedback",
  "strengths": ["was fachlich gut war"],
  "improvements": ["was für mehr Punkte fehlt"],
  "matchedExpectedPoints": ["erfüllte Punkte aus dem Erwartungshorizont"],
  "missingExpectedPoints": ["fehlende Punkte aus dem Erwartungshorizont"]
}
`.trim();

    const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
        max_output_tokens: 1100,
      }),
    });

    const openAiText = await openAiResponse.text();
    const openAiData = openAiText ? parseJsonObject(openAiText) : {};

    if (!openAiResponse.ok) {
      return NextResponse.json(
        {
          error:
            (openAiData as { error?: { message?: string } })?.error?.message ||
            `OpenAI API Fehler. Status: ${openAiResponse.status}`,
        },
        { status: openAiResponse.status },
      );
    }

    const answerText = extractResponseText(openAiData);

    if (!answerText) {
      return NextResponse.json(
        { error: "Die KI hat keine Bewertung erzeugt." },
        { status: 502 },
      );
    }

    const evaluation = normalizeEvaluation(parseJsonObject(answerText), maxPoints);

    return NextResponse.json({
      evaluation,
    });
  } catch (error) {
    console.error("Fallaufgabe konnte nicht bewertet werden:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Fallaufgabe konnte nicht bewertet werden.",
      },
      { status: 500 },
    );
  }
}
