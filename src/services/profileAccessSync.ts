import type { SupabaseClient } from "@supabase/supabase-js";

export type VerifiedAccessRank = "geselle" | "meister";

type WorkshopAccessProfileRow = {
  id: string;
  role?: string | null;
  account_type?: string | null;
  qualification_level?: string | null;
  hv_verified?: boolean | null;
  risk_access_level?: string | null;
  community_rank?: string | null;
  marketplace_seller_status?: string | null;
};

const ACCESS_PROFILE_SELECT =
  "id, role, account_type, qualification_level, hv_verified, risk_access_level, community_rank, marketplace_seller_status";

export function verifiedRankWeight(rank?: string | null) {
  if (rank === "meister") return 3;
  if (rank === "geselle") return 2;
  return 1;
}

function keepIfHigherRank(
  currentRank: string | null | undefined,
  requestedRank: VerifiedAccessRank
): VerifiedAccessRank {
  return verifiedRankWeight(currentRank) > verifiedRankWeight(requestedRank)
    ? (currentRank as VerifiedAccessRank)
    : requestedRank;
}

function buildAccessUpdate(
  currentProfile: WorkshopAccessProfileRow | null,
  requestedRank: VerifiedAccessRank,
  note?: string
) {
  const effectiveRank = keepIfHigherRank(
    currentProfile?.community_rank,
    requestedRank
  );
  const isAdmin = currentProfile?.account_type === "admin";
  const isHvVerified =
    currentProfile?.hv_verified === true ||
    currentProfile?.qualification_level === "hv_verified" ||
    currentProfile?.risk_access_level === "hv";
  const marketplaceStatus = currentProfile?.marketplace_seller_status || "";
  const keepMarketplaceStatus =
    marketplaceStatus === "suspended" || marketplaceStatus === "rejected";
  const currentRole = currentProfile?.role || "";
  const keepCurrentRole =
    currentRole === "admin" ||
    currentRole === "inhaber" ||
    (currentRole === "meister" && effectiveRank === "geselle");

  return {
    community_rank: effectiveRank,
    role: keepCurrentRole ? currentRole : effectiveRank,
    account_type: isAdmin
      ? "admin"
      : effectiveRank === "meister"
        ? "workshop"
        : currentProfile?.account_type === "workshop"
          ? "workshop"
          : "mechanic",
    qualification_level: isHvVerified ? "hv_verified" : "verified_workshop",
    risk_access_level: isHvVerified ? "hv" : "red",
    marketplace_seller_status: keepMarketplaceStatus
      ? marketplaceStatus
      : effectiveRank === "meister"
        ? "verified_workshop"
        : "verified_dealer",
    marketplace_review_notes:
      note ||
      (effectiveRank === "meister"
        ? "Meisterbrief geprüft und für Profilfreigaben übernommen."
        : "Gesellenbrief geprüft und für Profilfreigaben übernommen."),
    updated_at: new Date().toISOString(),
  };
}

export async function applyVerifiedAccessRank(
  supabase: SupabaseClient,
  {
    userId,
    requestedRank,
    note,
  }: {
    userId: string;
    requestedRank: VerifiedAccessRank;
    note?: string;
  }
) {
  const { data: currentProfile, error: loadError } = await supabase
    .from("workshop_profiles")
    .select(ACCESS_PROFILE_SELECT)
    .eq("id", userId)
    .maybeSingle();

  if (loadError) {
    throw new Error(`Profilfreigaben konnten nicht geladen werden: ${loadError.message}`);
  }

  const updatePayload = buildAccessUpdate(
    (currentProfile as WorkshopAccessProfileRow | null) || null,
    requestedRank,
    note
  );

  const { data, error } = await supabase
    .from("workshop_profiles")
    .update(updatePayload)
    .eq("id", userId)
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(`Profilfreigaben konnten nicht gespeichert werden: ${error.message}`);
  }

  return data;
}
