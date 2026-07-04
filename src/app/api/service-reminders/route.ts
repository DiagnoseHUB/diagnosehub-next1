import { NextResponse } from "next/server";
import { findServiceIntervalPreset } from "@/data/serviceIntervalPresets";
import { loadAuthenticatedUserFromRequest } from "@/lib/supabase/auth";

type ReminderVehicleRow = {
  id: string;
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
  note: string | null;
  created_at: string;
  updated_at: string;
};

type ReminderVehiclePayload = {
  id?: unknown;
  name?: unknown;
  licensePlate?: unknown;
  makeModel?: unknown;
  firstRegistration?: unknown;
  currentMileage?: unknown;
  lastHuDate?: unknown;
  lastServiceDate?: unknown;
  lastServiceMileage?: unknown;
  serviceIntervalMonths?: unknown;
  serviceIntervalKm?: unknown;
  brakeFluidDate?: unknown;
  brakeFluidIntervalMonths?: unknown;
  note?: unknown;
};

function toText(value: unknown, fallbackValue = "") {
  if (typeof value !== "string") {
    return fallbackValue;
  }

  return value.trim();
}

function toDateOrNull(value: unknown) {
  if (typeof value !== "string" || !value) {
    return null;
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function toNumber(value: unknown, fallbackValue: number) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    return fallbackValue;
  }

  return Math.max(Math.round(parsedValue), 0);
}

function toPositiveNumber(value: unknown, fallbackValue: number) {
  return Math.max(toNumber(value, fallbackValue), 1);
}

function toNonNegativeNumber(value: unknown, fallbackValue: number) {
  return toNumber(value, fallbackValue);
}

