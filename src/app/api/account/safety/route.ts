import { NextResponse } from "next/server";
import { loadAuthenticatedUserFromRequest } from "@/lib/supabase/auth";
import { loadSafetyProfile } from "@/services/safetyQualification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SafetyProfilePayload = {
  accountType?: unknown;
  role?: unknown;
  companyName?: unknown;
  companyAddress?: unknown;
  companyPhone?: unknown;
  companyWebsite?: unknown;
  safetyTermsAccepted?: unknown;
};

type HvAccessPayload = {
  hvQualification?: unknown;
  trainingProvider?: unknown;
  trainingDate?: unknown;
  certificateUrl?: unknown;
  certificateName?: unknown;
  companyName?: unknown;
  safetyConfirmation?: unknown;
};

type WorkshopSafetySettingsRow = {
  id: string;
  full_name?: string | null;
  workshop_name?: string | null;
  email?: string | null;
  role?: string | null;
  plan?: string | null;
  account_type?: string | null;
  qualification_level?: string | null;
  company_name?: string | null;
  company_address?: string | null;
  company_phone?: string | null;
  company_website?: string | null;
  company_verified?: boolean | null;
  hv_qualification?: string | null;
  hv_certificate_url?: string | null;
  hv_training_provider?: string | null;
  hv_training_date?: string | null;
  hv_certificate_name?: string | null;
  hv_verified?: boolean | null;
  terms_safety_accepted_at?: string | null;
  risk_access_level?: string | null;
  community_rank?: string | null;
};

function text(value: unknown, maxLength = 220) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function accountType(value: unknown) {
  if (value === "mechanic" || value === "workshop") {
    return value;
  }

  return "private";
}

function role(value: unknown) {
  if (
    value === "private" ||
    value === "azubi" ||
    value === "geselle" ||
    value === "meister" ||
    value === "inhaber" ||
    value === "serviceberater" ||
    value === "sonstige"
  ) {
    return value;
  }

  return "private";
}

function hvQualification(value: unknown) {
  if (
    value === "hv1" ||
    value === "hv2" ||
    value === "hv3" ||
    value === "other"
  ) {
    return value;
  }

  return "none";
}

function dateOrNull(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function riskAccessLevelFromAccountType(value: string) {
  if (value === "workshop" || value === "mechanic") {
    return "red";
  }

  return "yellow";
}

function verifiedRank(value: unknown): "geselle" | "meister" | null {
  if (value === "geselle" || value === "meister") {
    return value;
  }

  return null;
}

function toSafetySettings(row: WorkshopSafetySettingsRow | null) {
  return {
    accountType: row?.account_type || "private",
    role: row?.role || "private",
    companyName: row?.company_name || row?.workshop_name || "",
    companyAddress: row?.company_address || "",
    companyPhone: row?.company_phone || "",
    companyWebsite: row?.company_website || "",
    companyVerified: row?.company_verified === true,
    hvQualification: row?.hv_qualification || "none",
    hvCertificateUrl: row?.hv_certificate_url || "",
    hvTrainingProvider: row?.hv_training_provider || "",
    hvTrainingDate: row?.hv_training_date || "",
    hvCertificateName: row?.hv_certificate_name || "",
    hvVerified: row?.hv_verified === true,
    termsSafetyAcceptedAt: row?.terms_safety_accepted_at || null,
    riskAccessLevel: row?.risk_access_level || "yellow",
  };
}

async function loadSafetySettings(
  supabase: Awaited<ReturnType<typeof loadAuthenticatedUserFromRequest>>["supabase"],
  userId: string
) {
  const { data, error } = await supabase
    .from("workshop_profiles")
    .select(
      "id, full_name, workshop_name, email, role, plan, account_type, qualification_level, company_name, company_address, company_phone, company_website, company_verified, hv_qualification, hv_certificate_url, hv_training_provider, hv_training_date, hv_certificate_name, hv_verified, terms_safety_accepted_at, risk_access_level, community_rank"
    )
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data || null) as WorkshopSafetySettingsRow | null;
}

