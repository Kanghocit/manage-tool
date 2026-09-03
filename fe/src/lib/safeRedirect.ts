/** Allow only same-app relative paths (blocks open redirects). */
export function sanitizeAppRedirect(raw: string | null | undefined, fallback = "/support"): string {
  if (!raw) return fallback;
  const value = raw.trim();
  if (!value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }
  return value;
}
