import OpenAI from "openai";
import { NextResponse } from "next/server";
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

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

function formatHistory(messages: ChatMessage[]) {
  return messages
    .map((message) => {
      const speaker = message.role === "user" ? "Nutzer" : "DiagnoseHUB";
      return `${speaker}: ${message.content}`;
    })
    .join("\n\n");
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
  const text = answer.toLowerCase();

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
      "zündkerze",
      "zündkerzen",
      "zündspule",
      "zündspulen",
      "zündfunke",
      "zündanlage",
    ]);
  }

  if (engineType === "Benziner") {
    return hasForbiddenTermWithoutCorrection(answer, [
      "glühkerze",
      "glühkerzen",
      "glühsteuergerät",
    ]);
  }

  return false;
}

function buildSystemPrompt(
  engineContext: EngineContext,
  faultCodeContext: FaultCodeContext,
  retryWarning?: string
) {
  return `
Du bist DiagnoseHUB, ein spezialisierter KI-Diagnoseassistent für professionelle Kfz-Werkstätten.

Antworte immer auf Deutsch.
Antworte praxisnah, technisch korrekt und strukturiert.
Keine langen allgemeinen Erklärungen.
Keine erfundenen Hersteller-TPIs nennen.
Keine Prioritätsangaben verwenden.
Keine Teile nennen, die zum erkannten Motortyp nicht passen.
Keine exakten Herstellersollwerte erfinden. Wenn genaue Sollwerte nicht sicher bekannt sind, sage das klar und empfehle Soll/Ist-Vergleich im Diagnosetester.

Wichtig:
Der Nutzer kann Folgefragen stellen.
Kurze Folgefragen wie "Ladedruck Sollwert?", "Raildruck?", "Prüfwert?", "Wo messen?" oder "Was als nächstes?" beziehen sich auf den bisherigen Diagnoseverlauf.
Nutze dann den bisherigen Fall als Kontext und frage nicht unnötig erneut nach Fahrzeugdaten, wenn sie bereits im Verlauf stehen.

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

${retryWarning ?? ""}

Technische Regeln:

1. Wenn Motortyp Diesel:
- Niemals Zündkerzen als Ursache oder Prüfpunkt nennen.
- Niemals Zündspulen als Ursache oder Prüfpunkt nennen.
- Niemals Zündfunken oder Zündanlage als Ursache oder Prüfpunkt nennen.
- Wenn der Nutzer nach Zündkerzen fragt, klarstellen: Diesel hat keine Zündkerzen; stattdessen passende Diesel-Prüfpunkte nennen.
- Bei Startproblemen/Kaltstart maximal Glühkerzen oder Glühsteuergerät nennen.
- Bei Ruckeln, schlechtem Lauf, Leistungsverlust oder Druckproblemen bevorzugt prüfen:
  - Injektoren / Rücklaufmenge
  - Raildruck Soll/Ist
  - Kraftstofffilter / Niederdruckversorgung
  - Luftmassenmesser
  - Ladedruckregelung
  - AGR-Ventil
  - DPF-Differenzdruck
  - Ansaugsystem / Ladeluftstrecke
  - Kompression / mechanischer Zustand

2. Wenn Motortyp Benziner:
- Zündkerzen und Zündspulen dürfen genannt werden.
- Glühkerzen und Glühsteuergerät nicht als Ursache oder Prüfpunkt nennen.
- Bei TFSI/TSI/FSI außerdem berücksichtigen:
  - Falschluft / Kurbelgehäuseentlüftung
  - Injektoren
  - Hochdruckpumpe / Raildruck
  - Verkokte Einlassventile
  - Ladedruckregelung
  - Steuerzeiten / Kette

3. Wenn Motortyp unbekannt:
- Keine motortypspezifischen Bauteile blind nennen.
- Keine Zündkerzen oder Glühkerzen ohne passenden Kontext als Ursache nennen.
- Wenn nötige Daten fehlen, kurz sagen, welche Angaben fehlen.

4. Fehlercode-Regel:
- Wenn ein Fehlercode aus der internen Datenbank erkannt wurde, nutze dessen Kontext vorrangig.
- Kombiniere Fehlercode, Motortyp, Symptome und Verlauf.
- Nenne unbekannte Fehlercodes nicht als sicher erklärt, sondern fordere Hersteller-/Testertext an.

Antwortformat bei neuer Diagnose:
1. Kurze Einschätzung
2. Wahrscheinlichste Ursachen mit Prozentbereichen
3. Prüfplan
4. Benötigte Messwerte / Live-Daten
5. Hinweise

Antwortformat bei kurzer Folgefrage:
- Direkt auf die Folgefrage antworten.
- Bezug zum bisherigen Fahrzeug/Fall herstellen.
- Kurz und werkstattnah bleiben.
`;
}

async function createDiagnosisAnswer(
  engineContext: EngineContext,
  faultCodeContext: FaultCodeContext,
  messages: ChatMessage[],
  input: string,
  retryWarning?: string
) {
  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    temperature: 0.1,
    input: [
      {
        role: "system",
        content: buildSystemPrompt(
          engineContext,
          faultCodeContext,
          retryWarning
        ),
      },
      {
        role: "user",
        content: `
Bisheriger Diagnoseverlauf:
${formatHistory(messages) || "Noch kein Verlauf vorhanden."}

Aktuelle Eingabe / Folgefrage:
${input}
        `,
      },
    ],
  });

  return response.output_text;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = body.input;
    const messages = Array.isArray(body.messages)
      ? (body.messages as ChatMessage[])
      : [];

    if (!input || typeof input !== "string") {
      return NextResponse.json(
        { error: "Keine gültige Diagnose-Eingabe erhalten." },
        { status: 400 }
      );
    }

    const combinedContext = `${formatHistory(messages)}\n\nAktuelle Eingabe: ${input}`;
    const engineContext = detectEngineContext(combinedContext);
    const faultCodeContext = detectFaultCodeContext(combinedContext);

    let result = await createDiagnosisAnswer(
      engineContext,
      faultCodeContext,
      messages,
      input
    );

    let qualityCheck = "Antwort ohne technischen Konflikt erstellt.";

    if (hasTechnicalConflict(engineContext.engineType, result)) {
      qualityCheck =
        "Technischer Konflikt erkannt. Antwort wurde automatisch neu generiert.";

      result = await createDiagnosisAnswer(
        engineContext,
        faultCodeContext,
        messages,
        input,
        `
ACHTUNG: Die vorherige Antwort enthielt ein Bauteil, das zum erkannten Motortyp nicht passt.
Erzeuge die Antwort neu und beachte den Motortyp zwingend.
Bei Diesel keine Zündkerzen, Zündspulen, Zündfunken oder Zündanlage als Ursache oder Prüfpunkt nennen.
Bei Benziner keine Glühkerzen oder Glühsteuergerät als Ursache oder Prüfpunkt nennen.
        `
      );
    }

    return NextResponse.json({
      result,
      engineContext,
      faultCodeContext,
      qualityCheck,
    });
  } catch (error) {
    console.error("KI-Diagnosefehler:", error);

    return NextResponse.json(
      { error: "Die KI-Diagnose konnte nicht erstellt werden." },
      { status: 500 }
    );
  }
}