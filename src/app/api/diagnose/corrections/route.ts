import { NextResponse } from "next/server";
import {
  getAuthenticatedRequestErrorStatus,
  loadAuthenticatedUserFromRequest,
} from "@/lib/supabase/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/supabaseAdmin";
import {
  extractCorrectionKeywords,
  type ApprovedDiagnosisCorrection,
} from "@/services/diagnosisCorrections";
import {
  isSafetyAdmin,
  loadSafetyProfile,
} from "@/services/safetyQualification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CorrectionSourceType = ApprovedDiagnosisCorrection["sourceType"];
type CorrectionIssueType = ApprovedDiagnosisCorrection["issueType"];
type CorrectionSeverity = ApprovedDiagnosisCorrection["severity"];
type CorrectionStatus = "pending" | "approved" | "rejected" | "archived";

type CorrectionPostBody = {
  sourceType?: unknown;
  issueType?: unknown;
  severity?: unknown;
  title?: unknown;
  page?: unknown;
  caseContext?: unknown;
  quotedText?: unknown;
  suggestedCorrection?: unknown;
  matchKeywords?: unknown;
};

type CorrectionPatchBody = {
  correctionId?: unknown;
  status?: unknown;
  approvedRule?: unknown;
  reviewNotes?: unknown;
  matchKeywords?: unknown;
};

const allowedSourceTypes = new Set<CorrectionSourceType>([
  "diagnosis",
  "instruction",
  "learning",
  "general",
]);

const allowedIssueTypes = new Set<CorrectionIssueType>([
  "technical_error",
  "safety_risk",
  "missing_spec",
  "unclear_wording",
  "manufacturer_data_needed",
  "wrong_priority",
]);

const allowedSeverities = new Set<CorrectionSeverity>([
  "normal",
  "important",
  "safety_critical",
]);

const allowedStatuses = new Set<CorrectionStatus>([
  "pending",
  "approved",
  "rejected",
  "archived",
]);

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
    value
  )
    ? value
    : "";
}

function cleanStringArray(value: unknown, maxItems = 24) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((entry): entry is string => typeof entry === "string")
        .flatMap((entry) => entry.split(/[,\n;]/g))
        .map((entry) => entry.trim())
        .filter(Boolean)
    )
  ).slice(0, maxItems);
}

function getPageFromRequest(request: Request) {
  return request.headers.get("referer") || "";
}

async function getOptionalUserId(request: Request) {
  try {
    const { user } = await loadAuthenticatedUserFromRequest(request);

    return user.id;
  } catch {
    return null;
  }
}

async function requireAdmin(request: Request) {
  const { user, supabase } = await loadAuthenticatedUserFromRequest(request);
  const profile = await loadSafetyProfile(supabase, user);

  if (!isSafetyAdmin(profile)) {
    throw new Error("Nur Admins dürfen Fachkorrekturen freigeben.");
  }

  return user;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedStatus = searchParams.get("status") || "pending";
    const status = allowedStatuses.has(requestedStatus as CorrectionStatus)
      ? (requestedStatus as CorrectionStatus)
      : "pending";

    if (status !== "approved") {
      await requireAdmin(request);
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("diagnosis_correction_suggestions")
      .select("*")
      .eq("status", status)
      .order("updated_at", { ascending: false })
      .limit(100);

    if (error) {
      throw error;
    }

    return NextResponse.json({ corrections: data || [] });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Fachkorrekturen konnten nicht geladen werden.",
      },
      { status: getAuthenticatedRequestErrorStatus(error, 403) }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as CorrectionPostBody;
    const sourceType = allowedSourceTypes.has(body.sourceType as CorrectionSourceType)
      ? (body.sourceType as CorrectionSourceType)
      : "diagnosis";
    const issueType = allowedIssueTypes.has(body.issueType as CorrectionIssueType)
      ? (body.issueType as CorrectionIssueType)
      : "technical_error";
    const severity = allowedSeverities.has(body.severity as CorrectionSeverity)
      ? (body.severity as CorrectionSeverity)
      : issueType === "safety_risk"
        ? "safety_critical"
        : "normal";
    const title = cleanText(body.title, 180) || "Fachliche Korrektur";
    const page = cleanText(body.page, 400) || cleanText(getPageFromRequest(request), 400);
    const caseContext = cleanText(body.caseContext, 5000);
    const quotedText = cleanText(body.quotedText, 1200);
    const suggestedCorrection = cleanText(body.suggestedCorrection, 3000);
    const manualKeywords = cleanStringArray(body.matchKeywords);
    const matchKeywords =
      manualKeywords.length > 0
        ? manualKeywords
        : extractCorrectionKeywords(
            `${title} ${caseContext} ${quotedText} ${suggestedCorrection}`
          );

    if (suggestedCorrection.length < 12) {
      return NextResponse.json(
        {
          error:
            "Bitte beschreibe kurz, was fachlich korrigiert werden soll.",
        },
        { status: 400 }
      );
    }

    const userId = await getOptionalUserId(request);
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("diagnosis_correction_suggestions")
      .insert({
        user_id: userId,
        source_type: sourceType,
        issue_type: issueType,
        severity,
        title,
        page,
        case_context: caseContext,
        quoted_text: quotedText,
        suggested_correction: suggestedCorrection,
        match_keywords: matchKeywords,
        status: "pending",
      })
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      correction: data,
      message:
        "Fachliche Korrektur wurde gespeichert und wartet auf manuelle Freigabe.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Fachliche Korrektur konnte nicht gespeichert werden.",
      },
      { status: getAuthenticatedRequestErrorStatus(error) }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await requireAdmin(request);
    const body = (await request.json().catch(() => ({}))) as CorrectionPatchBody;
    const correctionId = cleanUuid(body.correctionId);
    const status = allowedStatuses.has(body.status as CorrectionStatus)
      ? (body.status as CorrectionStatus)
      : "";
    const approvedRule = cleanText(body.approvedRule, 3000);
    const reviewNotes = cleanText(body.reviewNotes, 2000);
    const matchKeywords = cleanStringArray(body.matchKeywords);

    if (!correctionId || !status) {
      return NextResponse.json(
        { error: "Korrektur und Entscheidung fehlen." },
        { status: 400 }
      );
    }

    if (status === "approved" && approvedRule.length < 12) {
      return NextResponse.json(
        { error: "Für die Freigabe wird eine klare Regel benötigt." },
        { status: 400 }
      );
    }

    const updatePayload: Record<string, unknown> = {
      status,
      approved_rule: approvedRule,
      review_notes: reviewNotes,
      reviewed_by: admin.id,
      reviewed_at: new Date().toISOString(),
    };

    if (matchKeywords.length > 0) {
      updatePayload.match_keywords = matchKeywords;
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("diagnosis_correction_suggestions")
      .update(updatePayload)
      .eq("id", correctionId)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      correction: data,
      message:
        status === "approved"
          ? "Fachkorrektur wurde freigegeben und fließt künftig in passende Antworten ein."
          : "Fachkorrektur wurde aktualisiert.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Fachkorrektur konnte nicht aktualisiert werden.",
      },
      { status: getAuthenticatedRequestErrorStatus(error, 403) }
    );
  }
}
