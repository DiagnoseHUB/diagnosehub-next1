import OpenAI from "openai";
import { NextResponse } from "next/server";
import {
  createClient as createSupabaseClient,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";
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
import {
  PLAN_DAILY_LIMITS,
  PLAN_LABELS,
  isValidUserPlan,
  type UserPlan,
} from "@/config/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type WorkshopProfileDatabaseRow = {
  id: string;
  full_name: string;
  workshop_name: string;
  email: string;
  role: string;
  plan: UserPlan;
  created_at: string;
  updated_at: string;
};

type DiagnosisUsageDatabaseRow = {
  id: string;
  user_id: string;
  usage_date: string;
  diagnosis_count: number;
  created_at: string;
  updated_at: string;
};

type UsageControl = {
  enabled: boolean;
  source: "disabled" | "supabase";
  supabase: SupabaseClient | null;
  user: User | null;
  plan: UserPlan;
  planLabel: string;
  todayKey: string;
  countBefore: number;
  maxDailyDiagnoses: number;
};

type UsageLimitPayload = {
  enabled: boolean;
  source: "disabled" | "supabase";
  plan: UserPlan;
  planLabel: string;
  todayKey: string;
  countBefore: number;
  countAfter: number | null;
  maxDailyDiagnoses: number;
  remainingBefore: number;
  remainingAfter: number | null;
  limitReached: boolean;
  warning?: string;
};

function getTodayKeyGermany() {
  const currentDateGermany = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const currentMonth = currentDateGermany.slice(0, 7);

  return `${currentMonth}-01`;
}

function sanitizeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function formatHistory(messages: ChatMessage[]) {
  return messages
    .map((message) => {
      const speaker = message.role === "user" ? "Nutzer" : "DiagnoseHUB";
      return `${speaker}: ${message.content}`;
    })
    .join("\n\n");
}

function normalizeMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .flatMap((entry): ChatMessage[] => {
      if (!entry || typeof entry !== "object") {
        return [];
      }

      const candidate = entry as {
        role?: unknown;
        content?: unknown;
      };

      if (
        (candidate.role === "user" || candidate.role === "assistant") &&
        typeof candidate.content === "string"
      ) {
        const content = sanitizeText(candidate.content, 1600);

        if (!content) {
          return [];
        }

        return [
          {
            role: candidate.role,
            content,
          },
        ];
      }

      return [];
    })
    .slice(-8);
}

function createAuthenticatedSupabaseClient(accessToken: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL fehlt in .env.local");
  }

  if (!supabaseKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY oder NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY fehlt in .env.local"
    );
  }

  return createSupabaseClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

async function loadUserFromAccessToken(
  supabase: SupabaseClient,
  accessToken: string
) {
  const { data, error } = await supabase.auth.getUser(accessToken);

  if (error) {
    throw new Error(`Supabase-Session ungültig: ${error.message}`);
  }

  if (!data.user) {
    throw new Error("Keine gültige Supabase-Session gefunden.");
  }

  return data.user;
}

async function loadUserPlanFromSupabase(
  supabase: SupabaseClient,
  user: User
): Promise<UserPlan> {
  const { data, error } = await supabase
    .from("workshop_profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error(`Plan konnte nicht geladen werden: ${error.message}`);
  }

  if (!data) {
    return "free";
  }

  const profile = data as WorkshopProfileDatabaseRow;

  if (!isValidUserPlan(profile.plan)) {
    return "free";
  }

  return profile.plan;
}

