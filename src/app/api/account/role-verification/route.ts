import { NextResponse } from "next/server";
import {
  getAuthenticatedRequestErrorStatus,
  loadAuthenticatedUserFromRequest,
} from "@/lib/supabase/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/supabaseAdmin";
import {
  COMMUNITY_RANK_LABELS,
  resolveCommunityRank,
  type CommunityProfile,
} from "@/services/communityRank";
import { isMissingSupabaseTableError } from "@/services/communityReputation";
import {
  applyVerifiedAccessRank,
  verifiedRankWeight,
  type VerifiedAccessRank,
} from "@/services/profileAccessSync";
import {
  isSafetyAdmin,
  loadSafetyProfile,
} from "@/services/safetyQualification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type RoleVerificationPayload = {
  requestedRank?: unknown;
  documentName?: unknown;
  documentDataUrl?: unknown;
  applicantNote?: unknown;
};

type RoleVerificationRow = {
  id: string;
  user_id: string;
  requested_rank: VerifiedAccessRank;
  required_document: "gesellenbrief" | "meisterbrief";
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

const PROFILE_SELECT =
  "id, full_name, workshop_name, email, role, account_type, qualification_level, company_name, company_verified, hv_verified, community_rank, marketplace_seller_status";

const REQUEST_SELECT =
  "id, user_id, requested_rank, required_document, document_name, document_mime_type, document_size_bytes, applicant_note, status, review_notes, reviewed_by, reviewed_at, created_at, updated_at";

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;

function cleanText(value: unknown, maxLength = 800) {
  return typeof value === "string"
    ? value.trim().replace(/\r\n/g, "\n").slice(0, maxLength)
    : "";
}

function normalizeRequestedRank(value: unknown): "geselle" | "meister" | null {
  if (value === "geselle" || value === "meister") {
    return value;
  }

  return null;
}

function getRequiredDocument(rank: "geselle" | "meister") {
  return rank === "meister" ? "meisterbrief" : "gesellenbrief";
}

function getFileExtension(mimeType: string) {
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

function safeFileName(value: string) {
  return (
    value
      .trim()
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 80) || "nachweis"
  );
}

function parseDataUrl(value: unknown) {
  if (typeof value !== "string") {
    throw new Error("Bitte lade einen Gesellenbrief oder Meisterbrief hoch.");
  }

  const match = value.match(/^data:([^;,]+);base64,([a-zA-Z0-9+/=\r\n]+)$/);

  if (!match) {
    throw new Error("Nachweis konnte nicht gelesen werden.");
  }

  const mimeType = match[1].toLowerCase();

  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error("Bitte PDF, JPG, PNG oder WebP hochladen.");
  }

  const buffer = Buffer.from(match[2].replace(/\s+/g, ""), "base64");

  if (buffer.length === 0) {
    throw new Error("Die hochgeladene Datei ist leer.");
  }

  if (buffer.length > MAX_DOCUMENT_BYTES) {
    throw new Error("Der Nachweis darf maximal 8 MB groß sein.");
  }

  return {
    buffer,
    mimeType,
    sizeBytes: buffer.length,
  };
}

