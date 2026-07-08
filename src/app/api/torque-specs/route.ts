import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { loadAuthenticatedUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/supabaseAdmin";
import {
  buildTorqueSpecInsertPayload,
  buildTorqueSpecUpdatePayload,
  getTorqueReviewComment,
  getTorqueSpecAction,
  getTorqueSpecId,
  toTorqueSpec,
  validateTorqueSpecPayload,
  type TorqueSpecInput,
  type TorqueSpecRow,
} from "@/services/torqueSpecs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function getApproverEmails() {
  return (
    process.env.TORQUE_APPROVER_EMAILS ||
    process.env.DIAGNOSEHUB_OWNER_EMAIL ||
    process.env.ADMIN_EMAILS ||
    ""
  )
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function canApproveTorqueSpecs(user: User) {
  const email = user.email?.trim().toLowerCase();

  if (!email) {
    return false;
  }

  return getApproverEmails().includes(email);
}

function getErrorMessage(error: unknown, fallbackMessage: string) {
  const message =
    error instanceof Error
      ? error.message
      : error &&
          typeof error === "object" &&
          "message" in error &&
          typeof (error as { message?: unknown }).message === "string"
        ? (error as { message: string }).message
        : "";

  if (
    message.includes("torque_specs") ||
    message.includes("relation") ||
    message.includes("does not exist")
  ) {
    return "Die Drehmoment-Speicherung ist noch nicht eingerichtet. Bitte die Datenbank-Migration ausführen.";
  }

  if (message.includes("SUPABASE_SERVICE_ROLE_KEY")) {
    return "Die Freigabe-Prüfung braucht den serverseitigen Service-Schlüssel.";
  }

  return message || fallbackMessage;
}

async function readPayload(request: Request): Promise<TorqueSpecInput> {
  return (await request.json().catch(() => ({}))) as TorqueSpecInput;
}

export async function GET(request: Request) {
  try {
    const { user, supabase } = await loadAuthenticatedUserFromRequest(request);
    const canApprove = canApproveTorqueSpecs(user);
    const scope = new URL(request.url).searchParams.get("scope") || "approved";

    if (scope === "review") {
      if (!canApprove) {
        return jsonError("Nur der Betreiber-Account darf Drehmomente prüfen.", 403);
      }

      const adminClient = createSupabaseAdminClient();
      const { data, error } = await adminClient
        .from("torque_specs")
        .select("*")
        .eq("status", "pending_review")
        .order("updated_at", { ascending: false })
        .limit(200);

      if (error) {
        throw error;
      }

      return NextResponse.json({
        torqueSpecs: ((data || []) as TorqueSpecRow[]).map(toTorqueSpec),
        canApprove,
      });
    }

    if (scope === "approved") {
      const { data, error } = await supabase
        .from("torque_specs")
        .select("*")
        .eq("status", "approved")
        .eq("visibility", "shared")
        .order("updated_at", { ascending: false })
        .limit(200);

      if (error) {
        throw error;
      }

      return NextResponse.json({
        torqueSpecs: ((data || []) as TorqueSpecRow[]).map(toTorqueSpec),
        canApprove,
      });
    }

    if (scope !== "mine") {
      return jsonError("Unbekannter Drehmoment-Bereich.", 400);
    }

    const { data, error } = await supabase
      .from("torque_specs")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(200);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      torqueSpecs: ((data || []) as TorqueSpecRow[]).map(toTorqueSpec),
      canApprove,
    });
  } catch (error) {
    const message = getErrorMessage(
      error,
      "Drehmomentwerte konnten nicht geladen werden."
    );

    return jsonError(message, 400);
  }
}

export async function POST(request: Request) {
  try {
    const { user, supabase } = await loadAuthenticatedUserFromRequest(request);
    const payload = await readPayload(request);
    const insertPayload = buildTorqueSpecInsertPayload(user.id, payload);
    const validationMessage = validateTorqueSpecPayload(
      insertPayload,
      payload.submitForReview === true
    );

    if (validationMessage) {
      return jsonError(validationMessage, 400);
    }

    const { data, error } = await supabase
      .from("torque_specs")
      .insert(insertPayload)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      torqueSpec: toTorqueSpec(data as TorqueSpecRow),
      canApprove: canApproveTorqueSpecs(user),
    });
  } catch (error) {
    const message = getErrorMessage(
      error,
      "Drehmomentwert konnte nicht gespeichert werden."
    );

    return jsonError(message, 400);
  }
}

export async function PATCH(request: Request) {
  try {
    const { user, supabase } = await loadAuthenticatedUserFromRequest(request);
    const payload = await readPayload(request);
    const id = getTorqueSpecId(payload);
    const action = getTorqueSpecAction(payload);
    const canApprove = canApproveTorqueSpecs(user);

    if (!id) {
      return jsonError("Drehmoment-ID fehlt.", 400);
    }

    if (["approve", "reject", "block", "outdate"].includes(action)) {
      if (!canApprove) {
        return jsonError("Nur der Betreiber-Account darf Drehmomente freigeben.", 403);
      }

      const statusByAction = {
        approve: "approved",
        reject: "rejected",
        block: "blocked",
        outdate: "outdated",
      } as const;
      const nextStatus = statusByAction[action as keyof typeof statusByAction];
      const adminClient = createSupabaseAdminClient();
      const { data, error } = await adminClient
        .from("torque_specs")
        .update({
          status: nextStatus,
          visibility: nextStatus === "approved" ? "shared" : "private",
          review_comment: getTorqueReviewComment(payload),
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      return NextResponse.json({
        torqueSpec: toTorqueSpec(data as TorqueSpecRow),
        canApprove,
      });
    }

    const updatePayload = buildTorqueSpecUpdatePayload(payload);
    const validationMessage = validateTorqueSpecPayload(
      updatePayload,
      payload.submitForReview === true
    );

    if (validationMessage) {
      return jsonError(validationMessage, 400);
    }

    const { data, error } = await supabase
      .from("torque_specs")
      .update(updatePayload)
      .eq("id", id)
      .eq("user_id", user.id)
      .neq("status", "approved")
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      torqueSpec: toTorqueSpec(data as TorqueSpecRow),
      canApprove,
    });
  } catch (error) {
    const message = getErrorMessage(
      error,
      "Drehmomentwert konnte nicht aktualisiert werden."
    );

    return jsonError(message, 400);
  }
}

export async function DELETE(request: Request) {
  try {
    const { user, supabase } = await loadAuthenticatedUserFromRequest(request);
    const payload = await readPayload(request);
    const id = getTorqueSpecId(payload);

    if (!id) {
      return jsonError("Drehmoment-ID fehlt.", 400);
    }

    const { error } = await supabase
      .from("torque_specs")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)
      .neq("status", "approved");

    if (error) {
      throw error;
    }

    return NextResponse.json({
      ok: true,
      canApprove: canApproveTorqueSpecs(user),
    });
  } catch (error) {
    const message = getErrorMessage(
      error,
      "Drehmomentwert konnte nicht gelöscht werden."
    );

    return jsonError(message, 400);
  }
}
