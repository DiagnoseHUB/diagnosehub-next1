import type { UserPlan } from "@/config/plans";
import { fetchJsonWithTimeout } from "@/utils/clientApi";

export const DEVICE_ID_STORAGE_KEY = "diagnosehub-device-id";

export type DeviceAccountType = "private" | "workshop";

export type DeviceRegistration = {
  id: string;
  deviceId: string;
  deviceName: string;
  current: boolean;
  createdAt: string;
  lastSeenAt: string;
};

export type DeviceAccessResponse = {
  ok: boolean;
  code?: "DEVICE_LIMIT_REACHED";
  error?: string;
  plan: UserPlan | "free";
  accountType: DeviceAccountType;
  maxDevices: number;
  activeDeviceCount: number;
  currentDeviceId: string;
  devices: DeviceRegistration[];
};

function createFallbackDeviceId() {
  return `device-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export function getOrCreateDeviceId() {
  if (typeof window === "undefined") {
    return "";
  }

  const existingDeviceId = localStorage.getItem(DEVICE_ID_STORAGE_KEY);

  if (existingDeviceId) {
    return existingDeviceId;
  }

  const nextDeviceId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : createFallbackDeviceId();

  localStorage.setItem(DEVICE_ID_STORAGE_KEY, nextDeviceId);
  return nextDeviceId;
}

export function getDeviceName() {
  if (typeof window === "undefined") {
    return "Unbekanntes Gerät";
  }

  const userAgentData = navigator as Navigator & {
    userAgentData?: { platform?: string };
  };
  const platform = userAgentData.userAgentData?.platform || navigator.platform || "";
  const touchHint = navigator.maxTouchPoints > 1 ? "Touch" : "Desktop";

  return [platform, touchHint].filter(Boolean).join(" · ") || "Dieses Gerät";
}

function parseDeviceResponse(
  response: Response,
  payload: Partial<DeviceAccessResponse>
) {
  return {
    ...payload,
    ok: response.ok && payload.ok !== false,
  } as DeviceAccessResponse;
}

export async function registerCurrentDevice(accessToken: string) {
  const { response, data } =
    await fetchJsonWithTimeout<Partial<DeviceAccessResponse>>(
      "/api/account/devices",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          deviceId: getOrCreateDeviceId(),
          deviceName: getDeviceName(),
        }),
      },
      9000
    );

  return parseDeviceResponse(response, data);
}

export async function loadRegisteredDevices(accessToken: string) {
  const { response, data } =
    await fetchJsonWithTimeout<Partial<DeviceAccessResponse>>(
      "/api/account/devices",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "x-diagnosehub-device-id": getOrCreateDeviceId(),
        },
      },
      9000
    );

  return parseDeviceResponse(response, data);
}

export async function removeRegisteredDevice(
  accessToken: string,
  deviceId: string
) {
  const { response, data } =
    await fetchJsonWithTimeout<Partial<DeviceAccessResponse>>(
      "/api/account/devices",
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ deviceId }),
      },
      9000
    );

  return parseDeviceResponse(response, data);
}
