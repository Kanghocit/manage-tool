import express from "express";
import { z } from "zod";

import { env } from "../config/env";
import { supportFaqItems } from "../config/supportFaq";
import { prisma } from "../lib/prisma";
import {
  formatSupportTelegramMessage,
  sendTelegramMessage,
} from "../lib/telegram";
import { serializeSession } from "../lib/supportSerialize";
import { broadcastToAdmins, broadcastToSession } from "../lib/supportWs";
import { requireAuth } from "../middleware/auth";

export const supportRouter = express.Router();
supportRouter.use(requireAuth);

supportRouter.get("/faq", (_req, res) => {
  res.json({
    success: true,
    items: supportFaqItems.map(({ id, question, answer }) => ({
      id,
      question,
      answer,
    })),
  });
});

supportRouter.get("/sessions/active", async (req, res, next) => {
  try {
    const userId = req.auth!.userId;

    const session = await prisma.supportSession.findFirst({
      where: {
        userId,
        status: { in: ["open", "waiting_admin"] },
      },
      orderBy: { createdAt: "desc" },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
      },
    });

    res.json({
      success: true,
      session: session ? serializeSession(session) : null,
    });
  } catch (err) {
    next(err);
  }
});

supportRouter.post("/sessions", async (req, res, next) => {
  try {
    const userId = req.auth!.userId;

    const existing = await prisma.supportSession.findFirst({
      where: {
        userId,
        status: { in: ["open", "waiting_admin"] },
      },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
      },
    });

    if (existing) {
      return res.json({
        success: true,
        session: serializeSession(existing),
      });
    }

    const session = await prisma.supportSession.create({
      data: { userId },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
      },
    });

    res.status(201).json({
      success: true,
      session: serializeSession(session),
    });
  } catch (err) {
    next(err);
  }
});

const escalateParamsSchema = z.object({
  id: z.string().uuid(),
});

supportRouter.post("/sessions/:id/escalate", async (req, res, next) => {
  try {
    const parsed = escalateParamsSchema.safeParse(req.params);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: "INVALID_PAYLOAD",
        message: "Invalid session id.",
      });
    }

    const userId = req.auth!.userId;
    const sessionId = parsed.data.id;

    const session = await prisma.supportSession.findFirst({
      where: { id: sessionId, userId },
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

    if (session.status === "waiting_admin") {
      return res.json({
        success: true,
        session: serializeSession(session),
      });
    }

    const updated = await prisma.supportSession.update({
      where: { id: sessionId },
      data: { status: "waiting_admin" },
      include: {
        user: { select: { id: true, email: true, fullName: true } },
        messages: { orderBy: { createdAt: "asc" } },
      },
    });

    const serialized = serializeSession(updated);

    broadcastToAdmins({
      type: "session:escalated",
      session: serialized,
    });

    void sendTelegramMessage(
      formatSupportTelegramMessage({
        sessionId: updated.id,
        userEmail: updated.user.email,
        userFullName: updated.user.fullName,
        createdAt: updated.createdAt,
        adminUrl: `${env.appPublicUrl.replace(/\/$/, "")}/admin/support/${updated.id}`,
      }),
    );

    res.json({ success: true, session: serialized });
  } catch (err) {
    next(err);
  }
});

supportRouter.post("/sessions/:id/faq", async (req, res, next) => {
  try {
    const parsed = escalateParamsSchema.safeParse(req.params);
    const bodyParsed = z.object({ faqId: z.string().min(1) }).safeParse(req.body);
    if (!parsed.success || !bodyParsed.success) {
      return res.status(400).json({
        success: false,
        code: "INVALID_PAYLOAD",
        message: "Invalid payload.",
      });
    }

    const userId = req.auth!.userId;
    const faq = supportFaqItems.find((item) => item.id === bodyParsed.data.faqId);
    if (!faq) {
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "FAQ not found.",
      });
    }

    const session = await prisma.supportSession.findFirst({
      where: { id: parsed.data.id, userId },
    });
    if (!session) {
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Session not found.",
      });
    }

    const userMessage = await prisma.supportMessage.create({
      data: {
        sessionId: session.id,
        sender: "user",
        content: faq.question,
      },
    });

    const botMessage = await prisma.supportMessage.create({
      data: {
        sessionId: session.id,
        sender: "bot",
        content: faq.answer,
      },
    });

    broadcastToSession(session.id, {
      type: "message:new",
      sessionId: session.id,
      message: {
        id: userMessage.id,
        sessionId: userMessage.sessionId,
        sender: userMessage.sender,
        content: userMessage.content,
        createdAt: userMessage.createdAt.toISOString(),
      },
    });

    broadcastToSession(session.id, {
      type: "message:new",
      sessionId: session.id,
      message: {
        id: botMessage.id,
        sessionId: botMessage.sessionId,
        sender: botMessage.sender,
        content: botMessage.content,
        createdAt: botMessage.createdAt.toISOString(),
      },
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});
