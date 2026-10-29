import { useCallback, useEffect, useRef } from "react";

import { api } from "../lib/api";
import { getZaloWebSocketUrl } from "../lib/zaloWsUrl";
import { useAuthStore } from "../store/useAuthStore";
import type { ZaloWsEvent } from "../types/zalo";

type Options = {
  enabled?: boolean;
  onEvent?: (event: ZaloWsEvent) => void;
};

export function useZaloSocket(options: Options = {}) {
  const { enabled = true, onEvent } = options;
  const onEventRef = useRef(onEvent);
  const wsRef = useRef<WebSocket | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  const connect = useCallback(async () => {
    if (!enabled || !mountedRef.current) return;
    if (!useAuthStore.getState().user) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    wsRef.current?.close();
    wsRef.current = null;

    const ws = new WebSocket(getZaloWebSocketUrl());
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(String(event.data)) as ZaloWsEvent;
        if (parsed.type === "error" && parsed.code === "UNAUTHORIZED") {
          void (async () => {
            try {
              await api.post("/api/auth/refresh");
              ws.close();
              void connect();
            } catch {
              useAuthStore.getState().logout();
            }
          })();
          return;
        }
        onEventRef.current?.(parsed);
      } catch {
        // ignore malformed
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current || !enabled) return;
      window.setTimeout(() => void connect(), 3000);
    };
  }, [enabled]);

  const userId = useAuthStore((s) => s.user?.id);

  useEffect(() => {
    mountedRef.current = true;
    void connect();
    return () => {
      mountedRef.current = false;
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [connect, enabled, userId]);

  return { reconnect: connect };
}
