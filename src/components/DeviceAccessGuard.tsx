"use client";

import { useEffect, useMemo, useState } from "react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import {
  getOrCreateDeviceId,
  registerCurrentDevice,
  removeRegisteredDevice,
  type DeviceAccessResponse,
} from "@/services/deviceAccess";

type GuardState =
  | { status: "idle" | "checking" | "allowed"; access?: DeviceAccessResponse }
  | { status: "blocked"; access?: DeviceAccessResponse; message: string };

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString("de-DE", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return value;
  }
}

function getAccessTitle(access?: DeviceAccessResponse) {
  if (access?.accountType === "workshop") {
    return "Gerätelimit für Werkstattkonto erreicht";
  }

  return "Gerätelimit für privates Konto erreicht";
}

export default function DeviceAccessGuard() {
  const supabase = useMemo(() => createClient(), []);
  const [guardState, setGuardState] = useState<GuardState>({ status: "idle" });
  const [actionLoading, setActionLoading] = useState(false);

  async function checkDeviceAccess(existingSession?: Session | null) {
    setGuardState({ status: "checking" });

    try {
      const session =
        existingSession ??
        (await supabase.auth.getSession()).data.session ??
        null;

      if (!session?.access_token) {
        setGuardState({ status: "idle" });
        return;
      }

      const access = await registerCurrentDevice(session.access_token);

      if (access.ok) {
        setGuardState({ status: "allowed", access });
        return;
      }

      if (access.code !== "DEVICE_LIMIT_REACHED") {
        console.warn("Gerätezugriff wurde übersprungen:", access.error);
        setGuardState({ status: "allowed", access });
        return;
      }

      setGuardState({
        status: "blocked",
        access,
        message:
          access.error ||
          "Das Gerätelimit für dieses Konto ist erreicht.",
      });
    } catch (error) {
      console.warn("Gerätezugriff wurde übersprungen:", error);
      setGuardState({ status: "allowed" });
    }
  }

  async function removeDevice(deviceId: string) {
    setActionLoading(true);

    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;

      if (!accessToken) {
        setGuardState({
          status: "allowed",
        });
        return;
      }

      await removeRegisteredDevice(accessToken, deviceId);
      await checkDeviceAccess(data.session);
    } finally {
      setActionLoading(false);
    }
  }

  async function logout() {
    setActionLoading(true);
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  useEffect(() => {
    getOrCreateDeviceId();
    const initialLoadId = window.setTimeout(() => {
      void checkDeviceAccess();
    }, 0);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, nextSession: Session | null) => {
        window.setTimeout(() => {
          void checkDeviceAccess(nextSession);
        }, 0);
      }
    );

    return () => {
      window.clearTimeout(initialLoadId);
      subscription.unsubscribe();
    };
  }, [supabase]);

  if (guardState.status !== "blocked") {
    return null;
  }

  const access = guardState.access;
  const devices = access?.devices || [];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm">
      <section className="max-h-full w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 text-slate-950 shadow-2xl dark:border-slate-800 dark:bg-slate-950 dark:text-white">
        <p className="text-sm font-black uppercase tracking-[0.24em] text-blue-700 dark:text-blue-300">
          DiagnoseHUB Gerätezugriff
        </p>

        <h2 className="mt-3 text-3xl font-black tracking-tight">
          {getAccessTitle(access)}
        </h2>

        <p className="mt-4 leading-7 text-slate-600 dark:text-slate-300">
          {guardState.message}
          {access &&
            ` Erlaubt sind ${access.maxDevices} Geräte. Entferne ein altes Gerät oder melde dich mit einem anderen Konto an.`}
        </p>

        {devices.length > 0 && (
          <div className="mt-6 grid gap-3">
            {devices.map((device) => (
              <div
                key={device.deviceId}
                className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-black text-slate-950 dark:text-white">
                    {device.deviceName}
                  </p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Zuletzt aktiv: {formatDate(device.lastSeenAt)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void removeDevice(device.deviceId)}
                  disabled={actionLoading}
                  className="rounded-2xl border border-red-200 bg-white px-4 py-2 text-sm font-black text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-500/30 dark:bg-slate-950 dark:text-red-300 dark:hover:bg-red-500/10"
                >
                  Entfernen
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void checkDeviceAccess()}
            disabled={actionLoading}
            className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Erneut prüfen
          </button>

          <button
            type="button"
            onClick={() => void logout()}
            disabled={actionLoading}
            className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-black text-slate-800 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Ausloggen
          </button>
        </div>
      </section>
    </div>
  );
}
