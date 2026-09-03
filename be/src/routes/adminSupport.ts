import express from "express";
import { z } from "zod";

import { env } from "../config/env";
import { prisma } from "../lib/prisma";
import { serializeSession } from "../lib/supportSerialize";
import { notifySessionDeleted } from "../lib/supportWs";
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

    res.json({
      success: true,
      items: sessions.map((row) => serializeSession(row)),
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

/** For admin UI links in Telegram messages */
export function getAdminSupportSessionUrl(sessionId: string): string {
  const base = env.appPublicUrl.replace(/\/$/, "");
  return `${base}/admin/support/${sessionId}`;
}
