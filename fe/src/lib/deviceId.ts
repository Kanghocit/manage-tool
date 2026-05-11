const STORAGE_KEY = "license-admin-device-id";

/** Same key as login/register; My License + extension sync may use ?deviceId= */
export const WEB_DEVICE_ID_STORAGE_KEY = STORAGE_KEY;

function isValidStoredId(id: string | null | undefined): id is string {
  return !!id && id.trim().length >= 8;
}

export function readDeviceIdFromSearchParams(
  searchParams: URLSearchParams,
): string | null {
  const raw = searchParams.get("deviceId")?.trim();
  if (!isValidStoredId(raw)) return null;
  return raw!;
}

/**
 * Prefer `?deviceId=` from URL (e.g. extension handoff), else localStorage UUID.
 */
export function getOrCreateWebDeviceId(searchParams: URLSearchParams): string {
  if (typeof window === "undefined") {
    return "";
  }
  const fromQuery = readDeviceIdFromSearchParams(searchParams);
  if (fromQuery) {
    try {
      window.localStorage.setItem(STORAGE_KEY, fromQuery);
    } catch {
      /* ignore quota / private mode */
    }
    return fromQuery;
  }
  return getOrCreateDeviceId();
}

export function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") {
    return "";
  }
  try {
    let id = window.localStorage.getItem(STORAGE_KEY);
    if (!isValidStoredId(id)) {
      id = crypto.randomUUID();
      window.localStorage.setItem(STORAGE_KEY, id);
    }
    return id!;
  } catch {
    return crypto.randomUUID();
  }
}
