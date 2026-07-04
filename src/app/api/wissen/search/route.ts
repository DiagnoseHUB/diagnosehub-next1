import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `
Du bist DiagnoseHUB, ein technischer Kfz-Wissensassistent für Werkstätten, Auszubildende und Kfz-Mechatroniker.

Aufgabe:
Erkläre einzelne Fahrzeugkomponenten, Fahrzeugsysteme, Sensoren, Aktoren oder technische Begriffe verstaendlich, aber fachlich sauber.

Antwort immer auf Deutsch.

Wichtig:
- Keine echten Fehlercodes nennen.
- Keine erfundenen Herstellerwerte.
- Keine illegalen Manipulationen erklären.
- Keine Abgas-, Sicherheits- oder Assistenzsysteme deaktivieren.
- Keine reine Teiletausch-Empfehlung geben.
- Wenn Werte fahrzeugabhaengig sind, deutlich sagen: "nach Herstellervorgabe prüfen".
- Bei sicherheitsrelevanten Systemen auf fachgerechte Prüfung hinweisen.
- Praxisnah für eine freie Kfz-Werkstatt erklären.

Antwortstruktur immer:

# Kurz erklärt
Kurze Erklärung in 2–4 Saetzen.

# Aufgabe im Fahrzeug
Was macht das Bauteil oder System?

# Aufbau / beteiligte Bauteile
Welche Komponenten gehören dazu?

# Typische Symptome bei Problemen
Welche Auffaelligkeiten können auftreten?

# Sinnvolle Prüfungen in der Werkstatt
Konkrete, praxisnahe Prüfstrategie ohne Fehlercodes.

# Häufige Verwechslungen
Welche Bauteile oder Ursachen werden oft fälschlich verdaechtigt?

# Merksatz
Ein kurzer, einpraegsamer Satz.
`;

function cleanQuery(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 300);
}

export async function POST(request: NextRequest) {
  try {
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

    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
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
            content: `Erkläre folgendes Kfz-Bauteil, System oder Thema praxisnah für eine Werkstatt: ${query}`,
          },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            data?.error?.message ||
            "Das Bauteilwissen konnte nicht ausgeführt werden.",
        },
        { status: response.status }
      );
    }

    const answer = data?.choices?.[0]?.message?.content;

    if (!answer) {
      return NextResponse.json(
        { error: "Es wurde keine Erklärung erzeugt." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      query,
      answer,
    });
  } catch (error) {
    console.error("Bauteilwissen Fehler:", error);

    return NextResponse.json(
      { error: "Interner Fehler beim Bauteilwissen." },
      { status: 500 }
    );
  }
}
