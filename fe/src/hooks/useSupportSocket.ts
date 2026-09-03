import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "../lib/api";
import { getSupportWebSocketUrl } from "../lib/supportWsUrl";
import { useAuthStore } from "../store/useAuthStore";
import type { SupportWsEvent } from "../types/support";

type UseSupportSocketOptions = {
  enabled?: boolean;
  onEvent?: (event: SupportWsEvent) => void;
};

export function useSupportSocket(options: UseSupportSocketOptions = {}) {
  const { enabled = true, onEvent } = options;
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current != null) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const connect = useCallback(async () => {
    if (!enabled || !mountedRef.current) return;

    let accessToken = useAuthStore.getState().accessToken;
    if (!accessToken) return;

    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    wsRef.current?.close();
    wsRef.current = null;

    const ws = new WebSocket(getSupportWebSocketUrl(accessToken));
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      reconnectAttemptRef.current = 0;
      setConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(String(event.data)) as SupportWsEvent;
        if (parsed.type === "error" && parsed.code === "UNAUTHORIZED") {
          void (async () => {
            const refreshToken = useAuthStore.getState().refreshToken;
            if (!refreshToken) return;
            try {
              const res = await api.post("/api/auth/refresh", { refreshToken });
              const newAccess = res.data?.accessToken as string | undefined;
              const newRefresh = res.data?.refreshToken as string | undefined;
              if (newAccess && newRefresh) {
                useAuthStore.getState().setTokens(newAccess, newRefresh);
                ws.close();
                void connect();
              }
            } catch {
              useAuthStore.getState().logout();
            }
          })();
          return;
        }
        onEventRef.current?.(parsed);
      } catch {
        // ignore malformed payloads
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setConnected(false);
      wsRef.current = null;

      if (!enabled) return;

      const delay = Math.min(1000 * 2 ** reconnectAttemptRef.current, 30_000);
      reconnectAttemptRef.current += 1;
      clearReconnectTimer();
      reconnectTimerRef.current = window.setTimeout(() => {
        void connect();
      }, delay);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [clearReconnectTimer, enabled]);

  useEffect(() => {
    mountedRef.current = true;
    if (enabled) {
      void connect();
    }

    return () => {
      mountedRef.current = false;
      clearReconnectTimer();
      wsRef.current?.close();
      wsRef.current = null;
      setConnected(false);
    };
  }, [clearReconnectTimer, connect, enabled]);

  const send = useCallback((payload: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(payload));
    return true;
  }, []);

  const joinSession = useCallback(
    (sessionId: string) => {
      send({ type: "session:join", sessionId });
    },
    [send],
  );

  const leaveSession = useCallback(
    (sessionId: string) => {
      send({ type: "session:leave", sessionId });
    },
    [send],
  );

  const sendMessage = useCallback(
    (sessionId: string, content: string) => {
      return send({ type: "message:send", sessionId, content });
    },
    [send],
  );

  return {
    connected,
    joinSession,
    leaveSession,
    sendMessage,
  };
}
