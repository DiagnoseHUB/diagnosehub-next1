export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
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

  return value.flatMap((entry): ChatMessage[] => {
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
      return [
        {
          role: candidate.role,
          content: candidate.content,
        },
      ];
    }

    return [];
  });
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
    const messages = normalizeMessages(body.messages);
    const accessToken =
      typeof body.accessToken === "string" ? body.accessToken : "";
    const useServerUsageTracking = body.useServerUsageTracking === true;

    if (!input || typeof input !== "string") {
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
          error: `Tageslimit erreicht. Dein aktueller Plan ${usageControl.planLabel} erlaubt ${usageControl.maxDailyDiagnoses} Diagnosen pro Tag.`,
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
        console.error("Serverseitige Nutzung konnte nicht erhöht werden:", error);
        usageWarning =
          "Diagnose wurde erstellt, aber der serverseitige Nutzungszähler konnte nicht aktualisiert werden.";
      }
    }

    return NextResponse.json({
      result,
      engineContext,
      faultCodeContext,
      qualityCheck,
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