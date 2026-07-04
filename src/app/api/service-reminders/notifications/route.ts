import { NextResponse } from "next/server";
import { loadAuthenticatedUserFromRequest } from "@/lib/supabase/auth";

type NotificationSettingsPayload = {
  emailEnabled?: unknown;
};

type NotificationSettingsRow = {
  email_enabled: boolean | null;
  reminder_days_before: number[] | null;
};

const DEFAULT_REMINDER_DAYS_BEFORE = [60, 30, 7, 0];

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function getErrorMessage(error: unknown, fallbackMessage: string) {
  if (!(error instanceof Error)) {
    return fallbackMessage;
  }

  if (
    error.message.includes("service_reminder_notification_settings") ||
    error.message.includes("relation") ||
    error.message.includes("does not exist")
  ) {
    return "Die E-Mail-Erinnerungen sind in Supabase noch nicht angelegt. Bitte die SQL-Datei supabase/migrations/20260704_service_reminder_email_notifications.sql einmal in Supabase ausführen.";
  }

  return error.message;
}

function toSettings(row: NotificationSettingsRow | null) {
  return {
    emailEnabled: Boolean(row?.email_enabled),
    reminderDaysBefore: row?.reminder_days_before || DEFAULT_REMINDER_DAYS_BEFORE,
  };
}

export async function GET(request: Request) {
  try {
    const { user, supabase } = await loadAuthenticatedUserFromRequest(request);

    const { data, error } = await supabase
      .from("service_reminder_notification_settings")
      .select("email_enabled, reminder_days_before")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return NextResponse.json(toSettings(data as NotificationSettingsRow | null));
  } catch (error) {
    const message = getErrorMessage(
      error,
      "E-Mail-Erinnerungen konnten nicht geladen werden.",
    );

    return jsonError(message, 401);
  }
}

export async function PATCH(request: Request) {
  try {
    const { user, supabase } = await loadAuthenticatedUserFromRequest(request);
    const payload = (await request.json().catch(() => ({}))) as NotificationSettingsPayload;

    if (typeof payload.emailEnabled !== "boolean") {
      return jsonError("E-Mail-Einstellung fehlt.", 400);
    }

    const { data, error } = await supabase
      .from("service_reminder_notification_settings")
      .upsert(
        {
          user_id: user.id,
          email_enabled: payload.emailEnabled,
          reminder_days_before: DEFAULT_REMINDER_DAYS_BEFORE,
        },
        { onConflict: "user_id" },
      )
      .select("email_enabled, reminder_days_before")
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json(toSettings(data as NotificationSettingsRow));
  } catch (error) {
    const message = getErrorMessage(
      error,
      "E-Mail-Erinnerungen konnten nicht gespeichert werden.",
    );

    return jsonError(message, 400);
  }
}
