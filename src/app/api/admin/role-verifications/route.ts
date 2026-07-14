import { NextResponse } from "next/server";
import { loadAuthenticatedUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/supabaseAdmin";
import { createCommunityReputationEvent } from "@/services/communityReputation";
import { applyVerifiedAccessRank } from "@/services/profileAccessSync";
import {
  isSafetyAdmin,
  loadSafetyProfile,
} from "@/services/safetyQualification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReviewPayload = {
  requestId?: unknown;
  decision?: unknown;
  reviewNotes?: unknown;
};

type RoleVerificationAdminRow = {
  id: string;
  user_id: string;
  requested_rank: "geselle" | "meister";
  required_document: "gesellenbrief" | "meisterbrief";
  document_path: string;
  document_name: string;
  document_mime_type: string;
  document_size_bytes: number;
  applicant_note: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  review_notes: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

const REQUEST_SELECT =
  "id, user_id, requested_rank, required_document, document_path, document_name, document_mime_type, document_size_bytes, applicant_note, status, review_notes, reviewed_by, reviewed_at, created_at, updated_at";

function cleanText(value: unknown, maxLength = 800) {
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

async function requireAdmin(request: Request) {
  const { user, supabase } = await loadAuthenticatedUserFromRequest(request);
  const profile = await loadSafetyProfile(supabase, user);

  if (!isSafetyAdmin(profile)) {
    throw new Error("Nur Admins dürfen Qualifikationsnachweise prüfen.");
  }

  return { user };
}

async function formatAdminRequest(
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
  row: RoleVerificationAdminRow
) {
  const [profileResult, signedUrlResult] = await Promise.all([
    adminClient
      .from("workshop_profiles")
      .select("id, full_name, workshop_name, email, role, community_rank")
      .eq("id", row.user_id)
      .maybeSingle(),
    adminClient.storage
      .from("role-verifications")
      .createSignedUrl(row.document_path, 60 * 30),
  ]);

  return {
    id: row.id,
    userId: row.user_id,
    requestedRank: row.requested_rank,
    requiredDocument: row.required_document,
    documentName: row.document_name,
    documentMimeType: row.document_mime_type,
    documentSizeBytes: row.document_size_bytes,
    documentUrl: signedUrlResult.data?.signedUrl || "",
    applicantNote: row.applicant_note,
    status: row.status,
    reviewNotes: row.review_notes,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    profile: profileResult.data || null,
  };
}

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const adminClient = createSupabaseAdminClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "pending";

    const query = adminClient
      .from("role_verification_requests")
      .select(REQUEST_SELECT)
      .order("created_at", { ascending: false })
      .limit(100);

    if (
      status === "pending" ||
      status === "approved" ||
      status === "rejected" ||
      status === "cancelled"
    ) {
      query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const requests = await Promise.all(
      ((data || []) as RoleVerificationAdminRow[]).map((row) =>
        formatAdminRequest(adminClient, row)
      )
    );

    return NextResponse.json({ requests });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Qualifikationsnachweise konnten nicht geladen werden.",
      },
      { status: 403 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const { user } = await requireAdmin(request);
    const payload = (await request.json().catch(() => ({}))) as ReviewPayload;
    const requestId = cleanUuid(payload.requestId);
    const decision =
      payload.decision === "approved" || payload.decision === "rejected"
        ? payload.decision
        : "";
    const reviewNotes = cleanText(payload.reviewNotes, 1200);

    if (!requestId || !decision) {
      return NextResponse.json(
        {
          error: "Antrag und Entscheidung fehlen.",
        },
        { status: 400 }
      );
    }

    const adminClient = createSupabaseAdminClient();
    const { data: verificationRequest, error: requestError } = await adminClient
      .from("role_verification_requests")
      .select(REQUEST_SELECT)
      .eq("id", requestId)
      .maybeSingle();

    if (requestError) {
      throw requestError;
    }

    if (!verificationRequest) {
      return NextResponse.json(
        {
          error: "Qualifikationsnachweis wurde nicht gefunden.",
        },
        { status: 404 }
      );
    }

    const row = verificationRequest as RoleVerificationAdminRow;

    if (row.status !== "pending") {
      return NextResponse.json(
        {
          error: "Dieser Qualifikationsnachweis wurde bereits geprüft.",
        },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();

    const { data: updatedRequest, error: updateError } = await adminClient
      .from("role_verification_requests")
      .update({
        status: decision,
        review_notes: reviewNotes,
        reviewed_by: user.id,
        reviewed_at: now,
      })
      .eq("id", row.id)
      .select(REQUEST_SELECT)
      .single();

    if (updateError) {
      throw updateError;
    }

    if (decision === "approved") {
      await applyVerifiedAccessRank(adminClient, {
        userId: row.user_id,
        requestedRank: row.requested_rank,
        note:
          row.requested_rank === "meister"
            ? "Meisterbrief geprüft und auf alle Profilfreigaben übertragen."
            : "Gesellenbrief geprüft und auf alle Profilfreigaben übertragen.",
      });

      await createCommunityReputationEvent(adminClient, {
        userId: row.user_id,
        sourceType: "accepted_answer",
        sourceId: row.id,
        points: row.requested_rank === "meister" ? 25 : 15,
        reason:
          row.requested_rank === "meister"
            ? "Meisterbrief freigegeben"
            : "Gesellenbrief freigegeben",
      });
    }

    return NextResponse.json({
      request: await formatAdminRequest(
        adminClient,
        updatedRequest as RoleVerificationAdminRow
      ),
      message:
        decision === "approved"
          ? "Qualifikationsnachweis wurde freigegeben."
          : "Qualifikationsnachweis wurde abgelehnt.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Qualifikationsnachweis konnte nicht geprüft werden.",
      },
      { status: 400 }
    );
  }
}
