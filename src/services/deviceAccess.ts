import { normalizeUserPlan, type UserPlan } from "@/config/plans";
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

const ACCOUNT_DEVICE_LIMIT = 3;

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

function normalizeAccountType(value: unknown): DeviceAccountType {
  return value === "workshop" ? "workshop" : "private";
}

function normalizeDevice(value: unknown): DeviceRegistration | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const device = value as Partial<DeviceRegistration>;
  const deviceId =
    typeof device.deviceId === "string" && device.deviceId
      ? device.deviceId
      : typeof device.id === "string" && device.id
        ? device.id
        : "";

  if (!deviceId) {
    return null;
  }

  return {
    id: typeof device.id === "string" ? device.id : deviceId,
    deviceId,
    deviceName:
      typeof device.deviceName === "string" && device.deviceName
        ? device.deviceName
        : "Unbekanntes Gerät",
    current: device.current === true,
    createdAt:
      typeof device.createdAt === "string" ? device.createdAt : "",
    lastSeenAt:
      typeof device.lastSeenAt === "string" ? device.lastSeenAt : "",
  };
}

function normalizeDevices(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((device) => normalizeDevice(device))
    .filter((device): device is DeviceRegistration => device !== null);
}

function normalizeErrorMessage(value: unknown) {
  if (typeof value === "string") {
    const trimmedValue = value.trim();

    if (!trimmedValue || trimmedValue === "[object Object]") {
      return undefined;
    }

    return trimmedValue;
  }

  if (value && typeof value === "object") {
    const errorRecord = value as {
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

  return undefined;
}

function parseDeviceResponse(
  response: Response,
  payload: Partial<DeviceAccessResponse>
): DeviceAccessResponse {
  const accountType = normalizeAccountType(payload.accountType);
  const devices = normalizeDevices(payload.devices);

  return {
    ok: response.ok && payload.ok !== false,
    code:
      payload.code === "DEVICE_LIMIT_REACHED"
        ? "DEVICE_LIMIT_REACHED"
        : undefined,
    error: normalizeErrorMessage(payload.error),
    plan: normalizeUserPlan(payload.plan),
    accountType,
    maxDevices:
      typeof payload.maxDevices === "number" && Number.isFinite(payload.maxDevices)
        ? payload.maxDevices
        : ACCOUNT_DEVICE_LIMIT,
    activeDeviceCount:
      typeof payload.activeDeviceCount === "number" &&
      Number.isFinite(payload.activeDeviceCount)
        ? payload.activeDeviceCount
        : devices.length,
    currentDeviceId:
      typeof payload.currentDeviceId === "string" ? payload.currentDeviceId : "",
    devices,
  };
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
