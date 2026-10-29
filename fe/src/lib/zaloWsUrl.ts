function resolveWebSocketBase(): string {
  const configured = import.meta.env.VITE_API_URL;
  if (configured) return configured;
  if (import.meta.env.DEV && typeof window !== "undefined") {
    return window.location.origin;
  }
  return "http://localhost:4000";
}

export function getZaloWebSocketUrl(token?: string): string {
  const url = new URL(resolveWebSocketBase());
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/ws/zalo";
  url.search = token ? `token=${encodeURIComponent(token)}` : "";
  return url.toString();
}
