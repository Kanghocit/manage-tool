import type { SupportMessageSender } from "@prisma/client";

import { matchSupportFaq } from "../config/supportFaq";
import { env } from "../config/env";
import { prisma } from "./prisma";
import { serializeMessage, type SerializedSupportMessage } from "./supportSerialize";
import {
  formatSupportTelegramMessage,
  sendTelegramMessage,
} from "./telegram";

export type SupportAuth = {
  userId: string;
  role: "admin" | "user";
};

const MAX_MESSAGE_LENGTH = 2000;
const messageRateLimit = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = messageRateLimit.get(userId);
  if (!entry || now >= entry.resetAt) {
    messageRateLimit.set(userId, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 10) return false;
  entry.count += 1;
  return true;
}

export async function canAccessSupportSession(
  auth: SupportAuth,
  sessionId: string,
): Promise<boolean> {
  const session = await prisma.supportSession.findUnique({
    where: { id: sessionId },
    select: { userId: true },
  });
  if (!session) return false;
  if (auth.role === "admin") return true;
  return session.userId === auth.userId;
}

export type SendSupportMessageResult =
  | { ok: true; messages: SerializedSupportMessage[] }
  | { ok: false; code: string; message: string };

export async function sendSupportMessage(
  auth: SupportAuth,
  sessionId: string,
  content: string,
): Promise<SendSupportMessageResult> {
  const trimmed = content.trim();
  if (!trimmed || trimmed.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, code: "INVALID_MESSAGE", message: "Message is empty or too long." };
  }

  if (!checkRateLimit(auth.userId)) {
    return { ok: false, code: "RATE_LIMIT", message: "Too many messages. Please wait a moment." };
  }

  const allowed = await canAccessSupportSession(auth, sessionId);
  if (!allowed) {
    return { ok: false, code: "FORBIDDEN", message: "Forbidden." };
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
    return { ok: false, code: "NOT_FOUND", message: "Session not found." };
  }

  const sender: SupportMessageSender = auth.role === "admin" ? "admin" : "user";

  if (sender === "user" && session.userId !== auth.userId) {
    return { ok: false, code: "FORBIDDEN", message: "Forbidden." };
  }

  const userMessage = await prisma.supportMessage.create({
    data: { sessionId, sender, content: trimmed },
  });

  const messages: SerializedSupportMessage[] = [serializeMessage(userMessage)];

  if (sender === "user" && session.status === "open") {
    const faq = matchSupportFaq(trimmed);
    if (faq) {
      const botMessage = await prisma.supportMessage.create({
        data: { sessionId, sender: "bot", content: faq.answer },
      });
      messages.push(serializeMessage(botMessage));
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

  return { ok: true, messages };
}
