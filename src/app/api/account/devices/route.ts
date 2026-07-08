import { NextResponse } from "next/server";
import { isValidUserPlan, type UserPlan } from "@/config/plans";
import { loadAuthenticatedUserFromRequest } from "@/lib/supabase/auth";

type DevicePayload = {
  deviceId?: unknown;
  deviceName?: unknown;
};

type WorkshopProfileRow = {
  plan: string | null;
  workshop_name: string | null;
  role: string | null;
};

type DeviceRegistrationRow = {
  id: string;
  device_id: string;
  device_name: string | null;
  created_at: string;
  last_seen_at: string;
};

const ACCOUNT_DEVICE_LIMIT = 3;
const STALE_DEVICE_DAYS = 90;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function getReadableErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const errorRecord = error as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
      code?: unknown;
    };
    const parts = [
      errorRecord.message,
      errorRecord.details,
      errorRecord.hint,
      errorRecord.code,
    ].filter((part): part is string => {
      return typeof part === "string" && part.trim().length > 0;
    });

    if (parts.length > 0) {
      return parts.join(" ");
    }
  }

  if (typeof error === "string") {
    return error;
  }

  return "";
}

function cleanText(value: unknown, fallback: string, maxLength: number) {
  if (typeof value !== "string") {
    return fallback;
  }

  const cleanedValue = value.trim().replace(/\s+/g, " ");

  if (!cleanedValue) {
    return fallback;
  }

  return cleanedValue.slice(0, maxLength);
}

function cleanDeviceId(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  const cleanedValue = value.trim();

  if (!/^[a-zA-Z0-9._:-]{8,160}$/.test(cleanedValue)) {
    return "";
  }

  return cleanedValue;
}

function getAccountType(profile: WorkshopProfileRow | null) {
  const plan = profile?.plan || "";
  const role = (profile?.role || "").toLowerCase();
  const workshopName = (profile?.workshop_name || "").trim().toLowerCase();
  const hasWorkshopName =
    workshopName.length > 0 &&
    workshopName !== "nicht angegeben" &&
    workshopName !== "profil noch nicht gespeichert";

  if (
    plan === "werkstatt" ||
    hasWorkshopName ||
    role.includes("werkstatt") ||
    role.includes("mechaniker") ||
    role.includes("meister") ||
    role.includes("inhaber") ||
    role.includes("schule") ||
    role.includes("ausbilder")
  ) {
    return "workshop" as const;
  }

  return "private" as const;
}

function getDeviceLimit() {
  return ACCOUNT_DEVICE_LIMIT;
}

function getDeviceLimitMessage(maxDevices: number) {
  return `Dieses Konto ist bereits auf ${maxDevices} aktiven Geräten/Sessions aktiv.`;
}

function toDevice(row: DeviceRegistrationRow, currentDeviceId: string) {
  return {
    id: row.id,
    deviceId: row.device_id,
    deviceName: row.device_name || "Unbekanntes Gerät",
    current: row.device_id === currentDeviceId,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
  };
}

async function loadProfileAndPlan(
  supabase: Awaited<ReturnType<typeof loadAuthenticatedUserFromRequest>>["supabase"],
  userId: string
) {
  const { data, error } = await supabase
    .from("workshop_profiles")
    .select("plan, workshop_name, role")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const profile = (data || null) as WorkshopProfileRow | null;
  const plan: UserPlan = isValidUserPlan(profile?.plan) ? profile.plan : "free";
  const accountType = getAccountType(profile);

  return {
    profile,
    plan,
    accountType,
    maxDevices: getDeviceLimit(),
  };
}

