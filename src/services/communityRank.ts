export type CommunityRank = "azubi" | "geselle" | "meister";

export type CommunityProfile = {
  id?: string | null;
  role?: string | null;
  account_type?: string | null;
  qualification_level?: string | null;
  company_verified?: boolean | null;
  hv_verified?: boolean | null;
  community_rank?: string | null;
  marketplace_seller_status?: string | null;
};

export const COMMUNITY_RANK_LABELS: Record<CommunityRank, string> = {
  azubi: "Azubi",
  geselle: "Geselle",
  meister: "Meister",
};

export const COMMUNITY_RANK_DESCRIPTIONS: Record<CommunityRank, string> = {
  azubi: "ChatBot nutzen und Fragen stellen",
  geselle: "Fragen stellen und fachliche Antworten geben",
  meister: "Antworten geben und richtige Antworten markieren",
};

const RANK_ORDER: Record<CommunityRank, number> = {
  azubi: 1,
  geselle: 2,
  meister: 3,
};

function normalizeRank(value: unknown): CommunityRank | null {
  if (value === "azubi" || value === "geselle" || value === "meister") {
    return value;
  }

  return null;
}

function normalizeText(value: unknown) {
  return typeof value === "string"
    ? value
        .toLowerCase()
        .replace(/\u00e4/g, "ae")
        .replace(/\u00f6/g, "oe")
        .replace(/\u00fc/g, "ue")
        .replace(/\u00df/g, "ss")
    : "";
}

export function resolveCommunityRank(profile?: CommunityProfile | null): CommunityRank {
  const explicitRank = normalizeRank(profile?.community_rank);

  if (explicitRank) {
    return explicitRank;
  }

  const accountType = normalizeText(profile?.account_type);
  const qualificationLevel = normalizeText(profile?.qualification_level);
  const marketplaceSellerStatus = normalizeText(profile?.marketplace_seller_status);

  if (accountType === "admin") {
    return "meister";
  }

  if (
    qualificationLevel === "verified_workshop" ||
    qualificationLevel === "hv_verified" ||
    profile?.company_verified === true ||
    profile?.hv_verified === true ||
    marketplaceSellerStatus === "verified_dealer" ||
    marketplaceSellerStatus === "verified_workshop"
  ) {
    return "geselle";
  }

  return "azubi";
}

export function canAnswerCommunityQuestions(rank: CommunityRank) {
  return RANK_ORDER[rank] >= RANK_ORDER.geselle;
}

export function canAcceptCommunityAnswers(rank: CommunityRank) {
  return RANK_ORDER[rank] >= RANK_ORDER.meister;
}

export function canCreateMarketplaceListing(profile?: CommunityProfile | null) {
  const rank = resolveCommunityRank(profile);

  return (
    rank === "geselle" ||
    rank === "meister" ||
    profile?.company_verified === true ||
    profile?.marketplace_seller_status === "verified_dealer" ||
    profile?.marketplace_seller_status === "verified_workshop"
  );
}