export async function GET(request: Request) {
  try {
    const { user, supabase } = await loadAuthenticatedUserFromRequest(request);
    const profile = await loadSafetyProfile(supabase, user);
    const settings = await loadSafetySettings(supabase, user.id);
    const { data: hvRequests, error } = await supabase
      .from("hv_access_requests")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      console.error("HV-Anträge konnten nicht geladen werden:", error);
    }

    return NextResponse.json({
      profile,
      settings: toSafetySettings(settings),
      hvRequests: hvRequests || [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Sicherheitsprofil konnte nicht geladen werden.",
      },
      { status: 400 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const { user, supabase } = await loadAuthenticatedUserFromRequest(request);
    const payload = (await request.json().catch(() => ({}))) as SafetyProfilePayload;
    const nextAccountType = accountType(payload.accountType);
    const now = new Date().toISOString();
    const existingSettings = await loadSafetySettings(supabase, user.id);
    const companyName = text(payload.companyName);
    const existingVerifiedRank = verifiedRank(existingSettings?.community_rank);
    const isHvVerified =
      existingSettings?.hv_verified === true ||
      existingSettings?.qualification_level === "hv_verified" ||
      existingSettings?.risk_access_level === "hv";
    const syncedAccountType =
      existingVerifiedRank === "meister"
        ? "workshop"
        : existingVerifiedRank === "geselle"
          ? nextAccountType === "workshop"
            ? "workshop"
            : "mechanic"
          : nextAccountType;
    const syncedRole = existingVerifiedRank || role(payload.role);
    const syncedQualificationLevel = isHvVerified
      ? "hv_verified"
      : existingVerifiedRank
        ? "verified_workshop"
        : nextAccountType === "private"
          ? "none"
          : "self_declared";
    const syncedRiskAccessLevel = isHvVerified
      ? "hv"
      : existingVerifiedRank
        ? "red"
        : riskAccessLevelFromAccountType(nextAccountType);

    const updatePayload = {
      id: user.id,
      full_name:
        existingSettings?.full_name ||
        user.email?.split("@")[0] ||
        "DiagnoseHUB Nutzer",
      workshop_name:
        companyName ||
        existingSettings?.workshop_name ||
        existingSettings?.company_name ||
        "Nicht angegeben",
      email: existingSettings?.email || user.email || "",
      plan: existingSettings?.plan || "free",
      account_type: syncedAccountType,
      qualification_level: syncedQualificationLevel,
      role: syncedRole,
      company_name: companyName,
      company_address: text(payload.companyAddress, 500),
      company_phone: text(payload.companyPhone, 80),
      company_website: text(payload.companyWebsite, 220),
      terms_safety_accepted_at:
        payload.safetyTermsAccepted === true ? now : null,
      risk_access_level: syncedRiskAccessLevel,
    };

    const { data, error } = await supabase
      .from("workshop_profiles")
      .upsert(updatePayload, { onConflict: "id" })
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    await supabase.from("safety_access_logs").insert({
      user_id: user.id,
      action: "safety_profile_updated",
      query: "",
      source: "account",
      risk_class: "yellow",
      access_decision: "allow_with_warning",
      account_type: updatePayload.account_type,
      qualification_level: updatePayload.qualification_level,
      hv_verified: false,
      warning_type: "general",
      safety_warning:
        "Nutzer hat Sicherheitsprofil aktualisiert und Sicherheitsbedingungen bestätigt.",
      metadata: {
        role: updatePayload.role,
        companyName: updatePayload.company_name,
      },
    });

    const profile = await loadSafetyProfile(supabase, user);

    return NextResponse.json({
      profile,
      settings: toSafetySettings(data as WorkshopSafetySettingsRow),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Sicherheitsprofil konnte nicht gespeichert werden.",
      },
      { status: 400 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { user, supabase } = await loadAuthenticatedUserFromRequest(request);
    const payload = (await request.json().catch(() => ({}))) as HvAccessPayload;
    const profile = await loadSafetyProfile(supabase, user);

    if (payload.safetyConfirmation !== true) {
      return NextResponse.json(
        {
          error:
            "Für den Hochvolt-Antrag muss die Sicherheitsbestätigung akzeptiert werden.",
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("hv_access_requests")
      .insert({
        user_id: user.id,
        hv_qualification: hvQualification(payload.hvQualification),
        training_provider: text(payload.trainingProvider),
        training_date: dateOrNull(payload.trainingDate),
        certificate_url: text(payload.certificateUrl, 600),
        certificate_name: text(payload.certificateName),
        company_name: text(payload.companyName),
        safety_confirmation: true,
        status: "pending",
      })
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    await supabase.from("safety_access_logs").insert({
      user_id: user.id,
      action: "hv_access_requested",
      query: "",
      source: "account",
      risk_class: "hv",
      access_decision: "limited",
      account_type: profile.accountType,
      qualification_level: profile.qualificationLevel,
      hv_verified: profile.hvVerified,
      warning_type: "hv",
      safety_warning:
        "Nutzer hat Hochvolt-Zugang beantragt. Freischaltung erfolgt erst nach manueller Prüfung.",
      metadata: {
        hvQualification: hvQualification(payload.hvQualification),
      },
    });

    return NextResponse.json({ hvRequest: data });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Hochvolt-Antrag konnte nicht gespeichert werden.",
      },
      { status: 400 }
    );
  }
}
