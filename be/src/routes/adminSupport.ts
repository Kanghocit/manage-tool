import express from "express";
import { z } from "zod";

import { env } from "../config/env";
import { prisma } from "../lib/prisma";
import { serializeSession } from "../lib/supportSerialize";
import { notifySessionDeleted, broadcastToSession } from "../lib/supportWs";
import { sendSupportMessage } from "../lib/supportMessageService";
import { requireAuth, requireRole } from "../middleware/auth";

export const adminSupportRouter = express.Router();
adminSupportRouter.use(requireAuth, requireRole("admin"));

adminSupportRouter.get("/sessions", async (req, res, next) => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const where =
      status === "open" || status === "waiting_admin"
        ? { status: status as "open" | "waiting_admin" }
        : { status: { in: ["open", "waiting_admin"] as ("open" | "waiting_admin")[] } };

    const sessions = await prisma.supportSession.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: {
        user: { select: { id: true, email: true, fullName: true } },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    const latestByUser = new Map<string, (typeof sessions)[number]>();
    for (const row of sessions) {
      const prev = latestByUser.get(row.userId);
      if (!prev || row.updatedAt > prev.updatedAt) {
        latestByUser.set(row.userId, row);
      }
    }

    const items = [...latestByUser.values()]
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .map((row) => serializeSession(row));

    res.json({
      success: true,
      items,
    });
  } catch (err) {
    next(err);
  }
});

adminSupportRouter.get("/sessions/:id", async (req, res, next) => {
  try {
    const parsed = z.object({ id: z.string().uuid() }).safeParse(req.params);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: "INVALID_PAYLOAD",
        message: "Invalid session id.",
      });
    }

    const session = await prisma.supportSession.findUnique({
      where: { id: parsed.data.id },
      include: {
        user: { select: { id: true, email: true, fullName: true } },
        messages: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Session not found.",
      });
    }

    res.json({ success: true, session: serializeSession(session) });
  } catch (err) {
    next(err);
  }
});

adminSupportRouter.delete("/sessions/:id", async (req, res, next) => {
  try {
    const parsed = z.object({ id: z.string().uuid() }).safeParse(req.params);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: "INVALID_PAYLOAD",
        message: "Invalid session id.",
      });
    }

    const sessionId = parsed.data.id;
    const existing = await prisma.supportSession.findUnique({
      where: { id: sessionId },
      select: { id: true },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Session not found.",
      });
    }

    notifySessionDeleted(sessionId);
    await prisma.supportSession.delete({ where: { id: sessionId } });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

const messageBodySchema = z.object({
  content: z.string().min(1).max(2000),
});

adminSupportRouter.post("/sessions/:id/messages", async (req, res, next) => {
  try {
    const parsed = z.object({ id: z.string().uuid() }).safeParse(req.params);
    const bodyParsed = messageBodySchema.safeParse(req.body);
    if (!parsed.success || !bodyParsed.success) {
      return res.status(400).json({
        success: false,
        code: "INVALID_PAYLOAD",
        message: "Invalid payload.",
      });
    }

    const auth = { userId: req.auth!.userId, role: "admin" as const };
    const result = await sendSupportMessage(auth, parsed.data.id, bodyParsed.data.content);
    if (!result.ok) {
      const status =
        result.code === "FORBIDDEN" ? 403 : result.code === "NOT_FOUND" ? 404 : 400;
      return res.status(status).json({ success: false, code: result.code, message: result.message });
    }

    for (const message of result.messages) {
      broadcastToSession(parsed.data.id, {
        type: "message:new",
        sessionId: parsed.data.id,
        message,
      });
    }

    res.status(201).json({ success: true, messages: result.messages });
  } catch (err) {
    next(err);
  }
});

/** For admin UI links in Telegram messages */
export function getAdminSupportSessionUrl(sessionId: string): string {
  const base = env.appPublicUrl.replace(/\/$/, "");
  return `${base}/admin/support/${sessionId}`;
}
