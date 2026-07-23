import express from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { runManager } from "../automation/runManager";

const admin = [requireAuth, requireRole("admin")];

const listRunsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  toolId: z.string().uuid().optional(),
  status: z
    .enum(["pending", "running", "completed", "failed", "cancelled"])
    .optional(),
});

async function audit(
  actorUserId: string,
  action: string,
  targetType: string,
  targetId: string,
  metadata?: Record<string, unknown>,
) {
  await prisma.auditLog.create({
    data: {
      actorUserId,
      action,
      targetType,
      targetId,
      metadataJson:
        metadata === undefined
          ? undefined
          : (metadata as Prisma.InputJsonValue),
    },
  });
}

export const adminRunsRouter = express.Router();
adminRunsRouter.use(...admin);

adminRunsRouter.get("/", async (req, res, next) => {
  try {
    const parsed = listRunsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: "INVALID_QUERY",
        message: "Invalid query parameters.",
      });
    }

    const { page, limit, toolId, status } = parsed.data;
    const where: Prisma.AutomationRunWhereInput = {
      ...(toolId ? { toolId } : {}),
      ...(status ? { status } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.automationRun.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          tool: { select: { id: true, name: true } },
          createdBy: { select: { id: true, fullName: true, email: true } },
          _count: { select: { sessions: true } },
        },
      }),
      prisma.automationRun.count({ where }),
    ]);

    return res.json({ success: true, items, total, page, limit });
  } catch (err) {
    return next(err);
  }
});

adminRunsRouter.get("/:id", async (req, res, next) => {
  try {
    const run = await prisma.automationRun.findUnique({
      where: { id: req.params.id },
      include: {
        tool: { select: { id: true, name: true, defaultLoopCount: true } },
        createdBy: { select: { id: true, fullName: true, email: true } },
        sessions: {
          include: {
            profile: {
              select: {
                id: true,
                name: true,
                userAgent: true,
                proxyUrl: true,
                viewportWidth: true,
                viewportHeight: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!run) {
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Run not found.",
      });
    }

    return res.json({ success: true, run });
  } catch (err) {
    return next(err);
  }
});

adminRunsRouter.post("/:id/cancel", async (req, res, next) => {
  try {
    const run = await prisma.automationRun.findUnique({
      where: { id: req.params.id },
    });

    if (!run) {
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Run not found.",
      });
    }

    if (!["pending", "running"].includes(run.status)) {
      return res.status(400).json({
        success: false,
        code: "NOT_CANCELLABLE",
        message: "Run is not active.",
      });
    }

    const cancelled = runManager.cancel(run.id);
    if (!cancelled && run.status === "pending") {
      await prisma.automationRun.update({
        where: { id: run.id },
        data: { status: "cancelled", finishedAt: new Date() },
      });
      await prisma.automationRunSession.updateMany({
        where: { runId: run.id },
        data: { status: "cancelled", finishedAt: new Date() },
      });
    }

    await audit(req.auth!.userId, "automation_run.cancel", "AutomationRun", run.id);

    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});
