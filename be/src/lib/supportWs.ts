import type { Server } from "http";
import { WebSocket, WebSocketServer } from "ws";
import type { SupportMessageSender } from "@prisma/client";

import { matchSupportFaq } from "../config/supportFaq";
import { env } from "../config/env";
import { prisma } from "./prisma";
import { verifyAccessToken } from "./jwt";
import { serializeMessage } from "./supportSerialize";
import {
  formatSupportTelegramMessage,
  sendTelegramMessage,
} from "./telegram";

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
const messageRateLimit = new Map<string, { count: number; resetAt: number }>();

const MAX_MESSAGE_LENGTH = 2000;
const MAX_MESSAGES_PER_MINUTE = 10;

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

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = messageRateLimit.get(userId);
  if (!entry || now >= entry.resetAt) {
    messageRateLimit.set(userId, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= MAX_MESSAGES_PER_MINUTE) return false;
  entry.count += 1;
  return true;
}

async function canAccessSession(auth: ClientAuth, sessionId: string): Promise<boolean> {
  const session = await prisma.supportSession.findUnique({
    where: { id: sessionId },
    select: { userId: true },
  });
  if (!session) return false;
  if (auth.role === "admin") return true;
  return session.userId === auth.userId;
}

async function handleMessageSend(client: SupportClient, sessionId: string, content: string) {
  const auth = client.auth;
  if (!auth) return;

  const trimmed = content.trim();
  if (!trimmed || trimmed.length > MAX_MESSAGE_LENGTH) {
    sendJson(client, {
      type: "error",
      code: "INVALID_MESSAGE",
      message: "Message is empty or too long.",
    });
    return;
  }

  if (!checkRateLimit(auth.userId)) {
    sendJson(client, {
      type: "error",
      code: "RATE_LIMIT",
      message: "Too many messages. Please wait a moment.",
    });
    return;
  }

  const allowed = await canAccessSession(auth, sessionId);
  if (!allowed) {
    sendJson(client, { type: "error", code: "FORBIDDEN", message: "Forbidden." });
    return;
  }

  const session = await prisma.supportSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      status: true,
      userId: true,
      createdAt: true,
      user: { select: { email: true, fullName: true } },
    },
  });
  if (!session) {
    sendJson(client, { type: "error", code: "NOT_FOUND", message: "Session not found." });
    return;
  }

  const sender: SupportMessageSender =
    auth.role === "admin" ? "admin" : "user";

  if (sender === "user" && session.userId !== auth.userId) {
    sendJson(client, { type: "error", code: "FORBIDDEN", message: "Forbidden." });
    return;
  }

  const userMessage = await prisma.supportMessage.create({
    data: { sessionId, sender, content: trimmed },
  });

  broadcastToSession(sessionId, {
    type: "message:new",
    sessionId,
    message: serializeMessage(userMessage),
  });

  if (sender === "user" && session.status === "open") {
    const faq = matchSupportFaq(trimmed);
    if (faq) {
      const botMessage = await prisma.supportMessage.create({
        data: { sessionId, sender: "bot", content: faq.answer },
      });
      broadcastToSession(sessionId, {
        type: "message:new",
        sessionId,
        message: serializeMessage(botMessage),
      });
    }
  }

  if (sender === "user" && session.status === "waiting_admin" && session.user) {
    void sendTelegramMessage(
      formatSupportTelegramMessage({
        sessionId: session.id,
        userEmail: session.user.email,
        userFullName: session.user.fullName,
        createdAt: session.createdAt,
        adminUrl: `${env.appPublicUrl.replace(/\/$/, "")}/admin/support/${session.id}`,
      }),
    );
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
    const allowed = await canAccessSession(auth, sessionId);
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
