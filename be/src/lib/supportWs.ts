import type { Server } from "http";
import { WebSocket, WebSocketServer } from "ws";

import { verifyAccessToken } from "./jwt";
import {
  canAccessSupportSession,
  sendSupportMessage,
} from "./supportMessageService";

type ClientAuth = {
  userId: string;
  role: "admin" | "user";
};

type SupportClient = WebSocket & {
  auth?: ClientAuth;
  subscribedSessions: Set<string>;
  isAlive: boolean;
};

const adminSockets = new Set<SupportClient>();
const sessionSockets = new Map<string, Set<SupportClient>>();

function sendJson(ws: WebSocket, payload: unknown) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function getSessionRoom(sessionId: string): Set<SupportClient> {
  let room = sessionSockets.get(sessionId);
  if (!room) {
    room = new Set();
    sessionSockets.set(sessionId, room);
  }
  return room;
}

function joinSessionRoom(client: SupportClient, sessionId: string) {
  client.subscribedSessions.add(sessionId);
  getSessionRoom(sessionId).add(client);
}

function leaveSessionRoom(client: SupportClient, sessionId: string) {
  client.subscribedSessions.delete(sessionId);
  const room = sessionSockets.get(sessionId);
  if (!room) return;
  room.delete(client);
  if (room.size === 0) sessionSockets.delete(sessionId);
}

function cleanupClient(client: SupportClient) {
  adminSockets.delete(client);
  for (const sessionId of client.subscribedSessions) {
    leaveSessionRoom(client, sessionId);
  }
}

export function broadcastToSession(sessionId: string, payload: unknown) {
  const room = sessionSockets.get(sessionId);
  if (!room) return;
  for (const client of room) {
    sendJson(client, payload);
  }
}

export function broadcastToAdmins(payload: unknown) {
  for (const client of adminSockets) {
    sendJson(client, payload);
  }
}

export function notifySessionDeleted(sessionId: string) {
  broadcastToSession(sessionId, { type: "session:deleted", sessionId });
  sessionSockets.delete(sessionId);
}

async function handleMessageSend(client: SupportClient, sessionId: string, content: string) {
  const auth = client.auth;
  if (!auth) return;

  const result = await sendSupportMessage(auth, sessionId, content);
  if (!result.ok) {
    sendJson(client, { type: "error", code: result.code, message: result.message });
    return;
  }

  for (const message of result.messages) {
    broadcastToSession(sessionId, { type: "message:new", sessionId, message });
  }
}

async function handleClientMessage(client: SupportClient, raw: string) {
  let parsed: { type?: string; sessionId?: string; content?: string };
  try {
    parsed = JSON.parse(raw) as { type?: string; sessionId?: string; content?: string };
  } catch {
    sendJson(client, { type: "error", code: "INVALID_PAYLOAD", message: "Invalid JSON." });
    return;
  }

  const auth = client.auth;
  if (!auth) return;

  if (parsed.type === "session:join") {
    const sessionId = parsed.sessionId?.trim();
    if (!sessionId) {
      sendJson(client, { type: "error", code: "INVALID_PAYLOAD", message: "Missing sessionId." });
      return;
    }
    const allowed = await canAccessSupportSession(auth, sessionId);
    if (!allowed) {
      sendJson(client, { type: "error", code: "FORBIDDEN", message: "Forbidden." });
      return;
    }
    joinSessionRoom(client, sessionId);
    sendJson(client, { type: "session:joined", sessionId });
    return;
  }

  if (parsed.type === "session:leave") {
    const sessionId = parsed.sessionId?.trim();
    if (sessionId) leaveSessionRoom(client, sessionId);
    return;
  }

  if (parsed.type === "message:send") {
    const sessionId = parsed.sessionId?.trim();
    const content = parsed.content ?? "";
    if (!sessionId) {
      sendJson(client, { type: "error", code: "INVALID_PAYLOAD", message: "Missing sessionId." });
      return;
    }
    await handleMessageSend(client, sessionId, content);
    return;
  }

  sendJson(client, { type: "error", code: "UNKNOWN_EVENT", message: "Unknown event type." });
}

export function attachSupportWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: "/ws/support" });

  wss.on("connection", (ws, req) => {
    const client = ws as SupportClient;
    client.subscribedSessions = new Set();
    client.isAlive = true;

    const url = new URL(req.url ?? "", "http://localhost");
    const token = url.searchParams.get("token")?.trim();
    if (!token) {
      sendJson(client, { type: "error", code: "UNAUTHORIZED", message: "Missing token." });
      client.close();
      return;
    }

    try {
      const payload = verifyAccessToken(token);
      client.auth = { userId: payload.sub, role: payload.role };
    } catch {
      sendJson(client, { type: "error", code: "UNAUTHORIZED", message: "Invalid token." });
      client.close();
      return;
    }

    if (client.auth.role === "admin") {
      adminSockets.add(client);
    }

    sendJson(client, { type: "connected", role: client.auth.role });

    client.on("pong", () => {
      client.isAlive = true;
    });

    client.on("message", (data) => {
      void handleClientMessage(client, data.toString());
    });

    client.on("close", () => {
      cleanupClient(client);
    });
  });

  const heartbeat = setInterval(() => {
    for (const client of wss.clients) {
      const c = client as SupportClient;
      if (!c.isAlive) {
        cleanupClient(c);
        c.terminate();
        continue;
      }
      c.isAlive = false;
      c.ping();
    }
  }, 30_000);

  wss.on("close", () => {
    clearInterval(heartbeat);
  });

  return wss;
}
