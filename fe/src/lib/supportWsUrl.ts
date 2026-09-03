export function getSupportWebSocketUrl(accessToken: string): string {
  const apiBase = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
  const url = new URL(apiBase);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/ws/support";
  url.search = "";
  url.searchParams.set("token", accessToken);
  return url.toString();
}
