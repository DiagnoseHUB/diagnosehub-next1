import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReminderType = "hu" | "service" | "brake-fluid";

type NotificationSettingsRow = {
  user_id: string;
  reminder_days_before: number[] | null;
  unsubscribe_token: string;
};

type ReminderVehicleRow = {
  id: string;
  user_id: string;
  name: string;
  license_plate: string | null;
  make_model: string | null;
  first_registration: string | null;
  current_mileage: number | null;
  last_hu_date: string | null;
  last_service_date: string | null;
  last_service_mileage: number | null;
  service_interval_months: number | null;
  service_interval_km: number | null;
  brake_fluid_date: string | null;
  brake_fluid_interval_months: number | null;
};

type SentNoticeRow = {
  vehicle_id: string;
  reminder_type: ReminderType;
  notice_key: string;
};

type ReminderCandidate = {
  vehicleId: string;
  vehicleName: string;
  vehicleMeta: string;
  type: ReminderType;
  title: string;
  dueDate: string | null;
  dueMileage: number | null;
  noticeKey: string;
  summary: string;
};

type ResendEmailResponse = {
  id?: string;
  message?: string;
  error?: string;
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const DEFAULT_REMINDER_DAYS_BEFORE = [60, 30, 7, 0];

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} fehlt.`);
  }

  return value;
}

function getSiteUrl() {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    "http://localhost:3000";

  if (siteUrl.startsWith("http://") || siteUrl.startsWith("https://")) {
    return siteUrl.replace(/\/$/, "");
  }

  return `https://${siteUrl.replace(/\/$/, "")}`;
}

function isAuthorized(request: NextRequest) {
  const expectedSecret =
    process.env.SERVICE_REMINDER_CRON_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim();

  if (!expectedSecret) {
    throw new Error("SERVICE_REMINDER_CRON_SECRET oder CRON_SECRET fehlt.");
  }

  const authorizationHeader = request.headers.get("authorization") || "";
  const bearerToken = authorizationHeader.toLowerCase().startsWith("bearer ")
    ? authorizationHeader.slice("bearer ".length).trim()
    : "";
  const headerToken = request.headers.get("x-cron-secret") || "";

  return bearerToken === expectedSecret || headerToken === expectedSecret;
}

function parseDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return null;
  }

  return new Date(Date.UTC(year, month - 1, day));
}

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addMonths(dateValue: string | null, months: number) {
  const date = parseDate(dateValue);

  if (!date) {
    return null;
  }

  const nextDate = new Date(date);
  nextDate.setUTCMonth(nextDate.getUTCMonth() + months);

  return toDateInputValue(nextDate);
}

function getDaysUntil(dateValue: string) {
  const date = parseDate(dateValue);

  if (!date) {
    return null;
  }

  const today = new Date();
  const todayUtc = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );

  return Math.ceil((date.getTime() - todayUtc.getTime()) / DAY_IN_MS);
}

