import express from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { generateProfiles, parseProxyLines } from "../automation/profileGenerator";
import { profilePreviewManager } from "../automation/profilePreviewManager";

const admin = [requireAuth, requireRole("admin")];

const createProfileSchema = z.object({
  name: z.string().trim().min(1).max(200),
  userAgent: z.string().max(1000).optional(),
  proxyUrl: z.string().max(500).optional(),
  viewportWidth: z.number().int().min(320).max(3840).optional(),
  viewportHeight: z.number().int().min(240).max(2160).optional(),
});

const updateProfileSchema = createProfileSchema.partial();

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  keyword: z.string().max(100).optional(),
});

const previewSchema = z.object({
  url: z.string().url().max(2000).default("https://www.google.com"),
});

const bulkGenerateSchema = z.object({
  count: z.number().int().min(1).max(50),
  namePrefix: z.string().trim().min(1).max(100).default("Profile"),
  proxyList: z.string().max(20_000).optional(),
  randomizeFingerprint: z.boolean().default(true),
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

export const adminProfilesRouter = express.Router();
adminProfilesRouter.use(...admin);

adminProfilesRouter.get("/", async (req, res, next) => {
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
    const where: Prisma.BrowserProfileWhereInput = keyword
      ? { name: { contains: keyword, mode: "insensitive" } }
      : {};

    const [items, total] = await Promise.all([
      prisma.browserProfile.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          createdBy: { select: { id: true, fullName: true, email: true } },
        },
      }),
      prisma.browserProfile.count({ where }),
    ]);

    return res.json({ success: true, items, total, page, limit });
  } catch (err) {
    return next(err);
  }
});

adminProfilesRouter.post("/", async (req, res, next) => {
  try {
    const parsed = createProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: "INVALID_PAYLOAD",
        message: "Invalid profile payload.",
        errors: parsed.error.flatten(),
      });
    }

    const profile = await prisma.browserProfile.create({
      data: {
        ...parsed.data,
        createdById: req.auth!.userId,
      },
    });

    await audit(req.auth!.userId, "browser_profile.create", "BrowserProfile", profile.id, {
      name: profile.name,
    });

    return res.status(201).json({ success: true, profile });
  } catch (err) {
    return next(err);
  }
});

adminProfilesRouter.post("/bulk-generate", async (req, res, next) => {
  try {
    const parsed = bulkGenerateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: "INVALID_PAYLOAD",
        message: "Invalid bulk generate payload.",
        errors: parsed.error.flatten(),
      });
    }

    const proxyLines = parseProxyLines(parsed.data.proxyList);
    const drafts = generateProfiles({
      count: parsed.data.count,
      namePrefix: parsed.data.namePrefix,
      proxyLines,
      randomizeFingerprint: parsed.data.randomizeFingerprint,
    });

    const profiles = await prisma.$transaction(
      drafts.map((draft) =>
        prisma.browserProfile.create({
          data: {
            ...draft,
            createdById: req.auth!.userId,
          },
        }),
      ),
    );

    await audit(
      req.auth!.userId,
      "browser_profile.bulk_generate",
      "BrowserProfile",
      profiles[0]?.id ?? "bulk",
      {
        count: profiles.length,
        namePrefix: parsed.data.namePrefix,
      },
    );

    return res.status(201).json({
      success: true,
      items: profiles,
      count: profiles.length,
    });
  } catch (err) {
    return next(err);
  }
});

adminProfilesRouter.get("/previews/active", async (req, res, next) => {
  try {
    const items = profilePreviewManager.list(req.auth!.userId);
    return res.json({ success: true, items });
  } catch (err) {
    return next(err);
  }
});

adminProfilesRouter.get("/previews/:previewId/screenshot", async (req, res, next) => {
  try {
    const preview = profilePreviewManager.get(req.params.previewId);
    if (!preview || preview.createdById !== req.auth!.userId) {
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Preview session not found.",
      });
    }

    const buffer = await profilePreviewManager.screenshot(req.params.previewId);
    if (!buffer) {
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Preview session not found.",
      });
    }

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "no-store");
    return res.send(buffer);
  } catch (err) {
    return next(err);
  }
});

adminProfilesRouter.get("/previews/:previewId", async (req, res, next) => {
  try {
    const preview = profilePreviewManager.get(req.params.previewId);
    if (!preview || preview.createdById !== req.auth!.userId) {
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Preview session not found.",
      });
    }
    return res.json({ success: true, preview });
  } catch (err) {
    return next(err);
  }
});

adminProfilesRouter.post("/previews/:previewId/close", async (req, res, next) => {
  try {
    const preview = profilePreviewManager.get(req.params.previewId);
    if (!preview || preview.createdById !== req.auth!.userId) {
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Preview session not found.",
      });
    }

    await profilePreviewManager.close(req.params.previewId);
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

adminProfilesRouter.post("/:id/preview", async (req, res, next) => {
  try {
    const parsed = previewSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: "INVALID_PAYLOAD",
        message: "Invalid preview payload.",
        errors: parsed.error.flatten(),
      });
    }

    const profile = await prisma.browserProfile.findUnique({
      where: { id: req.params.id },
    });
    if (!profile) {
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Browser profile not found.",
      });
    }

    const preview = await profilePreviewManager.open(
      profile,
      req.auth!.userId,
      parsed.data.url,
    );

    await audit(req.auth!.userId, "browser_profile.preview", "BrowserProfile", profile.id, {
      previewId: preview.id,
      url: preview.url,
    });

    return res.status(201).json({ success: true, preview });
  } catch (err) {
    return next(err);
  }
});

adminProfilesRouter.get("/:id", async (req, res, next) => {
  try {
    const profile = await prisma.browserProfile.findUnique({
      where: { id: req.params.id },
      include: {
        createdBy: { select: { id: true, fullName: true, email: true } },
      },
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Browser profile not found.",
      });
    }

    return res.json({ success: true, profile });
  } catch (err) {
    return next(err);
  }
});

adminProfilesRouter.put("/:id", async (req, res, next) => {
  try {
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: "INVALID_PAYLOAD",
        message: "Invalid profile payload.",
        errors: parsed.error.flatten(),
      });
    }

    const existing = await prisma.browserProfile.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) {
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Browser profile not found.",
      });
    }

    const profile = await prisma.browserProfile.update({
      where: { id: existing.id },
      data: parsed.data,
    });

    await audit(req.auth!.userId, "browser_profile.update", "BrowserProfile", profile.id);

    return res.json({ success: true, profile });
  } catch (err) {
    return next(err);
  }
});

adminProfilesRouter.delete("/:id", async (req, res, next) => {
  try {
    const existing = await prisma.browserProfile.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) {
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Browser profile not found.",
      });
    }

    await prisma.browserProfile.delete({ where: { id: existing.id } });

    await audit(req.auth!.userId, "browser_profile.delete", "BrowserProfile", existing.id);

    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});
