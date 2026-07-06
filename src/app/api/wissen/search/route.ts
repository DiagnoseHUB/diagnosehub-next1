import { NextRequest, NextResponse } from "next/server";
import { requireComponentKnowledgeAccess } from "@/lib/planAccess";

export const runtime = "nodejs";

const FALLBACK_KNOWLEDGE_MODEL = "gpt-4o-mini";
const OPENAI_TIMEOUT_MS = 45000;

type OpenAiChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

const SYSTEM_PROMPT = `
Du bist DiagnoseHUB, ein technischer Kfz-Wissensassistent für Werkstätten, Auszubildende und Kfz-Mechatroniker.

Aufgabe:
Erkläre einzelne Fahrzeugkomponenten, Fahrzeugsysteme, Sensoren, Aktoren oder technische Begriffe verständlich, aber fachlich sauber.

Antwort immer auf Deutsch.

Wichtig:
- Keine echten Fehlercodes nennen.
- Keine erfundenen Herstellerwerte.
- Keine illegalen Manipulationen erklären.
- Keine Abgas-, Sicherheits- oder Assistenzsysteme deaktivieren.
- Keine reine Teiletausch-Empfehlung geben.
- Wenn Werte fahrzeugabhängig sind, deutlich sagen: "nach Herstellervorgabe prüfen".
- Bei sicherheitsrelevanten Systemen auf fachgerechte Prüfung hinweisen.
- Praxisnah für freie Werkstätten, Auszubildende und private Schrauber erklären.

Antwortstruktur immer:

# Kurz erklärt
Kurze Erklärung in 2 bis 4 Sätzen.

# Aufgabe im Fahrzeug
Was macht das Bauteil oder System?

# Aufbau / beteiligte Bauteile
Welche Komponenten gehören dazu?

# Typische Symptome bei Problemen
Welche Auffälligkeiten können auftreten?

# Sinnvolle Prüfungen
Konkrete, praxisnahe Prüfstrategie ohne Fehlercodes.

# Häufige Verwechslungen
Welche Bauteile oder Ursachen werden oft fälschlich verdächtigt?

# Merksatz
Ein kurzer, einprägsamer Satz.
`;

function cleanQuery(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 300);
}

function shouldRetryKnowledgeModel(
  data: OpenAiChatCompletionResponse,
  model: string
) {
  if (model === FALLBACK_KNOWLEDGE_MODEL) {
    return false;
  }

  const message = (data.error?.message || "").toLowerCase();

  return (
    message.includes("model") &&
    (message.includes("not found") ||
      message.includes("does not exist") ||
      message.includes("unsupported") ||
      message.includes("invalid"))
  );
}

async function requestKnowledgeAnswer(
  apiKey: string,
  model: string,
  query: string
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 1400,
        messages: [
          {
            role: "system",
            content: SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: `Erkläre folgendes Kfz-Bauteil, System oder Thema praxisnah: ${query}`,
          },
        ],
      }),
    });

    const responseText = await response.text();
    const data = responseText
      ? (JSON.parse(responseText) as OpenAiChatCompletionResponse)
      : ({} as OpenAiChatCompletionResponse);

    return { response, data, model };
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("OpenAI hat keine gültige JSON-Antwort geliefert.");
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Bauteilwissen dauert zu lange. Bitte erneut versuchen.");
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await requireComponentKnowledgeAccess(request);

    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: 403 });
    }

    const body = await request.json();
    const query = cleanQuery(body.query);

    if (query.length < 2) {
      return NextResponse.json(
        { error: "Bitte gib mindestens 2 Zeichen ein." },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "OPENAI_API_KEY fehlt. Bitte in .env.local eintragen und den Server neu starten.",
        },
        { status: 500 }
      );
    }

    const model = process.env.OPENAI_MODEL || FALLBACK_KNOWLEDGE_MODEL;
    let completion = await requestKnowledgeAnswer(apiKey, model, query);

    if (
      !completion.response.ok &&
      shouldRetryKnowledgeModel(completion.data, model)
    ) {
      console.error(
        `Bauteilwissen-Modell ${model} nicht verfügbar, Fallback ${FALLBACK_KNOWLEDGE_MODEL} aktiv.`
      );
      completion = await requestKnowledgeAnswer(
        apiKey,
        FALLBACK_KNOWLEDGE_MODEL,
        query
      );
    }

    if (!completion.response.ok) {
      return NextResponse.json(
        {
          error:
            completion.data.error?.message ||
            "Das Bauteilwissen konnte nicht ausgeführt werden.",
        },
        { status: completion.response.status }
      );
    }

    const answer = completion.data.choices?.[0]?.message?.content;

    if (!answer) {
      return NextResponse.json(
        { error: "Es wurde keine Erklärung erzeugt." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      query,
      answer,
      model: completion.model,
    });
  } catch (error) {
    console.error("Bauteilwissen Fehler:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Interner Fehler beim Bauteilwissen.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
