import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";

import { api } from "../lib/api";
import { useSupportSocket } from "./useSupportSocket";
import { useAuthStore } from "../store/useAuthStore";
import type { SupportSession } from "../types/support";

async function fetchAdminSupportSessions() {
  const { data } = await api.get<{ success: boolean; items: SupportSession[] }>(
    "/api/admin/support/sessions",
  );
  return data.items;
}

function countInboxAttention(sessions: SupportSession[], excludeSessionId?: string) {
  return sessions.filter((session) => {
    if (excludeSessionId && session.id === excludeSessionId) return false;
    const lastMessage = session.messages?.[0];
    return session.status === "waiting_admin" || lastMessage?.sender === "user";
  }).length;
}

/** Badge count for admin sidebar — sessions waiting for admin or with unread user messages. */
export function useAdminSupportInboxBadge() {
  const user = useAuthStore((state) => state.user);
  const location = useLocation();
  const queryClient = useQueryClient();

  const viewedSessionId = location.pathname.match(/\/admin\/support\/([^/]+)/)?.[1];

  const sessionsQuery = useQuery({
    queryKey: ["admin-support-sessions"],
    queryFn: fetchAdminSupportSessions,
    enabled: user?.role === "admin",
    refetchInterval: 30_000,
  });

  useSupportSocket({
    enabled: user?.role === "admin",
    onEvent: (event) => {
      if (
        event.type === "message:new" ||
        event.type === "session:escalated" ||
        event.type === "session:deleted"
      ) {
        void queryClient.invalidateQueries({ queryKey: ["admin-support-sessions"] });
      }
    },
  });

  return countInboxAttention(sessionsQuery.data ?? [], viewedSessionId);
}
