import { api } from "../lib/api";
import type { SupportMessage } from "../types/support";

export async function sendSupportMessageRest(
  sessionId: string,
  content: string,
  role: "user" | "admin",
): Promise<SupportMessage[]> {
  const path =
    role === "admin"
      ? `/api/admin/support/sessions/${sessionId}/messages`
      : `/api/support/sessions/${sessionId}/messages`;

  const { data } = await api.post<{ success: boolean; messages: SupportMessage[] }>(path, {
    content,
  });
  return data.messages;
}