async function loadDiagnosisUsageCount(
  supabase: SupabaseClient,
  user: User,
  todayKey: string
) {
  const { data, error } = await supabase
    .from("diagnosis_usage")
    .select("*")
    .eq("user_id", user.id)
    .eq("usage_date", todayKey)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Nutzungszähler konnte nicht geladen werden: ${error.message}`
    );
  }

  if (!data) {
    return 0;
  }

  const usageRow = data as DiagnosisUsageDatabaseRow;

  return usageRow.diagnosis_count || 0;
}

async function saveDiagnosisUsageCount(
  supabase: SupabaseClient,
  user: User,
  todayKey: string,
  nextCount: number
) {
  const { data, error } = await supabase
    .from("diagnosis_usage")
    .upsert(
      {
        user_id: user.id,
        usage_date: todayKey,
        diagnosis_count: nextCount,
      },
      {
        onConflict: "user_id,usage_date",
      }
    )
    .select("*")
    .single();

  if (error) {
    throw new Error(
      `Nutzungszähler konnte nicht gespeichert werden: ${error.message}`
    );
  }

  const usageRow = data as DiagnosisUsageDatabaseRow;

  return usageRow.diagnosis_count || nextCount;
}

async function resolveUsageControl(
  accessToken: string,
  useServerUsageTracking: boolean
): Promise<UsageControl> {
  const todayKey = getTodayKeyGermany();

  if (!useServerUsageTracking) {
    return {
      enabled: false,
      source: "disabled",
      supabase: null,
      user: null,
      plan: "free",
      planLabel: PLAN_LABELS.free,
      todayKey,
      countBefore: 0,
      maxDailyDiagnoses: PLAN_DAILY_LIMITS.free,
    };
  }

  if (!accessToken) {
    throw new Error(
      "Für serverseitige Plan-Limits fehlt der Supabase-Zugriffstoken."
    );
  }

  const supabase = createAuthenticatedSupabaseClient(accessToken);
  const user = await loadUserFromAccessToken(supabase, accessToken);
  const plan = await loadUserPlanFromSupabase(supabase, user);
  const countBefore = await loadDiagnosisUsageCount(supabase, user, todayKey);

  return {
    enabled: true,
    source: "supabase",
    supabase,
    user,
    plan,
    planLabel: PLAN_LABELS[plan],
    todayKey,
    countBefore,
    maxDailyDiagnoses: PLAN_DAILY_LIMITS[plan],
  };
}

function buildUsageLimitPayload(
  usageControl: UsageControl,
  countAfter: number | null,
  warning?: string
): UsageLimitPayload {
  const effectiveCountAfter = countAfter ?? null;

  return {
    enabled: usageControl.enabled,
    source: usageControl.source,
    plan: usageControl.plan,
    planLabel: usageControl.planLabel,
    todayKey: usageControl.todayKey,
    countBefore: usageControl.countBefore,
    countAfter: effectiveCountAfter,
    maxDailyDiagnoses: usageControl.maxDailyDiagnoses,
    remainingBefore: Math.max(
      usageControl.maxDailyDiagnoses - usageControl.countBefore,
      0
    ),
    remainingAfter:
      effectiveCountAfter === null
        ? null
        : Math.max(usageControl.maxDailyDiagnoses - effectiveCountAfter, 0),
    limitReached:
      usageControl.enabled &&
      usageControl.countBefore >= usageControl.maxDailyDiagnoses,
    warning,
  };
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
      "zuendkerze",
      "zuendkerzen",
      "zuendspule",
      "zuendspulen",
      "zuendfunke",
      "zuendanlage",
    ]);
  }

  if (engineType === "Benziner") {
    return hasForbiddenTermWithoutCorrection(answer, [
      "gluehkerze",
      "gluehkerzen",
      "gluehsteuergerät",
    ]);
  }

  return false;
}

function getDiagnosisModel() {
  return (
    process.env.OPENAI_DIAGNOSIS_MODEL ||
    process.env.OPENAI_MODEL ||
    "gpt-5.5"
  );
}

function modelSupportsReasoning(model: string) {
  return (
    model.startsWith("gpt-5") ||
    model.startsWith("o1") ||
    model.startsWith("o3") ||
    model.startsWith("o4")
  );
}

function getDiagnosisReasoningEffort(): "minimal" | "low" | "medium" | "high" {
  const effort =
    process.env.OPENAI_DIAGNOSIS_REASONING_EFFORT ||
    process.env.OPENAI_REASONING_EFFORT;

  if (effort === "minimal") return "minimal";
  if (effort === "medium") return "medium";
  if (effort === "high") return "high";

  return "low";
}

function getDiagnosisMaxOutputTokens() {
  const value = Number(process.env.OPENAI_DIAGNOSIS_MAX_OUTPUT_TOKENS || 1900);

  if (Number.isNaN(value)) {
    return 1900;
  }

  return Math.min(Math.max(value, 900), 3000);
}

function shouldAutoRetryDiagnosis() {
  return process.env.DIAGNOSIS_AUTO_RETRY === "true";
}

function buildSystemPrompt(
  engineContext: EngineContext,
  faultCodeContext: FaultCodeContext,
  retryWarning?: string
) {
  return `
Du bist DiagnoseHUB, ein technischer KI-Diagnoseassistent für freie Kfz-Werkstätten.

Antworte immer auf Deutsch.
Antworte kurz, direkt und werkstattnah.
Keine Textwand, aber auch keine groben Allgemeinplätze.
Die Antwort soll so sein, dass ein Kfz-Mechatroniker daraus direkt den nächsten Arbeitsschritt ableiten kann.

Grundregeln:
- Keine langen Einleitungen.
- Keine pauschalen Disclaimer.
- Keine unnoetigen Sicherheitshinweise.
- Keine erfundenen Drehmomente, Fuellmengen, Spezialwerkzeugnummern oder Herstellersollwerte.
- Wenn genaue Werte fahrzeugabhaengig sind, schreibe kurz: "nach Herstellervorgabe prüfen".
- Keine illegalen Manipulationen erklären.
- Keine Deaktivierung von Abgas-, Airbag-, ABS-, ESP- oder Assistenzsystemen erklären.

Wichtig zur Antwortlaenge:
- Standardantwort maximal 5 kurze Abschnitte.
- Maximal 3 bis 7 Bulletpoints pro Abschnitt.
- Kurze Saetze.
- Keine Roman-Erklärung.
- Trotzdem konkrete Arbeitsschritte nennen.
- Nicht schreiben: "Zugang schaffen", sondern genauer beschreiben, welche Verkleidung, Abdeckung, Stecker, Halter oder Baugruppe typischerweise entfernt wird.
- Wenn der genaue Aufbau fahrzeugabhaengig ist, schreibe: "typischer Zugang" und nenne die wahrscheinlichste Demontagefolge.

Werkstatt-Praezision:
- Bei Aus-/Einbau immer konkrete Demontagereihenfolge nennen.
- Beispiel: nicht "Verkleidung ausbauen", sondern "Handschuhfach ausbauen, untere Fußraumverkleidung loesen, seitliche Mittelkonsole-Verkleidung entfernen".
- Beispiel: nicht "Stecker abziehen", sondern "Stecker entriegeln, Verriegelungsnase nicht abbrechen, auf verschmorte Pins prüfen".
- Beispiel: nicht "Befestigung loesen", sondern "Schrauben loesen oder Bajonettverschluss gegen Anschlag drehen, je nach Ausführung".
- Bauteillage und Zugang kurz, aber konkret beschreiben.
- Stecker, Verriegelungen, Clips, Halter, Kunststoffnasen und Bruchstellen erwaehnen, wenn relevant.
- Linksgewinde ausdrücklich erwaehnen, wenn es bei diesem Bauteil/System möglich oder typisch ist.
- Schrauben, Muttern, Exzenter, Einstellpunkte oder Markierungen nennen, die nicht geloest oder nicht verstellt werden dürfen.
- Bei Steuerzeiten, Achsgeometrie, Lenkung, Bremse, Hochvolt, Airbag, Klimaanlage und Kraftstoffsystem besonders praezise sein.
- Erst prüfen, dann ersetzen. Keine reine Teiletausch-Empfehlung.
- "Daten sichern" nur nennen, wenn Steuergerät, Codierung, Programmierung, Anlernung oder Batterieabklemmen mit relevanten Speicherwerten betroffen ist.
- "Batterie abklemmen" nur nennen, wenn technisch noetig: Airbag, Starter, Generator, Hochstromleitung, Steuergerätetausch oder Kurzschlussgefahr.
- Kritische Hinweise direkt am passenden Schritt nennen.

Der Nutzer kann Folgefragen stellen.
Kurze Folgefragen wie "Wo messen?", "Was als nächstes?", "Welche Schraube?", "Linksgewinde?", "Wie ausbauen?" beziehen sich auf den bisherigen Verlauf.
Nutze den bisherigen Fall als Kontext.

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

Motortyp-Regeln:

Diesel:
- Keine Zuendkerzen, Zuendspulen, Zuendfunken oder Zuendanlage nennen.
- Bei Kaltstart nur Gluehkerzen/Gluehsteuergerät nennen, wenn passend.
- Bei Laufproblemen bevorzugt prüfen: Injektoren, Raildruck, Kraftstoffversorgung, Luftmasse, Ladedruck, AGR, DPF-Differenzdruck, Ladeluftstrecke.

Benziner:
- Zuendkerzen und Zuendspulen dürfen genannt werden.
- Keine Gluehkerzen oder Gluehsteuergerät nennen.
- Bei TSI/TFSI/FSI auch Falschluft, KGE, Injektoren, Hochdruckpumpe, Verkokung, Ladedruck und Steuerzeiten berücksichtigen.

Unbekannter Motortyp:
- Keine Diesel-/Benziner-spezifischen Bauteile blind nennen.
- Fehlende Fahrzeugdaten kurz nennen.

Fehlercode-Regel:
- Erkannte Fehlercodes aus der internen Datenbank vorrangig nutzen.
- Unbekannte Fehlercodes nicht sicher erklären. Dann Testertext anfordern.

Antwortformat bei normaler Diagnose:

# Kurzdiagnose
2 bis 4 Saetze. Direkt sagen, was am wahrscheinlichsten ist.

# Sofort prüfen
3 bis 6 konkrete Prüfpunkte.
Nicht nur Bauteile nennen, sondern kurz sagen, wie geprüft wird.

# Nächste Schritte
Konkrete Arbeitsfolge.
Bei Ausbau/Reparatur typische Demontage nennen:
- welche Abdeckung
- welche Verkleidung
- welcher Stecker
- welche Befestigung
- welche Richtung / Lage, wenn sinnvoll

# Kritische Punkte
Nur wenn relevant:
- Linksgewinde
- Schrauben nicht loesen
- Einstellpunkte nicht verstellen
- Clips/Verriegelungen
- Dichtflaechen
- Steuerzeiten
- Hochdruck/Klima/Bremse/Airbag

# Abschluss
Kurz nennen, was danach geprüft werden muss.

Antwortformat bei ausdrücklicher Anleitung:
Wenn der Nutzer schreibt "genaue Anleitung", "Schritt für Schritt", "Ausbauanleitung", "Einbauanleitung" oder "druckbar", dann ausführlicher, aber weiterhin kompakt:

# Werkzeug
Nur relevante Werkzeuge.

# Zugang
Konkrete Demontage bis zum Bauteil.
Keine groben Formulierungen wie "Zugang schaffen".

# Arbeitsschritte
Nummerierte Schritte mit konkreter Reihenfolge.

# Kritische Punkte
Nur relevante Hinweise direkt und knapp.

# Abschlussprüfung
Funktionstest, Fehlerspeicher, Live-Daten, Dichtheit, Probefahrt oder Anlernung nur wenn relevant.

Antwortformat bei kurzer Folgefrage:
- Direkt antworten.
- Keine komplette neue Diagnose.
- Maximal 5 bis 8 Bulletpoints.
`;
}

async function createDiagnosisAnswer(
  engineContext: EngineContext,
  faultCodeContext: FaultCodeContext,
  messages: ChatMessage[],
  input: string,
  retryWarning?: string
) {
  const model = getDiagnosisModel();
  const reasoningEffort = getDiagnosisReasoningEffort();
  const maxOutputTokens = getDiagnosisMaxOutputTokens();

  const response = await client.responses.create({
    model,
    ...(modelSupportsReasoning(model)
      ? {
          reasoning: {
            effort: reasoningEffort,
          },
        }
      : {}),
    max_output_tokens: maxOutputTokens,
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
  } as any);

  const answer = response.output_text?.trim();

  if (!answer) {
    throw new Error("Die KI hat keine auslesbare Diagnose-Antwort geliefert.");
  }

  return answer;
}

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          error:
            "OPENAI_API_KEY fehlt. Bitte in .env.local oder Vercel eintragen.",
        },
        { status: 500 }
      );
    }

    const body = await request.json();

    const input = sanitizeText(body.input, 2500);
    const messages = normalizeMessages(body.messages);
    const accessToken =
      typeof body.accessToken === "string" ? body.accessToken : "";
    const useServerUsageTracking = body.useServerUsageTracking === true;

    if (!input) {
      return NextResponse.json(
        { error: "Keine gültige Diagnose-Eingabe erhalten." },
        { status: 400 }
      );
    }

    const usageControl = await resolveUsageControl(
      accessToken,
      useServerUsageTracking
    );

    if (
      usageControl.enabled &&
      usageControl.countBefore >= usageControl.maxDailyDiagnoses
    ) {
      return NextResponse.json(
        {
          error: `Monatslimit erreicht. Dein aktueller Plan ${usageControl.planLabel} erlaubt ${usageControl.maxDailyDiagnoses} KI-Anfragen pro Monat. Folgefragen zählen mit.`,
          usageLimit: buildUsageLimitPayload(usageControl, null),
        },
        { status: 429 }
      );
    }

    const combinedContext = `${formatHistory(
      messages
    )}\n\nAktuelle Eingabe: ${input}`;
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
      if (shouldAutoRetryDiagnosis()) {
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
Bei Diesel keine Zuendkerzen, Zuendspulen, Zuendfunken oder Zuendanlage als Ursache oder Prüfpunkt nennen.
Bei Benziner keine Gluehkerzen oder Gluehsteuergerät als Ursache oder Prüfpunkt nennen.
          `
        );
      } else {
        qualityCheck =
          "Technischer Konflikt erkannt. Automatische Neugenerierung ist deaktiviert, um Kosten zu sparen.";
      }
    }

    let countAfter: number | null = null;
    let usageWarning: string | undefined;

    if (usageControl.enabled && usageControl.supabase && usageControl.user) {
      try {
        countAfter = await saveDiagnosisUsageCount(
          usageControl.supabase,
          usageControl.user,
          usageControl.todayKey,
          usageControl.countBefore + 1
        );
      } catch (error) {
        console.error(
          "Serverseitige Nutzung konnte nicht erhöht werden:",
          error
        );
        usageWarning =
          "Diagnose wurde erstellt, aber der serverseitige Nutzungszähler konnte nicht aktualisiert werden.";
      }
    }

    return NextResponse.json({
      result,
      engineContext,
      faultCodeContext,
      qualityCheck,
      diagnosisConfig: {
        model: getDiagnosisModel(),
        reasoningEffort: modelSupportsReasoning(getDiagnosisModel())
          ? getDiagnosisReasoningEffort()
          : "not_used",
        maxOutputTokens: getDiagnosisMaxOutputTokens(),
        autoRetry: shouldAutoRetryDiagnosis(),
      },
      usageLimit: buildUsageLimitPayload(
        usageControl,
        countAfter,
        usageWarning
      ),
    });
  } catch (error) {
    console.error("KI-Diagnosefehler:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Die KI-Diagnose konnte nicht erstellt werden.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
