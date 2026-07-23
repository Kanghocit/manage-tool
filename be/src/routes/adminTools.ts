import express from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { runManager } from "../automation/runManager";
import { stepsSchema } from "../automation/steps";

const admin = [requireAuth, requireRole("admin")];

const createToolSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().max(2000).optional(),
  steps: stepsSchema,
  defaultLoopCount: z.number().int().min(1).max(10_000).default(1),
});

const updateToolSchema = createToolSchema.partial();

const runToolSchema = z.object({
  profileIds: z.array(z.string().uuid()).min(1).max(20),
  loopCount: z.number().int().min(1).max(10_000),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  keyword: z.string().max(100).optional(),
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

export const adminToolsRouter = express.Router();
adminToolsRouter.use(...admin);

adminToolsRouter.get("/", async (req, res, next) => {
  try {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: "INVALID_QUERY",
        message: "Invalid query parameters.",
      });
    }

    const { page, limit, keyword } = parsed.data;
    const where: Prisma.AutomationToolWhereInput = {
      deletedAt: null,
      ...(keyword
        ? {
            OR: [
              { name: { contains: keyword, mode: "insensitive" } },
              { description: { contains: keyword, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.automationTool.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          createdBy: { select: { id: true, fullName: true, email: true } },
          _count: { select: { runs: true } },
        },
      }),
      prisma.automationTool.count({ where }),
    ]);

    return res.json({ success: true, items, total, page, limit });
  } catch (err) {
    return next(err);
  }
});

adminToolsRouter.get("/:id", async (req, res, next) => {
  try {
    const tool = await prisma.automationTool.findFirst({
      where: { id: req.params.id, deletedAt: null },
      include: {
        createdBy: { select: { id: true, fullName: true, email: true } },
      },
    });

    if (!tool) {
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Tool not found.",
      });
    }

    return res.json({ success: true, tool });
  } catch (err) {
    return next(err);
  }
});

adminToolsRouter.post("/", async (req, res, next) => {
  try {
    const parsed = createToolSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: "INVALID_PAYLOAD",
        message: "Invalid tool payload.",
        errors: parsed.error.flatten(),
      });
    }

    const tool = await prisma.automationTool.create({
      data: {
        ...parsed.data,
        steps: parsed.data.steps as Prisma.InputJsonValue,
        createdById: req.auth!.userId,
      },
    });

    await audit(req.auth!.userId, "automation_tool.create", "AutomationTool", tool.id, {
      name: tool.name,
    });

    return res.status(201).json({ success: true, tool });
  } catch (err) {
    return next(err);
  }
});

adminToolsRouter.put("/:id", async (req, res, next) => {
  try {
    const parsed = updateToolSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: "INVALID_PAYLOAD",
        message: "Invalid tool payload.",
        errors: parsed.error.flatten(),
      });
    }

    const existing = await prisma.automationTool.findFirst({
      where: { id: req.params.id, deletedAt: null },
    });
    if (!existing) {
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Tool not found.",
      });
    }

    const { steps, ...rest } = parsed.data;
    const tool = await prisma.automationTool.update({
      where: { id: existing.id },
      data: {
        ...rest,
        ...(steps !== undefined
          ? { steps: steps as Prisma.InputJsonValue }
          : {}),
      },
    });

    await audit(req.auth!.userId, "automation_tool.update", "AutomationTool", tool.id);

    return res.json({ success: true, tool });
  } catch (err) {
    return next(err);
  }
});

adminToolsRouter.delete("/:id", async (req, res, next) => {
  try {
    const existing = await prisma.automationTool.findFirst({
      where: { id: req.params.id, deletedAt: null },
    });
    if (!existing) {
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Tool not found.",
      });
    }

    await prisma.automationTool.update({
      where: { id: existing.id },
      data: { deletedAt: new Date() },
    });

    await audit(req.auth!.userId, "automation_tool.delete", "AutomationTool", existing.id);

    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

adminToolsRouter.post("/:id/run", async (req, res, next) => {
  try {
    const parsed = runToolSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: "INVALID_PAYLOAD",
        message: "Invalid run payload.",
        errors: parsed.error.flatten(),
      });
    }

    const tool = await prisma.automationTool.findFirst({
      where: { id: req.params.id, deletedAt: null },
    });
    if (!tool) {
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Tool not found.",
      });
    }

    const profiles = await prisma.browserProfile.findMany({
      where: { id: { in: parsed.data.profileIds } },
    });
    if (profiles.length !== parsed.data.profileIds.length) {
      return res.status(400).json({
        success: false,
        code: "INVALID_PROFILES",
        message: "One or more browser profiles were not found.",
      });
    }

    const run = await prisma.automationRun.create({
      data: {
        toolId: tool.id,
        loopCount: parsed.data.loopCount,
        createdById: req.auth!.userId,
        sessions: {
          create: parsed.data.profileIds.map((profileId) => ({
            profileId,
          })),
        },
      },
      include: {
        sessions: {
          include: { profile: { select: { id: true, name: true } } },
        },
      },
    });

    await audit(req.auth!.userId, "automation_run.start", "AutomationRun", run.id, {
      toolId: tool.id,
      profileIds: parsed.data.profileIds,
      loopCount: parsed.data.loopCount,
    });

    void runManager.enqueueRun(run.id);

    return res.status(201).json({ success: true, run });
  } catch (err) {
    return next(err);
  }
});