function formatDate(dateValue: string | null) {
  const date = parseDate(dateValue);

  if (!date) {
    return "kein Datum";
  }

  return date.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function getVehicleMeta(vehicle: ReminderVehicleRow) {
  return [vehicle.license_plate, vehicle.make_model].filter(Boolean).join(" · ");
}

function getHuDueDate(vehicle: ReminderVehicleRow) {
  if (vehicle.last_hu_date) {
    return addMonths(vehicle.last_hu_date, 24);
  }

  if (vehicle.first_registration) {
    return addMonths(vehicle.first_registration, 36);
  }

  return null;
}

function getDateNoticeKeys(dueDate: string | null, reminderDaysBefore: number[]) {
  if (!dueDate) {
    return [];
  }

  const daysUntil = getDaysUntil(dueDate);

  if (daysUntil === null) {
    return [];
  }

  if (daysUntil < 0) {
    return [`date:${dueDate}:overdue`];
  }

  return reminderDaysBefore
    .filter((daysBefore) => daysUntil <= daysBefore)
    .sort((firstDay, secondDay) => firstDay - secondDay)
    .map((daysBefore) => `date:${dueDate}:d${daysBefore}`);
}

function getMileageNoticeKeys(dueMileage: number | null, currentMileage: number) {
  if (!dueMileage) {
    return [];
  }

  const remainingMileage = dueMileage - currentMileage;

  if (remainingMileage < 0) {
    return [`km:${dueMileage}:overdue`];
  }

  if (remainingMileage <= 1500) {
    return [`km:${dueMileage}:soon`];
  }

  return [];
}

function getReminderSummary(candidate: {
  dueDate: string | null;
  dueMileage: number | null;
  currentMileage: number;
}) {
  const parts: string[] = [];

  if (candidate.dueDate) {
    const daysUntil = getDaysUntil(candidate.dueDate);
    const dateText = formatDate(candidate.dueDate);

    if (daysUntil === null) {
      parts.push(`fällig am ${dateText}`);
    } else if (daysUntil < 0) {
      parts.push(`seit ${Math.abs(daysUntil)} Tagen fällig (${dateText})`);
    } else if (daysUntil === 0) {
      parts.push(`heute fällig (${dateText})`);
    } else {
      parts.push(`in ${daysUntil} Tagen fällig (${dateText})`);
    }
  }

  if (candidate.dueMileage) {
    const remainingMileage = candidate.dueMileage - candidate.currentMileage;
    const dueMileageText = candidate.dueMileage.toLocaleString("de-DE");

    if (remainingMileage < 0) {
      parts.push(`seit ${Math.abs(remainingMileage).toLocaleString("de-DE")} km fällig`);
    } else {
      parts.push(`bei ${dueMileageText} km fällig`);
    }
  }

  return parts.join(", ");
}

function selectFirstUnsentNoticeKey({
  noticeKeys,
  sentNotices,
  vehicleId,
  type,
}: {
  noticeKeys: string[];
  sentNotices: Set<string>;
  vehicleId: string;
  type: ReminderType;
}) {
  return noticeKeys.find(
    (noticeKey) => !sentNotices.has(`${vehicleId}|${type}|${noticeKey}`),
  );
}

function buildCandidatesForVehicle({
  vehicle,
  reminderDaysBefore,
  sentNotices,
}: {
  vehicle: ReminderVehicleRow;
  reminderDaysBefore: number[];
  sentNotices: Set<string>;
}) {
  const candidates: ReminderCandidate[] = [];
  const vehicleName = vehicle.name || "Mein Fahrzeug";
  const vehicleMeta = getVehicleMeta(vehicle);
  const currentMileage = vehicle.current_mileage ?? 0;

  const huDueDate = getHuDueDate(vehicle);
  const huNoticeKey = selectFirstUnsentNoticeKey({
    noticeKeys: getDateNoticeKeys(huDueDate, reminderDaysBefore),
    sentNotices,
    vehicleId: vehicle.id,
    type: "hu",
  });

  if (huDueDate && huNoticeKey) {
    candidates.push({
      vehicleId: vehicle.id,
      vehicleName,
      vehicleMeta,
      type: "hu",
      title: "Hauptuntersuchung / AU",
      dueDate: huDueDate,
      dueMileage: null,
      noticeKey: huNoticeKey,
      summary: getReminderSummary({
        dueDate: huDueDate,
        dueMileage: null,
        currentMileage,
      }),
    });
  }

  if (vehicle.last_service_date || (vehicle.last_service_mileage ?? 0) > 0) {
    const serviceDueDate = vehicle.last_service_date
      ? addMonths(vehicle.last_service_date, vehicle.service_interval_months ?? 12)
      : null;
    const serviceDueMileage =
      (vehicle.last_service_mileage ?? 0) > 0
        ? (vehicle.last_service_mileage ?? 0) + (vehicle.service_interval_km ?? 15000)
        : null;
    const serviceNoticeKey = selectFirstUnsentNoticeKey({
      noticeKeys: [
        ...getDateNoticeKeys(serviceDueDate, reminderDaysBefore),
        ...getMileageNoticeKeys(serviceDueMileage, currentMileage),
      ],
      sentNotices,
      vehicleId: vehicle.id,
      type: "service",
    });

    if (serviceNoticeKey) {
      candidates.push({
        vehicleId: vehicle.id,
        vehicleName,
        vehicleMeta,
        type: "service",
        title: "Hersteller-Service",
        dueDate: serviceDueDate,
        dueMileage: serviceDueMileage,
        noticeKey: serviceNoticeKey,
        summary: getReminderSummary({
          dueDate: serviceDueDate,
          dueMileage: serviceDueMileage,
          currentMileage,
        }),
      });
    }
  }

  if (vehicle.brake_fluid_date) {
    const brakeFluidDueDate = addMonths(
      vehicle.brake_fluid_date,
      vehicle.brake_fluid_interval_months ?? 24,
    );
    const brakeFluidNoticeKey = selectFirstUnsentNoticeKey({
      noticeKeys: getDateNoticeKeys(brakeFluidDueDate, reminderDaysBefore),
      sentNotices,
      vehicleId: vehicle.id,
      type: "brake-fluid",
    });

    if (brakeFluidDueDate && brakeFluidNoticeKey) {
      candidates.push({
        vehicleId: vehicle.id,
        vehicleName,
        vehicleMeta,
        type: "brake-fluid",
        title: "Bremsflüssigkeit",
        dueDate: brakeFluidDueDate,
        dueMileage: null,
        noticeKey: brakeFluidNoticeKey,
        summary: getReminderSummary({
          dueDate: brakeFluidDueDate,
          dueMileage: null,
          currentMileage,
        }),
      });
    }
  }

  return candidates;
}

function buildEmailHtml({
  candidates,
  unsubscribeUrl,
}: {
  candidates: ReminderCandidate[];
  unsubscribeUrl: string;
}) {
  const rows = candidates
    .map((candidate) => {
      const meta = candidate.vehicleMeta
        ? `<p style="margin:4px 0 0;color:#64748b;font-size:13px;">${escapeHtml(
            candidate.vehicleMeta,
          )}</p>`
        : "";

      return `
        <tr>
          <td style="padding:16px;border-bottom:1px solid #e2e8f0;">
            <strong style="color:#0f172a;">${escapeHtml(candidate.title)}</strong>
            <p style="margin:6px 0 0;color:#334155;">${escapeHtml(candidate.vehicleName)}</p>
            ${meta}
            <p style="margin:8px 0 0;color:#475569;">${escapeHtml(candidate.summary)}</p>
          </td>
        </tr>
      `;
    })
    .join("");

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;background:#f8fafc;padding:24px;">
      <div style="max-width:640px;margin:0 auto;background:white;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
        <div style="background:#1d4ed8;color:white;padding:22px 24px;">
          <p style="margin:0;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">DiagnoseHUB</p>
          <h1 style="margin:8px 0 0;font-size:24px;">Service-Erinnerung</h1>
        </div>
        <div style="padding:24px;">
          <p style="margin:0 0 16px;color:#334155;">
            Für deine gespeicherten Fahrzeuge stehen diese Punkte an:
          </p>
          <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
            ${rows}
          </table>
          <p style="margin:20px 0 0;color:#475569;font-size:14px;">
            Dies ist eine sachliche Service-Erinnerung auf Basis deiner gespeicherten Fahrzeugdaten.
            Bitte prüfe die Angaben vor Terminbuchung oder Reparatur.
          </p>
          <p style="margin:18px 0 0;font-size:13px;color:#64748b;">
            E-Mail-Erinnerungen kannst du jederzeit in DiagnoseHUB deaktivieren oder direkt über diesen Link abbestellen:
            <a href="${escapeHtml(unsubscribeUrl)}" style="color:#1d4ed8;">Erinnerungen abbestellen</a>
          </p>
        </div>
      </div>
    </div>
  `;
}

function buildEmailText({
  candidates,
  unsubscribeUrl,
}: {
  candidates: ReminderCandidate[];
  unsubscribeUrl: string;
}) {
  const rows = candidates
    .map((candidate) => {
      const meta = candidate.vehicleMeta ? ` (${candidate.vehicleMeta})` : "";

      return `- ${candidate.title}: ${candidate.vehicleName}${meta} - ${candidate.summary}`;
    })
    .join("\n");

  return [
    "DiagnoseHUB Service-Erinnerung",
    "",
    "Für deine gespeicherten Fahrzeuge stehen diese Punkte an:",
    rows,
    "",
    "Dies ist eine sachliche Service-Erinnerung auf Basis deiner gespeicherten Fahrzeugdaten.",
    `Abbestellen: ${unsubscribeUrl}`,
  ].join("\n");
}

async function sendReminderEmail({
  to,
  candidates,
  unsubscribeToken,
}: {
  to: string;
  candidates: ReminderCandidate[];
  unsubscribeToken: string;
}) {
  const resendApiKey = getRequiredEnv("RESEND_API_KEY");
  const from = getRequiredEnv("SERVICE_REMINDER_EMAIL_FROM");
  const siteUrl = getSiteUrl();
  const unsubscribeUrl = `${siteUrl}/api/service-reminders/notifications/unsubscribe?token=${encodeURIComponent(
    unsubscribeToken,
  )}`;
  const subject =
    candidates.length === 1
      ? `DiagnoseHUB: ${candidates[0].title} fällig`
      : `DiagnoseHUB: ${candidates.length} Service-Erinnerungen`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html: buildEmailHtml({ candidates, unsubscribeUrl }),
      text: buildEmailText({ candidates, unsubscribeUrl }),
    }),
  });
  const responseText = await response.text();
  let responseJson: ResendEmailResponse = {};

  try {
    responseJson = JSON.parse(responseText) as ResendEmailResponse;
  } catch {
    responseJson = { message: responseText };
  }

  if (!response.ok) {
    throw new Error(
      responseJson.message ||
        responseJson.error ||
        `E-Mail konnte nicht gesendet werden. Status: ${response.status}`,
    );
  }

  return responseJson.id || null;
}

async function processUserReminders({
  setting,
  vehicles,
}: {
  setting: NotificationSettingsRow;
  vehicles: ReminderVehicleRow[];
}) {
  const supabase = createSupabaseAdminClient();
  const userVehicles = vehicles.filter((vehicle) => vehicle.user_id === setting.user_id);

  if (userVehicles.length === 0) {
    return { sent: 0, reminders: 0, skipped: "no-vehicles" };
  }

  const { data: userData, error: userError } = await supabase.auth.admin.getUserById(
    setting.user_id,
  );

  if (userError) {
    throw new Error(`Nutzer konnte nicht geladen werden: ${userError.message}`);
  }

  const recipientEmail = userData.user?.email || "";

  if (!recipientEmail) {
    return { sent: 0, reminders: 0, skipped: "no-email" };
  }

  const { data: sentRows, error: sentRowsError } = await supabase
    .from("service_reminder_notification_log")
    .select("vehicle_id, reminder_type, notice_key")
    .eq("user_id", setting.user_id);

  if (sentRowsError) {
    throw sentRowsError;
  }

  const sentNotices = new Set(
    ((sentRows || []) as SentNoticeRow[]).map(
      (row) => `${row.vehicle_id}|${row.reminder_type}|${row.notice_key}`,
    ),
  );
  const reminderDaysBefore =
    setting.reminder_days_before && setting.reminder_days_before.length > 0
      ? setting.reminder_days_before
      : DEFAULT_REMINDER_DAYS_BEFORE;
  const candidates = userVehicles.flatMap((vehicle) =>
    buildCandidatesForVehicle({
      vehicle,
      reminderDaysBefore,
      sentNotices,
    }),
  );

  if (candidates.length === 0) {
    return { sent: 0, reminders: 0, skipped: "no-due-reminders" };
  }

  const providerMessageId = await sendReminderEmail({
    to: recipientEmail,
    candidates,
    unsubscribeToken: setting.unsubscribe_token,
  });

  const now = new Date().toISOString();
  const { error: insertError } = await supabase
    .from("service_reminder_notification_log")
    .insert(
      candidates.map((candidate) => ({
        user_id: setting.user_id,
        vehicle_id: candidate.vehicleId,
        reminder_type: candidate.type,
        notice_key: candidate.noticeKey,
        due_date: candidate.dueDate,
        due_mileage: candidate.dueMileage,
        recipient_email: recipientEmail,
        provider_message_id: providerMessageId,
        sent_at: now,
      })),
    );

  if (insertError) {
    throw insertError;
  }

  return { sent: 1, reminders: candidates.length, skipped: "" };
}

async function runEmailReminderJob(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Nicht erlaubt." }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: settings, error: settingsError } = await supabase
    .from("service_reminder_notification_settings")
    .select("user_id, reminder_days_before, unsubscribe_token")
    .eq("email_enabled", true);

  if (settingsError) {
    throw settingsError;
  }

  const enabledSettings = (settings || []) as NotificationSettingsRow[];
  const userIds = enabledSettings.map((setting) => setting.user_id);

  if (userIds.length === 0) {
    return NextResponse.json({
      ok: true,
      checkedUsers: 0,
      sentEmails: 0,
      sentReminders: 0,
      errors: [],
    });
  }

  const { data: vehicles, error: vehiclesError } = await supabase
    .from("service_reminder_vehicles")
    .select("*")
    .in("user_id", userIds);

  if (vehiclesError) {
    throw vehiclesError;
  }

  let sentEmails = 0;
  let sentReminders = 0;
  const errors: string[] = [];

  for (const setting of enabledSettings) {
    try {
      const result = await processUserReminders({
        setting,
        vehicles: (vehicles || []) as ReminderVehicleRow[],
      });

      sentEmails += result.sent;
      sentReminders += result.reminders;
    } catch (error) {
      errors.push(
        `${setting.user_id}: ${
          error instanceof Error ? error.message : "Unbekannter Fehler"
        }`,
      );
    }
  }

  return NextResponse.json({
    ok: errors.length === 0,
    checkedUsers: enabledSettings.length,
    sentEmails,
    sentReminders,
    errors,
  });
}

export async function GET(request: NextRequest) {
  try {
    return await runEmailReminderJob(request);
  } catch (error) {
    console.error("Service-Erinnerungs-Mail Fehler:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Service-Erinnerungs-Mails konnten nicht gesendet werden.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
