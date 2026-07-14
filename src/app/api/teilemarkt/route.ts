import { NextResponse } from "next/server";
import {
  getAuthenticatedRequestErrorStatus,
  loadAuthenticatedUserFromRequest,
} from "@/lib/supabase/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/supabaseAdmin";
import {
  COMMUNITY_RANK_LABELS,
  canCreateMarketplaceListing,
  resolveCommunityRank,
  type CommunityProfile,
} from "@/services/communityRank";
import { createCommunityReputationEvent } from "@/services/communityReputation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PartListingInput = {
  title?: unknown;
  category?: unknown;
  manufacturer?: unknown;
  partNumber?: unknown;
  oeNumbers?: unknown;
  vehicleData?: unknown;
  conditionNote?: unknown;
  inspectionSummary?: unknown;
  price?: unknown;
  warrantyTerms?: unknown;
  returnTerms?: unknown;
  riskLevel?: unknown;
  acceptTerms?: unknown;
};

type WorkshopProfileRow = CommunityProfile & {
  id: string;
  full_name: string | null;
  workshop_name: string | null;
  email: string | null;
  company_name?: string | null;
  company_verified?: boolean | null;
  marketplace_seller_status?: string | null;
};

const LISTING_SELECT =
  "id, seller_id, title, category, manufacturer, part_number, oe_numbers, vehicle_fitment, condition_note, inspection_summary, price_cents, currency, warranty_terms, return_terms, image_urls, risk_level, status, review_notes, created_at, updated_at";

const PROFILE_SELECT =
  "id, full_name, workshop_name, email, role, account_type, qualification_level, company_name, company_verified, hv_verified, community_rank, marketplace_seller_status";

function cleanText(value: unknown, maxLength = 600) {
  return typeof value === "string"
    ? value.trim().replace(/\s+/g, " ").slice(0, maxLength)
    : "";
}

function cleanLongText(value: unknown, maxLength = 3000) {
  return typeof value === "string"
    ? value.trim().replace(/\r\n/g, "\n").slice(0, maxLength)
    : "";
}

function cleanTextArray(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => cleanText(entry, 80))
      .filter(Boolean)
      .slice(0, 12);
  }

  if (typeof value === "string") {
    return value
      .split(/[,;\n]/)
      .map((entry) => cleanText(entry, 80))
      .filter(Boolean)
      .slice(0, 12);
  }

  return [];
}

function normalizeRiskLevel(value: unknown) {
  if (
    value === "normal" ||
    value === "important" ||
    value === "safety_relevant" ||
    value === "blocked"
  ) {
    return value;
  }

  return "normal";
}

function parsePriceCents(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.round(value * 100));
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.replace(/\./g, "").replace(",", ".").trim();
  const parsed = Number.parseFloat(normalized);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return Math.round(parsed * 100);
}

function formatProfile(profile: WorkshopProfileRow | null) {
  const rank = resolveCommunityRank(profile);

  return {
    id: profile?.id || "",
    name: profile?.workshop_name || profile?.company_name || profile?.full_name || "Nicht angegeben",
    role: profile?.role || "Nicht angegeben",
    rank,
    rankLabel: COMMUNITY_RANK_LABELS[rank],
    companyVerified: profile?.company_verified === true,
    sellerStatus: profile?.marketplace_seller_status || "not_requested",
    canCreateListing: canCreateMarketplaceListing(profile),
  };
}