function formatRequest(row: RoleVerificationRow) {
  return {
    id: row.id,
    requestedRank: row.requested_rank,
    requestedRankLabel: COMMUNITY_RANK_LABELS[row.requested_rank],
    requiredDocument: row.required_document,
    documentName: row.document_name,
    documentMimeType: row.document_mime_type,
    documentSizeBytes: row.document_size_bytes,
    applicantNote: row.applicant_note,
    status: row.status,
    reviewNotes: row.review_notes,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function formatProfile(profile: CommunityProfile | null) {
  const rank = resolveCommunityRank(profile);

  return {
    rank,
    rankLabel: COMMUNITY_RANK_LABELS[rank],
    canRequestGeselle: rank === "azubi",
    canRequestMeister: rank !== "meister",
  };
}

function getHighestApprovedRank(
  rows: Pick<RoleVerificationRow, "requested_rank" | "status">[]
): VerifiedAccessRank | null {
  return rows.reduce<VerifiedAccessRank | null>((highestRank, row) => {
    if (row.status !== "approved") {
      return highestRank;
    }

    if (
      !highestRank ||
      verifiedRankWeight(row.requested_rank) > verifiedRankWeight(highestRank)
    ) {
      return row.requested_rank;
    }

    return highestRank;
  }, null);
}

async function syncApprovedRankToProfile({
  adminClient,
  userId,
  profile,
  requests,
}: {
  adminClient: ReturnType<typeof createSupabaseAdminClient>;
  userId: string;
  profile: CommunityProfile | null;
  requests: RoleVerificationRow[];
}) {
  const approvedRank = getHighestApprovedRank(requests);

  if (!approvedRank) {
    return profile;
  }

  const data = await applyVerifiedAccessRank(adminClient, {
    userId,
    requestedRank: approvedRank,
    note:
      approvedRank === "meister"
        ? "Meisterbrief freigegeben und auf alle Profilfreigaben übertragen."
        : "Gesellenbrief freigegeben und auf alle Profilfreigaben übertragen.",
  });

  return (data as CommunityProfile | null) || {
    ...profile,
    id: userId,
    community_rank: approvedRank,
  };
}

export async function GET(request: Request) {
  try {
    const { user, supabase } = await loadAuthenticatedUserFromRequest(request);
    const adminClient = createSupabaseAdminClient();
    const safetyProfile = await loadSafetyProfile(supabase, user);

    const [profileResult, requestsResult] = await Promise.all([
      adminClient
        .from("workshop_profiles")
        .select(PROFILE_SELECT)
        .eq("id", user.id)
        .maybeSingle(),
      adminClient
        .from("role_verification_requests")
        .select(REQUEST_SELECT)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    if (profileResult.error) {
      throw new Error(`Profil konnte nicht geladen werden: ${profileResult.error.message}`);
    }

    if (
      isMissingSupabaseTableError(
        requestsResult.error,
        "role_verification_requests"
      )
    ) {
      return NextResponse.json({
        profile: formatProfile((profileResult.data as CommunityProfile | null) || null),
        isAdmin: isSafetyAdmin(safetyProfile),
        requests: [],
        setupNotice:
          "Qualifikationsnachweise sind noch nicht eingerichtet. Bitte die Rollen-Migration in Supabase ausführen.",
      });
    }

    if (requestsResult.error) {
      throw new Error(
        `Qualifikationsnachweise konnten nicht geladen werden: ${requestsResult.error.message}`
      );
    }

    const syncedProfile = await syncApprovedRankToProfile({
      adminClient,
      userId: user.id,
      profile: (profileResult.data as CommunityProfile | null) || null,
      requests: (requestsResult.data || []) as RoleVerificationRow[],
    });

    return NextResponse.json({
      profile: formatProfile(syncedProfile),
      isAdmin: isSafetyAdmin(safetyProfile),
      requests: ((requestsResult.data || []) as RoleVerificationRow[]).map(
        formatRequest
      ),
    });
  } catch (error) {
    console.error("Qualifikationsnachweise konnten nicht geladen werden:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Qualifikationsnachweise konnten nicht geladen werden.",
      },
      { status: getAuthenticatedRequestErrorStatus(error) }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await loadAuthenticatedUserFromRequest(request);
    const payload = (await request.json()) as RoleVerificationPayload;
    const requestedRank = normalizeRequestedRank(payload.requestedRank);

    if (!requestedRank) {
      return NextResponse.json(
        {
          error: "Bitte wähle Geselle oder Meister.",
        },
        { status: 400 }
      );
    }

    const document = parseDataUrl(payload.documentDataUrl);
    const originalName = cleanText(payload.documentName, 180) || "Nachweis";
    const requiredDocument = getRequiredDocument(requestedRank);
    const extension = getFileExtension(document.mimeType);
    const documentPath = `${user.id}/${Date.now()}-${requestedRank}-${safeFileName(
      originalName
    )}.${extension}`;
    const adminClient = createSupabaseAdminClient();

    const { data: existingPending, error: pendingError } = await adminClient
      .from("role_verification_requests")
      .select("id")
      .eq("user_id", user.id)
      .eq("requested_rank", requestedRank)
      .eq("status", "pending")
      .limit(1);

    if (pendingError) {
      throw new Error(
        `Offene Nachweise konnten nicht geprüft werden: ${pendingError.message}`
      );
    }

    if ((existingPending || []).length > 0) {
      return NextResponse.json(
        {
          error:
            "Für diese Rolle liegt bereits ein Nachweis in Prüfung vor.",
        },
        { status: 409 }
      );
    }

    const uploadResult = await adminClient.storage
      .from("role-verifications")
      .upload(documentPath, document.buffer, {
        contentType: document.mimeType,
        upsert: false,
      });

    if (uploadResult.error) {
      throw new Error(
        `Nachweis konnte nicht hochgeladen werden: ${uploadResult.error.message}`
      );
    }

    const { data, error } = await adminClient
      .from("role_verification_requests")
      .insert({
        user_id: user.id,
        requested_rank: requestedRank,
        required_document: requiredDocument,
        document_path: documentPath,
        document_name: originalName,
        document_mime_type: document.mimeType,
        document_size_bytes: document.sizeBytes,
        applicant_note: cleanText(payload.applicantNote, 1200),
        status: "pending",
      })
      .select(REQUEST_SELECT)
      .single();

    if (error) {
      await adminClient.storage.from("role-verifications").remove([documentPath]);
      throw new Error(`Nachweis konnte nicht gespeichert werden: ${error.message}`);
    }

    return NextResponse.json({
      request: formatRequest(data as RoleVerificationRow),
      message:
        requestedRank === "meister"
          ? "Meisterbrief wurde hochgeladen und wartet auf Prüfung."
          : "Gesellenbrief wurde hochgeladen und wartet auf Prüfung.",
    });
  } catch (error) {
    console.error("Qualifikationsnachweis konnte nicht gespeichert werden:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Qualifikationsnachweis konnte nicht gespeichert werden.",
      },
      { status: getAuthenticatedRequestErrorStatus(error) }
    );
  }
}
