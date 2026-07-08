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

export async function GET(request: Request) {
  try {
    const { user, supabase } = await loadAuthenticatedUserFromRequest(request);
    const profile = await loadSafetyProfile(supabase, user);
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

    const updatePayload = {
      account_type: nextAccountType,
      qualification_level:
        nextAccountType === "private" ? "none" : "self_declared",
      role: role(payload.role),
      company_name: text(payload.companyName),
      company_address: text(payload.companyAddress, 500),
      company_phone: text(payload.companyPhone, 80),
      company_website: text(payload.companyWebsite, 220),
      terms_safety_accepted_at:
        payload.safetyTermsAccepted === true ? now : null,
      risk_access_level: riskAccessLevelFromAccountType(nextAccountType),
    };

    const { data, error } = await supabase
      .from("workshop_profiles")
      .update(updatePayload)
      .eq("id", user.id)
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

    return NextResponse.json({ profile: data });
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
      account_type: "private",
      qualification_level: "none",
      hv_verified: false,
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