async function loadProfile(userId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("workshop_profiles")
    .select(PROFILE_SELECT)
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Profil konnte nicht geladen werden: ${error.message}`);
  }

  return (data as WorkshopProfileRow | null) || null;
}

async function loadProfiles(userIds: string[]) {
  const ids = Array.from(new Set(userIds.filter(Boolean)));

  if (ids.length === 0) {
    return new Map<string, ReturnType<typeof formatProfile>>();
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("workshop_profiles")
    .select(PROFILE_SELECT)
    .in("id", ids);

  if (error) {
    throw new Error(`Profile konnten nicht geladen werden: ${error.message}`);
  }

  const map = new Map<string, ReturnType<typeof formatProfile>>();

  for (const profile of (data || []) as WorkshopProfileRow[]) {
    map.set(profile.id, formatProfile(profile));
  }

  return map;
}

function attachSeller(listing: Record<string, unknown>, sellers: Map<string, ReturnType<typeof formatProfile>>) {
  const sellerId = typeof listing.seller_id === "string" ? listing.seller_id : "";

  return {
    ...listing,
    seller: sellers.get(sellerId) || null,
  };
}

export async function GET(request: Request) {
  try {
    const { user } = await loadAuthenticatedUserFromRequest(request);
    const supabase = createSupabaseAdminClient();
    const profile = await loadProfile(user.id);

    const [listingsResult, inquiriesResult] = await Promise.all([
      supabase
        .from("used_part_listings")
        .select(LISTING_SELECT)
        .or(`status.eq.active,seller_id.eq.${user.id}`)
        .order("updated_at", { ascending: false })
        .limit(80),
      supabase
        .from("used_part_inquiries")
        .select("*")
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        .order("created_at", { ascending: false })
        .limit(80),
    ]);

    if (listingsResult.error) {
      throw new Error(`Teile konnten nicht geladen werden: ${listingsResult.error.message}`);
    }

    if (inquiriesResult.error) {
      throw new Error(`Anfragen konnten nicht geladen werden: ${inquiriesResult.error.message}`);
    }

    const sellerIds = [
      ...((listingsResult.data || []) as Array<{ seller_id?: string | null }>).map(
        (listing) => listing.seller_id || ""
      ),
      ...((inquiriesResult.data || []) as Array<{ seller_id?: string | null }>).map(
        (inquiry) => inquiry.seller_id || ""
      ),
    ];
    const sellers = await loadProfiles(sellerIds);

    return NextResponse.json({
      profile: formatProfile(profile),
      listings: ((listingsResult.data || []) as Record<string, unknown>[]).map(
        (listing) => attachSeller(listing, sellers)
      ),
      inquiries: inquiriesResult.data || [],
      safetyNote:
        "Gebrauchtteile sind aktuell ein geprüfter Anfrageprozess. Verkauf, Gewährleistung und Freigabe bleiben beim Anbieter.",
    });
  } catch (error) {
    console.error("Teilemarkt konnte nicht geladen werden:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Teilemarkt konnte nicht geladen werden.",
      },
      { status: getAuthenticatedRequestErrorStatus(error) }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await loadAuthenticatedUserFromRequest(request);
    const profile = await loadProfile(user.id);

    if (!canCreateMarketplaceListing(profile)) {
      return NextResponse.json(
        {
          error:
            "Gebrauchtteile dürfen aktuell nur von Gesellen, Meistern oder geprüften Werkstätten/Händlern eingestellt werden.",
        },
        { status: 403 }
      );
    }

    const body = (await request.json()) as PartListingInput;
    const title = cleanText(body.title, 140);
    const category = cleanText(body.category, 80);
    const conditionNote = cleanLongText(body.conditionNote, 1600);
    const inspectionSummary = cleanLongText(body.inspectionSummary, 1800);

    if (!title || !category || !conditionNote || !inspectionSummary) {
      return NextResponse.json(
        {
          error:
            "Titel, Kategorie, Zustand und Prüf-/Sichtkontrolle sind Pflicht.",
        },
        { status: 400 }
      );
    }

    if (body.acceptTerms !== true) {
      return NextResponse.json(
        {
          error:
            "Bitte bestätige, dass der Anbieter für Richtigkeit, Verkauf, Gewährleistung und Freigabe verantwortlich bleibt.",
        },
        { status: 400 }
      );
    }

    const riskLevel = normalizeRiskLevel(body.riskLevel);
    const listingStatus = riskLevel === "blocked" ? "needs_changes" : "in_review";
    const supabase = createSupabaseAdminClient();
    const now = new Date().toISOString();

    if (
      !profile?.marketplace_seller_status ||
      profile.marketplace_seller_status === "not_requested"
    ) {
      await supabase
        .from("workshop_profiles")
        .update({
          marketplace_seller_status: "pending",
          marketplace_terms_accepted_at: now,
        })
        .eq("id", user.id);
    }

    const { data, error } = await supabase
      .from("used_part_listings")
      .insert({
        seller_id: user.id,
        title,
        category,
        manufacturer: cleanText(body.manufacturer, 80),
        part_number: cleanText(body.partNumber, 100),
        oe_numbers: cleanTextArray(body.oeNumbers),
        vehicle_fitment: {
          raw: cleanLongText(body.vehicleData, 1600),
        },
        condition_note: conditionNote,
        inspection_summary: inspectionSummary,
        price_cents: parsePriceCents(body.price),
        currency: "EUR",
        warranty_terms: cleanLongText(body.warrantyTerms, 1200),
        return_terms: cleanLongText(body.returnTerms, 1200),
        risk_level: riskLevel,
        status: listingStatus,
        review_notes:
          riskLevel === "blocked"
            ? "Sicherheitskritische oder rechtlich heikle Teile werden nicht automatisch freigegeben."
            : "Wartet auf manuelle Prüfung.",
      })
      .select(LISTING_SELECT)
      .single();

    if (error) {
      throw new Error(`Teil konnte nicht gespeichert werden: ${error.message}`);
    }

    await createCommunityReputationEvent(supabase, {
      userId: user.id,
      sourceType: "marketplace_listing",
      sourceId: data.id,
      points: 3,
      reason: "Gebrauchtteil zur Prüfung eingestellt",
    });

    return NextResponse.json({
      listing: data,
      status: listingStatus,
      message:
        listingStatus === "in_review"
          ? "Teil wurde gespeichert und wartet auf Prüfung."
          : "Teil wurde gespeichert, benötigt aber Anpassung oder manuelle Klärung.",
    });
  } catch (error) {
    console.error("Teil konnte nicht gespeichert werden:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Teil konnte nicht gespeichert werden.",
      },
      { status: getAuthenticatedRequestErrorStatus(error) }
    );
  }
}
