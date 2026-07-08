import { NextResponse } from "next/server";
import { loadAuthenticatedUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/supabaseAdmin";
import {
  isSafetyAdmin,
  loadSafetyProfile,
} from "@/services/safetyQualification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AdminSafetyPayload = {
  userId?: unknown;
  accountType?: unknown;
  qualificationLevel?: unknown;
  companyVerified?: unknown;
  hvQualification?: unknown;
  hvVerified?: unknown;
  riskAccessLevel?: unknown;
  reviewComment?: unknown;
};

function text(value: unknown, maxLength = 600) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function accountType(value: unknown) {
  if (
    value === "private" ||
    value === "mechanic" ||
    value === "workshop" ||
    value === "admin"
  ) {
    return value;
  }

  return null;
}

function qualificationLevel(value: unknown) {
  if (
    value === "none" ||
    value === "self_declared" ||
    value === "verified_workshop" ||
    value === "hv_verified"
  ) {
    return value;
  }

  return null;
}

function hvQualification(value: unknown) {
  if (
    value === "none" ||
    value === "hv1" ||
    value === "hv2" ||
    value === "hv3" ||
    value === "other"
  ) {
    return value;
  }

  return null;
}

function riskAccessLevel(value: unknown) {
  if (
    value === "green" ||
    value === "yellow" ||
    value === "orange" ||
    value === "red" ||
    value === "hv"
  ) {
    return value;
  }

  return null;
}

async function requireSafetyAdmin(request: Request) {
  const { user, supabase } = await loadAuthenticatedUserFromRequest(request);
  const profile = await loadSafetyProfile(supabase, user);

  if (!isSafetyAdmin(profile)) {
    throw new Error("Nur Admins dürfen Sicherheitsfreigaben verwalten.");
  }

  return { user, profile };
}

export async function GET(request: Request) {
  try {
    await requireSafetyAdmin(request);
    const adminClient = createSupabaseAdminClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "";

    const usersQuery = adminClient
      .from("workshop_profiles")
      .select(
        "id, full_name, workshop_name, email, role, plan, account_type, qualification_level, company_name, company_address, company_phone, company_website, company_verified, hv_qualification, hv_certificate_url, hv_training_provider, hv_training_date, hv_certificate_name, hv_verified, hv_verified_at, terms_safety_accepted_at, risk_access_level, updated_at"
      )
      .order("updated_at", { ascending: false })
      .limit(200);

    if (status === "hv_pending") {
      const { data, error } = await adminClient
        .from("hv_access_requests")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) {
        throw error;
      }

      return NextResponse.json({ hvRequests: data || [] });
    }

    const { data, error } = await usersQuery;

    if (error) {
      throw error;
    }

    return NextResponse.json({ users: data || [] });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Sicherheitsnutzer konnten nicht geladen werden.",
      },
      { status: 403 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const { user } = await requireSafetyAdmin(request);
    const payload = (await request.json().catch(() => ({}))) as AdminSafetyPayload;
    const targetUserId = text(payload.userId, 80);

    if (!targetUserId) {
      return NextResponse.json({ error: "Nutzer-ID fehlt." }, { status: 400 });
    }

    const updatePayload: Record<string, string | boolean | null> = {};
    const nextAccountType = accountType(payload.accountType);
    const nextQualificationLevel = qualificationLevel(payload.qualificationLevel);
    const nextHvQualification = hvQualification(payload.hvQualification);
    const nextRiskAccessLevel = riskAccessLevel(payload.riskAccessLevel);

    if (nextAccountType) updatePayload.account_type = nextAccountType;
    if (nextQualificationLevel) {
      updatePayload.qualification_level = nextQualificationLevel;
    }
    if (typeof payload.companyVerified === "boolean") {
      updatePayload.company_verified = payload.companyVerified;
    }
    if (nextHvQualification) updatePayload.hv_qualification = nextHvQualification;
    if (typeof payload.hvVerified === "boolean") {
      updatePayload.hv_verified = payload.hvVerified;
      updatePayload.hv_verified_at = payload.hvVerified
        ? new Date().toISOString()
        : null;

      if (payload.hvVerified) {
        updatePayload.qualification_level = "hv_verified";
        updatePayload.risk_access_level = "hv";
      }
    }
    if (nextRiskAccessLevel) updatePayload.risk_access_level = nextRiskAccessLevel;

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json(
        { error: "Keine gültige Änderung übergeben." },
        { status: 400 }
      );
    }

    const adminClient = createSupabaseAdminClient();
    const { data, error } = await adminClient
      .from("workshop_profiles")
      .update(updatePayload)
      .eq("id", targetUserId)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    await adminClient.from("safety_access_logs").insert({
      user_id: targetUserId,
      action: "admin_safety_profile_updated",
      query: "",
      source: "admin",
      risk_class: updatePayload.risk_access_level === "hv" ? "hv" : "red",
      access_decision: "allow_with_warning",
      account_type: String(updatePayload.account_type || data.account_type || "private"),
      qualification_level: String(
        updatePayload.qualification_level || data.qualification_level || "none"
      ),
      hv_verified: Boolean(updatePayload.hv_verified ?? data.hv_verified),
      warning_type: "general",
      safety_warning: "Admin hat Sicherheitsfreigabe oder Qualifikation geändert.",
      metadata: {
        adminUserId: user.id,
        reviewComment: text(payload.reviewComment),
        updatePayload,
      },
    });

    return NextResponse.json({ user: data });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Sicherheitsfreigabe konnte nicht aktualisiert werden.",
      },
      { status: 400 }
    );
  }
}
