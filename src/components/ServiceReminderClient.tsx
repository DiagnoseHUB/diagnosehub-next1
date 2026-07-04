"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  findServiceIntervalPreset,
  isLongLifeServiceText,
} from "@/data/serviceIntervalPresets";
import { createClient } from "@/lib/supabase/client";
import StripeCheckoutButton from "@/components/StripeCheckoutButton";

type ReminderStatus = "overdue" | "soon" | "ok";

type ReminderType = "hu" | "service" | "brake-fluid";

type ServiceReminderVehicle = {
  id: string;
  name: string;
  licensePlate: string;
  makeModel: string;
  firstRegistration: string;
  currentMileage: number;
  lastHuDate: string;
  lastServiceDate: string;
  lastServiceMileage: number;
  serviceIntervalMonths: number;
  serviceIntervalKm: number;
  brakeFluidDate: string;
  brakeFluidIntervalMonths: number;
  note: string;
  createdAt: string;
  updatedAt: string;
};

type ReminderItem = {
  id: string;
  vehicleId: string;
  vehicleName: string;
  title: string;
  type: ReminderType;
  dueDate?: string;
  dueMileage?: number;
  status: ReminderStatus;
  detail: string;
};

type VehicleFormState = {
  name: string;
  licensePlate: string;
  makeModel: string;
  firstRegistration: string;
  currentMileage: string;
  lastHuDate: string;
  lastServiceDate: string;
  lastServiceMileage: string;
  serviceIntervalMonths: string;
  serviceIntervalKm: string;
  brakeFluidDate: string;
  brakeFluidIntervalMonths: string;
  note: string;
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const defaultFormState: VehicleFormState = {
  name: "",
  licensePlate: "",
  makeModel: "",
  firstRegistration: "",
  currentMileage: "",
  lastHuDate: "",
  lastServiceDate: "",
  lastServiceMileage: "",
  serviceIntervalMonths: "12",
  serviceIntervalKm: "15000",
  brakeFluidDate: "",
  brakeFluidIntervalMonths: "24",
  note: "",
};

function parseDate(value: string) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T00:00:00`);

  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value?: string) {
  const date = value ? parseDate(value) : null;

  if (!date) {
    return "kein Datum";
  }

  return date.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addMonths(dateValue: string, months: number) {
  const date = parseDate(dateValue);

  if (!date) {
    return "";
  }

  const nextDate = new Date(date);
  nextDate.setMonth(nextDate.getMonth() + months);

  return toDateInputValue(nextDate);
}

function getDaysUntil(dateValue: string) {
  const date = parseDate(dateValue);

  if (!date) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Math.ceil((date.getTime() - today.getTime()) / DAY_IN_MS);
}

function getDateStatus(dateValue: string, warningDays = 45): ReminderStatus {
  const daysUntil = getDaysUntil(dateValue);

  if (daysUntil === null) {
    return "ok";
  }

  if (daysUntil < 0) {
    return "overdue";
  }

  if (daysUntil <= warningDays) {
    return "soon";
  }

  return "ok";
}

function getMileageStatus(currentMileage: number, dueMileage: number): ReminderStatus {
  const remainingKm = dueMileage - currentMileage;

  if (remainingKm < 0) {
    return "overdue";
  }

  if (remainingKm <= 1500) {
    return "soon";
  }

  return "ok";
}

function combineStatus(firstStatus: ReminderStatus, secondStatus: ReminderStatus) {
  if (firstStatus === "overdue" || secondStatus === "overdue") {
    return "overdue";
  }

  if (firstStatus === "soon" || secondStatus === "soon") {
    return "soon";
  }

  return "ok";
}

function getHuDueDate(vehicle: ServiceReminderVehicle) {
  if (vehicle.lastHuDate) {
    return addMonths(vehicle.lastHuDate, 24);
  }

  if (vehicle.firstRegistration) {
    return addMonths(vehicle.firstRegistration, 36);
  }

  return "";
}

function buildReminders(vehicles: ServiceReminderVehicle[]): ReminderItem[] {
  return vehicles.flatMap((vehicle) => {
    const reminders: ReminderItem[] = [];
    const huDueDate = getHuDueDate(vehicle);

    if (huDueDate) {
      reminders.push({
        id: `${vehicle.id}:hu`,
        vehicleId: vehicle.id,
        vehicleName: vehicle.name,
        title: "Hauptuntersuchung / AU",
        type: "hu",
        dueDate: huDueDate,
        status: getDateStatus(huDueDate, 60),
        detail: vehicle.lastHuDate
          ? "Aus letzter HU plus 24 Monate berechnet."
          : "Aus Erstzulassung plus 36 Monate berechnet.",
      });
    }

    if (vehicle.lastServiceDate || vehicle.lastServiceMileage > 0) {
      const serviceDueDate = vehicle.lastServiceDate
        ? addMonths(vehicle.lastServiceDate, vehicle.serviceIntervalMonths)
        : "";
      const serviceDueMileage =
        vehicle.lastServiceMileage > 0
          ? vehicle.lastServiceMileage + vehicle.serviceIntervalKm
          : 0;
      const dateStatus = serviceDueDate ? getDateStatus(serviceDueDate, 45) : "ok";
      const mileageStatus =
        serviceDueMileage > 0
          ? getMileageStatus(vehicle.currentMileage, serviceDueMileage)
          : "ok";

      reminders.push({
        id: `${vehicle.id}:service`,
        vehicleId: vehicle.id,
        vehicleName: vehicle.name,
        title: "Hersteller-Service",
        type: "service",
        dueDate: serviceDueDate || undefined,
        dueMileage: serviceDueMileage || undefined,
        status: combineStatus(dateStatus, mileageStatus),
        detail:
          "Nach automatisch erkanntem Serviceintervall berechnet. Bei Bedarf kannst du den Wert in den Details korrigieren.",
      });
    }

    if (vehicle.brakeFluidDate) {
      const brakeFluidDueDate = addMonths(
        vehicle.brakeFluidDate,
        vehicle.brakeFluidIntervalMonths,
      );

      reminders.push({
        id: `${vehicle.id}:brake-fluid`,
        vehicleId: vehicle.id,
        vehicleName: vehicle.name,
        title: "Bremsflüssigkeit",
        type: "brake-fluid",
        dueDate: brakeFluidDueDate,
        status: getDateStatus(brakeFluidDueDate, 45),
        detail: "Nach automatisch gesetztem Intervall berechnet.",
      });
    }

    return reminders;
  });
}

function getStatusLabel(status: ReminderStatus) {
  if (status === "overdue") return "Überfällig";
  if (status === "soon") return "Bald fällig";
  return "In Ordnung";
}

function getStatusClass(status: ReminderStatus) {
  if (status === "overdue") {
    return "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300";
  }

  if (status === "soon") {
    return "border-yellow-500/30 bg-yellow-500/10 text-yellow-800 dark:text-yellow-300";
  }

  return "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-300";
}

function toNumber(value: string, fallbackValue: number) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    return fallbackValue;
  }

  return Math.max(Math.round(parsedValue), 0);
}

function getApiErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Die Service-Erinnerung konnte gerade nicht gespeichert werden.";
}

export default function ServiceReminderClient() {
  const supabase = useMemo(() => createClient(), []);
  const [vehicles, setVehicles] = useState<ServiceReminderVehicle[]>([]);
  const [formState, setFormState] = useState<VehicleFormState>(defaultFormState);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState(false);
  const [notificationLoading, setNotificationLoading] = useState(true);
  const [notificationSaving, setNotificationSaving] = useState(false);
  const [longLifeSelected, setLongLifeSelected] = useState(false);
  const [notice, setNotice] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const detectedIntervalPreset = useMemo(
    () => findServiceIntervalPreset(formState.makeModel, { longLife: longLifeSelected }),
    [formState.makeModel, longLifeSelected],
  );

  const longLifeDetectedFromText = useMemo(
    () => isLongLifeServiceText(formState.makeModel),
    [formState.makeModel],
  );

  const getAccessToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token || "";

    setAuthRequired(!accessToken);

    return accessToken;
  }, [supabase]);

  const loadVehicles = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        setVehicles([]);
        return;
      }

      const response = await fetch("/api/service-reminders", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Service-Erinnerungen konnten nicht geladen werden.");
      }

      setVehicles(payload.vehicles || []);
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  const loadNotificationSettings = useCallback(async () => {
    setNotificationLoading(true);

    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        setEmailNotificationsEnabled(false);
        return;
      }

      const response = await fetch("/api/service-reminders/notifications", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "E-Mail-Erinnerungen konnten nicht geladen werden.");
      }

      setEmailNotificationsEnabled(Boolean(payload.emailEnabled));
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error));
    } finally {
      setNotificationLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void loadVehicles();
      void loadNotificationSettings();
    }, 0);

    return () => window.clearTimeout(loadTimer);
  }, [loadVehicles, loadNotificationSettings]);

  useEffect(() => {
    const serviceMailTimer = window.setTimeout(() => {
      const query = new URLSearchParams(window.location.search);
      const serviceMailState = query.get("serviceMail");

      if (serviceMailState === "disabled") {
        setNotice("E-Mail-Erinnerungen wurden abbestellt.");
        setEmailNotificationsEnabled(false);
      }
    }, 0);

    return () => window.clearTimeout(serviceMailTimer);
  }, []);

  const reminders = useMemo(() => {
    return buildReminders(vehicles).sort((firstReminder, secondReminder) => {
      const statusRank: Record<ReminderStatus, number> = {
        overdue: 0,
        soon: 1,
        ok: 2,
      };

      if (statusRank[firstReminder.status] !== statusRank[secondReminder.status]) {
        return statusRank[firstReminder.status] - statusRank[secondReminder.status];
      }

      return (firstReminder.dueDate || "").localeCompare(secondReminder.dueDate || "");
    });
  }, [vehicles]);

  function updateFormValue(key: keyof VehicleFormState, value: string) {
    const nextLongLifeSelected =
      key === "makeModel" ? isLongLifeServiceText(value) : longLifeSelected;

    if (key === "makeModel") {
      setLongLifeSelected(nextLongLifeSelected);
    }

    setFormState((currentValue) => {
      const nextValue = {
        ...currentValue,
        [key]: value,
      };

      if (key !== "makeModel") {
        return nextValue;
      }

      const intervalPreset = findServiceIntervalPreset(value, {
        longLife: nextLongLifeSelected,
      });

      return {
        ...nextValue,
        serviceIntervalMonths: String(intervalPreset.months),
        serviceIntervalKm: String(intervalPreset.km),
        brakeFluidIntervalMonths: String(intervalPreset.brakeFluidMonths),
      };
    });
  }

  function toggleLongLife() {
    setLongLifeSelected((currentValue) => {
      const nextValue = !currentValue;
      const intervalPreset = findServiceIntervalPreset(formState.makeModel, {
        longLife: nextValue,
      });

      setFormState((currentFormState) => ({
        ...currentFormState,
        serviceIntervalMonths: String(intervalPreset.months),
        serviceIntervalKm: String(intervalPreset.km),
        brakeFluidIntervalMonths: String(intervalPreset.brakeFluidMonths),
      }));

      return nextValue;
    });
  }

  async function requestWithAuth(
    method: "POST" | "PATCH" | "DELETE",
    body: Record<string, unknown>,
  ) {
    const accessToken = await getAccessToken();

    if (!accessToken) {
      throw new Error("Bitte melde dich an, damit DiagnoseHUB zentral speichern kann.");
    }

    const response = await fetch("/api/service-reminders", {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Speichern fehlgeschlagen.");
    }

    return payload;
  }

  async function updateEmailNotifications(nextValue: boolean) {
    setNotificationSaving(true);
    setNotice("");
    setErrorMessage("");

    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        throw new Error("Bitte melde dich an, damit DiagnoseHUB E-Mail-Erinnerungen speichern kann.");
      }

      const response = await fetch("/api/service-reminders/notifications", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          emailEnabled: nextValue,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "E-Mail-Erinnerungen konnten nicht gespeichert werden.");
      }

      setEmailNotificationsEnabled(Boolean(payload.emailEnabled));
      setNotice(
        nextValue
          ? "E-Mail-Erinnerungen aktiviert."
          : "E-Mail-Erinnerungen deaktiviert.",
      );
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error));
    } finally {
      setNotificationSaving(false);
    }
  }

  async function addVehicle() {
    setSaving(true);
    setNotice("");
    setErrorMessage("");

    try {
      const payload = await requestWithAuth("POST", {
        ...formState,
        currentMileage: toNumber(formState.currentMileage, 0),
        lastServiceMileage: toNumber(formState.lastServiceMileage, 0),
        serviceIntervalMonths:
          toNumber(formState.serviceIntervalMonths, detectedIntervalPreset.months) ||
          detectedIntervalPreset.months,
        serviceIntervalKm: toNumber(
          formState.serviceIntervalKm,
          detectedIntervalPreset.km,
        ),
        brakeFluidIntervalMonths:
          toNumber(
            formState.brakeFluidIntervalMonths,
            detectedIntervalPreset.brakeFluidMonths,
          ) || detectedIntervalPreset.brakeFluidMonths,
      });

      setVehicles((currentVehicles) => [payload.vehicle, ...currentVehicles]);
      setFormState(defaultFormState);
      setLongLifeSelected(false);
      setNotice("Fahrzeug zentral gespeichert.");
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function deleteVehicle(vehicleId: string) {
    setNotice("");
    setErrorMessage("");

    try {
      await requestWithAuth("DELETE", { id: vehicleId });
      setVehicles((currentVehicles) =>
        currentVehicles.filter((vehicle) => vehicle.id !== vehicleId),
      );
      setNotice("Fahrzeug gelöscht.");
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error));
    }
  }

  async function updateMileage(vehicleId: string, mileage: number) {
    setErrorMessage("");

    try {
      const payload = await requestWithAuth("PATCH", {
        id: vehicleId,
        currentMileage: mileage,
      });

      setVehicles((currentVehicles) =>
        currentVehicles.map((vehicle) =>
          vehicle.id === vehicleId ? payload.vehicle : vehicle,
        ),
      );
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error));
    }
  }

  async function markReminderDone(vehicleId: string, type: ReminderType) {
    const today = toDateInputValue(new Date());
    const vehicle = vehicles.find((currentVehicle) => currentVehicle.id === vehicleId);

    if (!vehicle) {
      return;
    }

    const updatePayload =
      type === "hu"
        ? { id: vehicleId, lastHuDate: today }
        : type === "service"
          ? {
              id: vehicleId,
              lastServiceDate: today,
              lastServiceMileage: vehicle.currentMileage,
            }
          : { id: vehicleId, brakeFluidDate: today };

    setNotice("");
    setErrorMessage("");

    try {
      const payload = await requestWithAuth("PATCH", updatePayload);

      setVehicles((currentVehicles) =>
        currentVehicles.map((currentVehicle) =>
          currentVehicle.id === vehicleId ? payload.vehicle : currentVehicle,
        ),
      );
      setNotice("Erinnerung aktualisiert.");
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error));
    }
  }

  return (
    <div className="mx-auto max-w-7xl">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-blue-700 dark:text-blue-300">
              Service-Erinnerung
            </p>

            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 dark:text-slate-100 sm:text-5xl">
              HU, Service und Wartung für dein eigenes Auto
            </h1>

            <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-400 sm:text-base">
              Speichere deine Fahrzeuge und Kilometerstände
              zentral in deinem DiagnoseHUB Account. So bleiben Hauptuntersuchung,
              AU, Bremsflüssigkeit und Hersteller-Service im Blick, auch wenn du
              später ein anderes Gerät nutzt.
            </p>
          </div>

          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-5">
            <p className="text-sm font-black uppercase tracking-wide text-blue-700 dark:text-blue-300">
              Privat-Tarif
            </p>
            <p className="mt-2 text-3xl font-black text-slate-950 dark:text-slate-100">
              9,99 € / Jahr
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
              Für private Fahrzeughalter. DiagnoseHUB schlägt passende
              Serviceintervalle automatisch aus dem Fahrzeugtyp vor und berechnet
              daraus die nächsten Fälligkeiten.
            </p>
            <StripeCheckoutButton
              plan="service_reminder"
              className="block w-full rounded-xl bg-blue-600 px-5 py-3 text-center text-sm font-black text-white transition hover:bg-blue-500"
            >
              Service-Erinnerung aktivieren
            </StripeCheckoutButton>
          </div>
        </div>
      </section>

      {(authRequired || errorMessage || notice) && (
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {authRequired && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-bold text-slate-700 dark:text-slate-300">
                Bitte einloggen, damit deine Fahrzeuge zentral gespeichert werden.
              </p>
              <a
                href="/login"
                className="rounded-xl bg-blue-600 px-4 py-2 text-center font-black text-white transition hover:bg-blue-500"
              >
                Einloggen
              </a>
            </div>
          )}

          {errorMessage && (
            <p className="font-bold text-red-700 dark:text-red-300">{errorMessage}</p>
          )}

          {notice && (
            <p className="font-bold text-green-700 dark:text-green-300">{notice}</p>
          )}
        </section>
      )}

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-blue-700 dark:text-blue-300">
              Automatische Benachrichtigung
            </p>
            <h2 className="mt-2 text-2xl font-black text-slate-950 dark:text-slate-100">
              E-Mail-Erinnerungen
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-400">
              DiagnoseHUB sendet nur sachliche Hinweise zu HU, AU, Service und
              Wartung. Keine Werbung. Jede Mail enthält einen Abmeldelink.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void updateEmailNotifications(!emailNotificationsEnabled)}
            disabled={notificationLoading || notificationSaving || authRequired}
            aria-pressed={emailNotificationsEnabled}
            className={
              emailNotificationsEnabled
                ? "rounded-xl bg-green-600 px-5 py-3 text-sm font-black text-white transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-60"
                : "rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900"
            }
          >
            {notificationSaving
              ? "Speichert..."
              : emailNotificationsEnabled
                ? "E-Mail aktiv"
                : "E-Mail aktivieren"}
          </button>
        </div>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
          <h2 className="text-2xl font-black text-slate-950 dark:text-slate-100">
            Fahrzeug hinzufügen
          </h2>

          <div className="mt-5 grid gap-4">
            <label className="grid gap-2">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                Anzeigename
              </span>
              <input
                value={formState.name}
                onChange={(event) => updateFormValue("name", event.target.value)}
                placeholder="z. B. Mein Golf"
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  Kennzeichen
                </span>
                <input
                  value={formState.licensePlate}
                  onChange={(event) =>
                    updateFormValue("licensePlate", event.target.value)
                  }
                  placeholder="DON DH 123"
                  className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  Fahrzeug
                </span>
                <input
                  value={formState.makeModel}
                  onChange={(event) =>
                    updateFormValue("makeModel", event.target.value)
                  }
                  placeholder="VW Golf 7 1.6 TDI"
                  className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>
            </div>

            <div className="border-l-4 border-blue-500 bg-blue-50/70 py-3 pl-4 pr-3 text-sm dark:bg-blue-500/10">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-black text-slate-950 dark:text-slate-100">
                    Serviceintervall automatisch: {detectedIntervalPreset.label}
                  </p>
                  {longLifeDetectedFromText && (
                    <p className="mt-1 text-xs font-bold text-blue-700 dark:text-blue-300">
                      LongLife wurde aus dem Fahrzeugtext erkannt.
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={toggleLongLife}
                  aria-pressed={longLifeSelected}
                  className={
                    longLifeSelected
                      ? "rounded-xl bg-blue-600 px-4 py-2 text-xs font-black text-white transition hover:bg-blue-500"
                      : "rounded-xl border border-blue-300 bg-white px-4 py-2 text-xs font-black text-blue-700 transition hover:bg-blue-50 dark:border-blue-500/40 dark:bg-slate-950 dark:text-blue-300 dark:hover:bg-blue-500/10"
                  }
                >
                  {longLifeSelected ? "LongLife aktiv" : "LongLife aus"}
                </button>
              </div>

              <p className="mt-1 text-slate-600 dark:text-slate-400">
                {detectedIntervalPreset.months} Monate
                {detectedIntervalPreset.km > 0
                  ? ` oder ${detectedIntervalPreset.km.toLocaleString("de-DE")} km`
                  : ", kein klassisches km-Intervall"}{" "}
                · Bremsflüssigkeit alle {detectedIntervalPreset.brakeFluidMonths} Monate.
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">
                {detectedIntervalPreset.note}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  Erstzulassung
                </span>
                <input
                  type="date"
                  value={formState.firstRegistration}
                  onChange={(event) =>
                    updateFormValue("firstRegistration", event.target.value)
                  }
                  className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  Aktueller km-Stand
                </span>
                <input
                  type="number"
                  min="0"
                  value={formState.currentMileage}
                  onChange={(event) =>
                    updateFormValue("currentMileage", event.target.value)
                  }
                  placeholder="84200"
                  className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>
            </div>

            <label className="grid gap-2">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                Letzte HU/AU
              </span>
              <input
                type="date"
                value={formState.lastHuDate}
                onChange={(event) => updateFormValue("lastHuDate", event.target.value)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  Letzter Service
                </span>
                <input
                  type="date"
                  value={formState.lastServiceDate}
                  onChange={(event) =>
                    updateFormValue("lastServiceDate", event.target.value)
                  }
                  className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  km bei letztem Service
                </span>
                <input
                  type="number"
                  min="0"
                  value={formState.lastServiceMileage}
                  onChange={(event) =>
                    updateFormValue("lastServiceMileage", event.target.value)
                  }
                  placeholder="70000"
                  className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>
            </div>

            <label className="grid gap-2">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                Letzte Bremsflüssigkeit
              </span>
              <input
                type="date"
                value={formState.brakeFluidDate}
                onChange={(event) =>
                  updateFormValue("brakeFluidDate", event.target.value)
                }
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </label>

            <details className="border-l-4 border-slate-200 pl-4 dark:border-slate-700">
              <summary className="cursor-pointer text-sm font-black text-slate-700 dark:text-slate-300">
                Automatische Intervalle korrigieren
              </summary>

              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <label className="grid gap-2">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    Service Monate
                  </span>
                  <input
                    type="number"
                    min="1"
                    value={formState.serviceIntervalMonths}
                    onChange={(event) =>
                      updateFormValue("serviceIntervalMonths", event.target.value)
                    }
                    className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    Service km
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={formState.serviceIntervalKm}
                    onChange={(event) =>
                      updateFormValue("serviceIntervalKm", event.target.value)
                    }
                    className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    Bremsflüssigkeit Monate
                  </span>
                  <input
                    type="number"
                    min="1"
                    value={formState.brakeFluidIntervalMonths}
                    onChange={(event) =>
                      updateFormValue("brakeFluidIntervalMonths", event.target.value)
                    }
                    className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </label>
              </div>
            </details>

            <label className="grid gap-2">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                Notiz
              </span>
              <textarea
                value={formState.note}
                onChange={(event) => updateFormValue("note", event.target.value)}
                rows={3}
                placeholder="z. B. LongLife nach Anzeige, 4 Wochen vorher prüfen"
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </label>

            <button
              type="button"
              onClick={addVehicle}
              disabled={saving || authRequired}
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Speichert..." : "Fahrzeug zentral speichern"}
            </button>
          </div>
        </div>

        <div className="grid gap-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl font-black text-slate-950 dark:text-slate-100">
                  Nächste Erinnerungen
                </h2>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                  Sortiert nach Fälligkeit und Dringlichkeit.
                </p>
              </div>

              <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {reminders.length} Erinnerungen
              </span>
            </div>

            {loading ? (
              <div className="mt-5 rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-500 dark:border-slate-700">
                Fahrzeuge werden geladen...
              </div>
            ) : reminders.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-500 dark:border-slate-700">
                Noch keine Erinnerungen vorhanden. Lege links dein Fahrzeug mit
                HU- oder Service-Daten an.
              </div>
            ) : (
              <div className="mt-5 grid gap-3">
                {reminders.map((reminder) => (
                  <article
                    key={reminder.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/70"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide ${getStatusClass(
                              reminder.status,
                            )}`}
                          >
                            {getStatusLabel(reminder.status)}
                          </span>

                          <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                            {reminder.vehicleName}
                          </span>
                        </div>

                        <h3 className="mt-3 text-lg font-black text-slate-950 dark:text-slate-100">
                          {reminder.title}
                        </h3>

                        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                          {reminder.dueDate && (
                            <span>Fällig am {formatDate(reminder.dueDate)}. </span>
                          )}
                          {reminder.dueMileage && (
                            <span>
                              Fällig bei {reminder.dueMileage.toLocaleString("de-DE")} km.{" "}
                            </span>
                          )}
                          {reminder.detail}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => void markReminderDone(reminder.vehicleId, reminder.type)}
                        className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-white dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
                      >
                        Erledigt
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
            <h2 className="text-2xl font-black text-slate-950 dark:text-slate-100">
              Fahrzeuge
            </h2>

            {loading ? (
              <p className="mt-4 text-sm text-slate-500">Fahrzeuge werden geladen...</p>
            ) : vehicles.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">
                Noch keine Fahrzeuge zentral gespeichert.
              </p>
            ) : (
              <div className="mt-5 grid gap-4">
                {vehicles.map((vehicle) => (
                  <article
                    key={vehicle.id}
                    className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="text-lg font-black text-slate-950 dark:text-slate-100">
                          {vehicle.name}
                        </h3>
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                          {[vehicle.licensePlate, vehicle.makeModel]
                            .filter(Boolean)
                            .join(" · ") || "Fahrzeug ohne Zusatzdaten"}
                        </p>
                        {vehicle.note && (
                          <p className="mt-2 text-sm text-slate-500">
                            {vehicle.note}
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => void deleteVehicle(vehicle.id)}
                        className="rounded-xl border border-red-300 px-4 py-2 text-sm font-black text-red-700 transition hover:bg-red-50 dark:border-red-500/40 dark:text-red-300 dark:hover:bg-red-500/10"
                      >
                        Löschen
                      </button>
                    </div>

                    <label className="mt-4 grid max-w-xs gap-2">
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                        Aktueller km-Stand
                      </span>
                      <input
                        type="number"
                        min="0"
                        value={vehicle.currentMileage}
                        onChange={(event) =>
                          void updateMileage(vehicle.id, toNumber(event.target.value, 0))
                        }
                        className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                      />
                    </label>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}