function toVehicle(row: ReminderVehicleRow) {
  return {
    id: row.id,
    name: row.name,
    licensePlate: row.license_plate || "",
    makeModel: row.make_model || "",
    firstRegistration: row.first_registration || "",
    currentMileage: row.current_mileage ?? 0,
    lastHuDate: row.last_hu_date || "",
    lastServiceDate: row.last_service_date || "",
    lastServiceMileage: row.last_service_mileage ?? 0,
    serviceIntervalMonths: row.service_interval_months ?? 12,
    serviceIntervalKm: row.service_interval_km ?? 15000,
    brakeFluidDate: row.brake_fluid_date || "",
    brakeFluidIntervalMonths: row.brake_fluid_interval_months ?? 24,
    note: row.note || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function buildInsertPayload(userId: string, payload: ReminderVehiclePayload) {
  const intervalPreset = findServiceIntervalPreset(toText(payload.makeModel));
  const fallbackName =
    toText(payload.name) ||
    toText(payload.licensePlate) ||
    toText(payload.makeModel) ||
    "Mein Fahrzeug";

  return {
    user_id: userId,
    name: fallbackName,
    license_plate: toText(payload.licensePlate),
    make_model: toText(payload.makeModel),
    first_registration: toDateOrNull(payload.firstRegistration),
    current_mileage: toNumber(payload.currentMileage, 0),
    last_hu_date: toDateOrNull(payload.lastHuDate),
    last_service_date: toDateOrNull(payload.lastServiceDate),
    last_service_mileage: toNumber(payload.lastServiceMileage, 0),
    service_interval_months: toPositiveNumber(
      payload.serviceIntervalMonths,
      intervalPreset.months,
    ),
    service_interval_km: toNonNegativeNumber(payload.serviceIntervalKm, intervalPreset.km),
    brake_fluid_date: toDateOrNull(payload.brakeFluidDate),
    brake_fluid_interval_months: toPositiveNumber(
      payload.brakeFluidIntervalMonths,
      intervalPreset.brakeFluidMonths,
    ),
    note: toText(payload.note),
  };
}

function buildUpdatePayload(payload: ReminderVehiclePayload) {
  const updatePayload: Record<string, string | number | null> = {};

  if ("name" in payload) updatePayload.name = toText(payload.name, "Mein Fahrzeug");
  if ("licensePlate" in payload) updatePayload.license_plate = toText(payload.licensePlate);
  if ("makeModel" in payload) updatePayload.make_model = toText(payload.makeModel);
  if ("firstRegistration" in payload) {
    updatePayload.first_registration = toDateOrNull(payload.firstRegistration);
  }
  if ("currentMileage" in payload) {
    updatePayload.current_mileage = toNumber(payload.currentMileage, 0);
  }
  if ("lastHuDate" in payload) updatePayload.last_hu_date = toDateOrNull(payload.lastHuDate);
  if ("lastServiceDate" in payload) {
    updatePayload.last_service_date = toDateOrNull(payload.lastServiceDate);
  }
  if ("lastServiceMileage" in payload) {
    updatePayload.last_service_mileage = toNumber(payload.lastServiceMileage, 0);
  }
  if ("serviceIntervalMonths" in payload) {
    updatePayload.service_interval_months = toPositiveNumber(
      payload.serviceIntervalMonths,
      12,
    );
  }
  if ("serviceIntervalKm" in payload) {
    updatePayload.service_interval_km = toNonNegativeNumber(payload.serviceIntervalKm, 15000);
  }
  if ("brakeFluidDate" in payload) {
    updatePayload.brake_fluid_date = toDateOrNull(payload.brakeFluidDate);
  }
  if ("brakeFluidIntervalMonths" in payload) {
    updatePayload.brake_fluid_interval_months = toPositiveNumber(
      payload.brakeFluidIntervalMonths,
      24,
    );
  }
  if ("note" in payload) updatePayload.note = toText(payload.note);

  return updatePayload;
}

function getVehicleId(payload: ReminderVehiclePayload) {
  return typeof payload.id === "string" ? payload.id : "";
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function getErrorMessage(error: unknown, fallbackMessage: string) {
  if (!(error instanceof Error)) {
    return fallbackMessage;
  }

  if (
    error.message.includes("service_reminder_vehicles") ||
    error.message.includes("relation") ||
    error.message.includes("does not exist")
  ) {
    return "Die zentrale Service-Speicherung ist noch nicht in Supabase angelegt. Bitte die SQL-Datei supabase/migrations/20260704_service_reminder_vehicles.sql einmal in Supabase ausführen.";
  }

  return error.message;
}

export async function GET(request: Request) {
  try {
    const { user, supabase } = await loadAuthenticatedUserFromRequest(request);

    const { data, error } = await supabase
      .from("service_reminder_vehicles")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({
      vehicles: ((data || []) as ReminderVehicleRow[]).map(toVehicle),
    });
  } catch (error) {
    const message = getErrorMessage(
      error,
      "Service-Erinnerungen konnten nicht geladen werden.",
    );

    return jsonError(message, 401);
  }
}

export async function POST(request: Request) {
  try {
    const { user, supabase } = await loadAuthenticatedUserFromRequest(request);
    const payload = (await request.json().catch(() => ({}))) as ReminderVehiclePayload;

    const { data, error } = await supabase
      .from("service_reminder_vehicles")
      .insert(buildInsertPayload(user.id, payload))
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ vehicle: toVehicle(data as ReminderVehicleRow) });
  } catch (error) {
    const message = getErrorMessage(error, "Fahrzeug konnte nicht gespeichert werden.");

    return jsonError(message, 400);
  }
}

export async function PATCH(request: Request) {
  try {
    const { user, supabase } = await loadAuthenticatedUserFromRequest(request);
    const payload = (await request.json().catch(() => ({}))) as ReminderVehiclePayload;
    const vehicleId = getVehicleId(payload);

    if (!vehicleId) {
      return jsonError("Fahrzeug-ID fehlt.", 400);
    }

    const updatePayload = buildUpdatePayload(payload);

    if (Object.keys(updatePayload).length === 0) {
      return jsonError("Keine Änderungen übergeben.", 400);
    }

    const { data, error } = await supabase
      .from("service_reminder_vehicles")
      .update(updatePayload)
      .eq("id", vehicleId)
      .eq("user_id", user.id)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ vehicle: toVehicle(data as ReminderVehicleRow) });
  } catch (error) {
    const message = getErrorMessage(error, "Fahrzeug konnte nicht aktualisiert werden.");

    return jsonError(message, 400);
  }
}

export async function DELETE(request: Request) {
  try {
    const { user, supabase } = await loadAuthenticatedUserFromRequest(request);
    const payload = (await request.json().catch(() => ({}))) as ReminderVehiclePayload;
    const vehicleId = getVehicleId(payload);

    if (!vehicleId) {
      return jsonError("Fahrzeug-ID fehlt.", 400);
    }

    const { error } = await supabase
      .from("service_reminder_vehicles")
      .delete()
      .eq("id", vehicleId)
      .eq("user_id", user.id);

    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = getErrorMessage(error, "Fahrzeug konnte nicht gelöscht werden.");

    return jsonError(message, 400);
  }
}
