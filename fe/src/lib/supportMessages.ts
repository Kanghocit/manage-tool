import type { SupportMessage } from "../types/support";

export function mergeSupportMessages(
  existing: SupportMessage[],
  incoming: SupportMessage[],
): SupportMessage[] {
  const map = new Map<string, SupportMessage>();
  for (const message of existing) {
    map.set(message.id, message);
  }
  for (const message of incoming) {
    map.set(message.id, message);
  }
  return [...map.values()].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

export function appendSupportMessages(
  existing: SupportMessage[],
  incoming: SupportMessage[],
): SupportMessage[] {
  return mergeSupportMessages(existing, incoming);
}
