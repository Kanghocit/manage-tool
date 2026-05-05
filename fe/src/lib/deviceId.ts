/** Same key as extension docs: one browser profile = one device slot for the web app. */
export const WEB_DEVICE_ID_STORAGE_KEY = "deviceId";

export function readDeviceIdFromSearchParams(searchParams: URLSearchParams): string | null {
  const raw = searchParams.get("deviceId") ?? searchParams.get("device_id");
  const trimmed = raw?.trim();
  return trimmed && trimmed.length >= 4 ? trimmed : null;
}

/** Persist immediately so refresh before Activate does not rotate the UUID. */
export function getOrCreateWebDeviceId(searchParams: URLSearchParams): string {
  const fromQuery = readDeviceIdFromSearchParams(searchParams);
  if (fromQuery) {
    localStorage.setItem(WEB_DEVICE_ID_STORAGE_KEY, fromQuery);
    return fromQuery;
  }
  let id = localStorage.getItem(WEB_DEVICE_ID_STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(WEB_DEVICE_ID_STORAGE_KEY, id);
  }
  return id;
}
