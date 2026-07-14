import { NextResponse } from "next/server";
import {
  getAuthenticatedRequestErrorStatus,
  loadAuthenticatedUserFromRequest,
} from "@/lib/supabase/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type KnowledgeRequestBody = {
  caseId?: unknown;
  title?: unknown;
  vehicleData?: unknown;
  faultCodes?: unknown;
  symptoms?: unknown;
  measurements?: unknown;
  mediaFindings?: unknown;
  solutionSummary?: unknown;
  repairResult?: unknown;
  partsUsed?: unknown;
  customerSafeSummary?: unknown;
  internalNotes?: unknown;
};

function cleanText(value: unknown, maxLength = 4000) {
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

function cleanStringArray(value: unknown, maxItems = 20) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => cleanText(entry, 500))
    .filter(Boolean)
    .slice(0, maxItems);
}

function cleanJsonArray(value: unknown, maxItems = 60) {
  return Array.isArray(value) ? value.slice(0, maxItems) : [];
}

export async function GET(request: Request) {
  try {
    const { user } = await loadAuthenticatedUserFromRequest(request);
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("diagnosis_case_knowledge")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(50);

    if (error) {
      throw error;
    }

    return NextResponse.json({ entries: data || [] });
  } catch (error) {
    console.error("Werkstattwissen konnte nicht geladen werden:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Werkstattwissen konnte nicht geladen werden.",
      },
      { status: getAuthenticatedRequestErrorStatus(error) },
    );
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await loadAuthenticatedUserFromRequest(request);
    const body = (await request.json().catch(() => ({}))) as KnowledgeRequestBody;
    const title = cleanText(body.title, 180) || "Gelöster Diagnosefall";
    const solutionSummary = cleanText(body.solutionSummary, 4000);

    if (solutionSummary.length < 10) {
      return NextResponse.json(
        {
          error: "Bitte beschreibe kurz, was die Reparatur tatsächlich gelöst hat.",
        },
        { status: 400 },
      );
    }

    const caseId = cleanUuid(body.caseId);
    const now = new Date().toISOString();
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("diagnosis_case_knowledge")
      .insert({
        user_id: user.id,
        case_id: caseId || null,
        title,
        vehicle_data: cleanText(body.vehicleData, 2500),
        fault_codes: cleanStringArray(body.faultCodes),
        symptoms: cleanStringArray(body.symptoms),
        measurements: cleanJsonArray(body.measurements),
        media_findings: cleanJsonArray(body.mediaFindings),
        solution_summary: solutionSummary,
        repair_result: cleanText(body.repairResult, 2500),
        parts_used: cleanText(body.partsUsed, 2500),
        customer_safe_summary: cleanText(body.customerSafeSummary, 3000),
        internal_notes: cleanText(body.internalNotes, 3000),
        status: "internal",
      })
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    if (caseId) {
      await supabase
        .from("diagnosis_cases")
        .update({
          solved_summary: solutionSummary,
          solved_at: now,
          knowledge_status: "saved",
          updated_at: now,
        })
        .eq("id", caseId)
        .eq("user_id", user.id);
    }

    return NextResponse.json({
      entry: data,
      message: "Gelöster Fall wurde als internes Werkstattwissen gespeichert.",
    });
  } catch (error) {
    console.error("Werkstattwissen konnte nicht gespeichert werden:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Werkstattwissen konnte nicht gespeichert werden.",
      },
      { status: getAuthenticatedRequestErrorStatus(error) },
    );
  }
}