async function revokeStaleDevices(
  supabase: Awaited<ReturnType<typeof loadAuthenticatedUserFromRequest>>["supabase"],
  userId: string
) {
  const staleCutoff = new Date(
    Date.now() - STALE_DEVICE_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const { error } = await supabase
    .from("device_registrations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("revoked_at", null)
    .lt("last_seen_at", staleCutoff);

  if (error) {
    throw error;
  }
}

async function loadActiveDevices(
  supabase: Awaited<ReturnType<typeof loadAuthenticatedUserFromRequest>>["supabase"],
  userId: string
) {
  const { data, error } = await supabase
    .from("device_registrations")
    .select("id, device_id, device_name, created_at, last_seen_at")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .order("last_seen_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []) as DeviceRegistrationRow[];
}

function getMissingMigrationMessage(error: unknown) {
  const message = getReadableErrorMessage(error);

  if (
    message.includes("device_registrations") ||
    message.includes("relation") ||
    message.includes("does not exist")
  ) {
    return "Die Gerätebegrenzung ist noch nicht eingerichtet. Bitte die passende Datenbank-Migration ausführen.";
  }

  return message || "Gerätezugriff konnte nicht geprüft werden.";
}

export async function GET(request: Request) {
  try {
    const { user, supabase } = await loadAuthenticatedUserFromRequest(request);
    const deviceId = request.headers.get("x-diagnosehub-device-id") || "";

    const access = await loadProfileAndPlan(supabase, user.id);
    await revokeStaleDevices(supabase, user.id);

    const activeDevices = await loadActiveDevices(supabase, user.id);

    return NextResponse.json({
      ok: true,
      plan: access.plan,
      accountType: access.accountType,
      maxDevices: access.maxDevices,
      activeDeviceCount: activeDevices.length,
      currentDeviceId: deviceId,
      devices: activeDevices.map((row) => toDevice(row, deviceId)),
    });
  } catch (error) {
    return jsonError(getMissingMigrationMessage(error), 400);
  }
}

export async function POST(request: Request) {
  try {
    const { user, supabase } = await loadAuthenticatedUserFromRequest(request);
    const payload = (await request.json().catch(() => ({}))) as DevicePayload;
    const deviceId = cleanDeviceId(payload.deviceId);
    const deviceName = cleanText(payload.deviceName, "Dieses Gerät", 80);
    const userAgent = cleanText(request.headers.get("user-agent"), "", 500);

    if (!deviceId) {
      return jsonError("Geräte-ID fehlt oder ist ungültig.", 400);
    }

    const access = await loadProfileAndPlan(supabase, user.id);
    await revokeStaleDevices(supabase, user.id);

    const activeDevices = await loadActiveDevices(supabase, user.id);
    const existingDevice = activeDevices.find((device) => {
      return device.device_id === deviceId;
    });

    if (existingDevice) {
      const { error } = await supabase
        .from("device_registrations")
        .update({
          device_name: deviceName,
          user_agent: userAgent,
          revoked_at: null,
        })
        .eq("user_id", user.id)
        .eq("device_id", deviceId);

      if (error) {
        throw error;
      }

      const updatedDevices = await loadActiveDevices(supabase, user.id);

      return NextResponse.json({
        ok: true,
        plan: access.plan,
        accountType: access.accountType,
        maxDevices: access.maxDevices,
        activeDeviceCount: updatedDevices.length,
        currentDeviceId: deviceId,
        devices: updatedDevices.map((row) => toDevice(row, deviceId)),
      });
    }

    const { data: previousDevice, error: previousDeviceError } = await supabase
      .from("device_registrations")
      .select("id")
      .eq("user_id", user.id)
      .eq("device_id", deviceId)
      .maybeSingle();

    if (previousDeviceError) {
      throw previousDeviceError;
    }

    if (previousDevice) {
      if (activeDevices.length >= access.maxDevices) {
        return NextResponse.json(
          {
            ok: false,
            code: "DEVICE_LIMIT_REACHED",
            error: getDeviceLimitMessage(access.maxDevices),
            plan: access.plan,
            accountType: access.accountType,
            maxDevices: access.maxDevices,
            activeDeviceCount: activeDevices.length,
            currentDeviceId: deviceId,
            devices: activeDevices.map((row) => toDevice(row, deviceId)),
          },
          { status: 403 }
        );
      }

      const { error } = await supabase
        .from("device_registrations")
        .update({
          device_name: deviceName,
          user_agent: userAgent,
          revoked_at: null,
        })
        .eq("user_id", user.id)
        .eq("device_id", deviceId);

      if (error) {
        throw error;
      }

      const updatedDevices = await loadActiveDevices(supabase, user.id);

      return NextResponse.json({
        ok: true,
        plan: access.plan,
        accountType: access.accountType,
        maxDevices: access.maxDevices,
        activeDeviceCount: updatedDevices.length,
        currentDeviceId: deviceId,
        devices: updatedDevices.map((row) => toDevice(row, deviceId)),
      });
    }

    if (activeDevices.length >= access.maxDevices) {
      return NextResponse.json(
        {
          ok: false,
          code: "DEVICE_LIMIT_REACHED",
          error: getDeviceLimitMessage(access.maxDevices),
          plan: access.plan,
          accountType: access.accountType,
          maxDevices: access.maxDevices,
          activeDeviceCount: activeDevices.length,
          currentDeviceId: deviceId,
          devices: activeDevices.map((row) => toDevice(row, deviceId)),
        },
        { status: 403 }
      );
    }

    const { error } = await supabase.from("device_registrations").insert({
      user_id: user.id,
      device_id: deviceId,
      device_name: deviceName,
      user_agent: userAgent,
    });

    if (error) {
      throw error;
    }

    const updatedDevices = await loadActiveDevices(supabase, user.id);

    return NextResponse.json({
      ok: true,
      plan: access.plan,
      accountType: access.accountType,
      maxDevices: access.maxDevices,
      activeDeviceCount: updatedDevices.length,
      currentDeviceId: deviceId,
      devices: updatedDevices.map((row) => toDevice(row, deviceId)),
    });
  } catch (error) {
    return jsonError(getMissingMigrationMessage(error), 400);
  }
}

export async function DELETE(request: Request) {
  try {
    const { user, supabase } = await loadAuthenticatedUserFromRequest(request);
    const payload = (await request.json().catch(() => ({}))) as DevicePayload;
    const deviceId = cleanDeviceId(payload.deviceId);

    if (!deviceId) {
      return jsonError("Geräte-ID fehlt oder ist ungültig.", 400);
    }

    const { error } = await supabase
      .from("device_registrations")
      .delete()
      .eq("user_id", user.id)
      .eq("device_id", deviceId);

    if (error) {
      throw error;
    }

    const access = await loadProfileAndPlan(supabase, user.id);
    const activeDevices = await loadActiveDevices(supabase, user.id);

    return NextResponse.json({
      ok: true,
      plan: access.plan,
      accountType: access.accountType,
      maxDevices: access.maxDevices,
      activeDeviceCount: activeDevices.length,
      currentDeviceId: deviceId,
      devices: activeDevices.map((row) => toDevice(row, deviceId)),
    });
  } catch (error) {
    return jsonError(getMissingMigrationMessage(error), 400);
  }
}
