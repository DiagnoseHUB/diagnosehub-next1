import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/supabaseAdmin";
import {
  COMMUNITY_RANK_LABELS,
  resolveCommunityRank,
  type CommunityProfile,
} from "@/services/communityRank";

type ProfileRow = CommunityProfile & {
  id: string;
  full_name: string | null;
  workshop_name: string | null;
  company_name?: string | null;
};

type ReputationEventInput = {
  userId: string;
  sourceType:
    | "question"
    | "answer"
    | "accepted_answer"
    | "marketplace_listing"
    | "estimate_case";
  sourceId?: string | null;
  points: number;
  reason: string;
};

const PROFILE_SELECT =
  "id, full_name, workshop_name, company_name, role, account_type, qualification_level, company_verified, hv_verified, community_rank";

export function isMissingSupabaseTableError(error: unknown, tableName: string) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as { code?: string; message?: string };
  const message = maybeError.message || "";

  return (
    message.includes(tableName) &&
    (message.includes("schema cache") ||
      message.includes("does not exist") ||
      maybeError.code === "PGRST205" ||
      maybeError.code === "42P01")
  );
}

function isMissingReputationTableError(error: unknown) {
  return isMissingSupabaseTableError(error, "community_reputation_events");
}

function formatProfile(profile?: ProfileRow | null) {
  const rank = resolveCommunityRank(profile);

  return {
    id: profile?.id || "",
    name:
      profile?.workshop_name ||
      profile?.company_name ||
      profile?.full_name ||
      "DiagnoseHUB Nutzer",
    rank,
    rankLabel: COMMUNITY_RANK_LABELS[rank],
  };
}

async function loadProfiles(userIds: string[]) {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  const profiles = new Map<string, ReturnType<typeof formatProfile>>();

  if (ids.length === 0) {
    return profiles;
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("workshop_profiles")
    .select(PROFILE_SELECT)
    .in("id", ids);

  if (error) {
    throw new Error(`Profile konnten nicht geladen werden: ${error.message}`);
  }

  for (const profile of (data || []) as ProfileRow[]) {
    profiles.set(profile.id, formatProfile(profile));
  }

  return profiles;
}

export async function loadCommunityLeaderboard() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("community_reputation_events")
    .select("user_id, points")
    .not("user_id", "is", null)
    .limit(1000);

  if (error) {
    if (isMissingReputationTableError(error)) {
      console.warn(
        "Community-Rangliste ist noch nicht eingerichtet:",
        error.message
      );
      return [];
    }

    throw new Error(`Rangliste konnte nicht geladen werden: ${error.message}`);
  }

  const pointMap = new Map<string, number>();

  for (const event of (data || []) as Array<{ user_id: string; points: number }>) {
    pointMap.set(event.user_id, (pointMap.get(event.user_id) || 0) + event.points);
  }

  const profiles = await loadProfiles([...pointMap.keys()]);

  return [...pointMap.entries()]
    .map(([userId, points]) => ({
      userId,
      points,
      profile: profiles.get(userId) || null,
    }))
    .sort((first, second) => second.points - first.points)
    .slice(0, 10);
}

export async function createCommunityReputationEvent(
  supabase: SupabaseClient,
  input: ReputationEventInput
) {
  const { error } = await supabase.from("community_reputation_events").insert({
    user_id: input.userId,
    source_type: input.sourceType,
    source_id: input.sourceId || null,
    points: input.points,
    reason: input.reason,
  });

  if (error) {
    if (isMissingReputationTableError(error)) {
      console.warn(
        "Community-Punkte konnten noch nicht gespeichert werden:",
        error.message
      );
      return;
    }

    throw new Error(`Community-Punkte konnten nicht gespeichert werden: ${error.message}`);
  }
}
