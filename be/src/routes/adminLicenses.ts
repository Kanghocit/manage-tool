import express from "express";
import { z } from "zod";
import type { LicenseStatus, Prisma } from "@prisma/client";

import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import {
  generateLicenseKey,
  licenseKeyHash,
  licenseKeyPreview,
} from "../utils/licenseKey";

const admin = [requireAuth, requireRole("admin")];

const createSchema = z.object({
  durationDays: z.number().int().positive().nullable().optional(),
  maxDevices: z.number().int().min(1).max(50).default(1),
  quantity: z.number().int().min(1).max(100).default(1),
  notes: z.string().max(500).optional(),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["unused", "active", "expired", "blocked"]).optional(),
  keyword: z.string().max(100).optional(),
});

const extendSchema = z.object({
  extraDays: z.number().int().min(1).max(3650),
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

function resolveStatusAfterUnblock(lic: {
  status: LicenseStatus;
  expiresAt: Date | null;
  activatedById: string | null;
}): LicenseStatus {
  if (lic.expiresAt && lic.expiresAt.getTime() <= Date.now()) return "expired";
  if (lic.activatedById) return "active";
  return "unused";
}

export const adminLicensesRouter = express.Router();
adminLicensesRouter.use(...admin);

adminLicensesRouter.post("/", async (req, res, next) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({
          success: false,
          code: "INVALID_PAYLOAD",
          message: "Invalid create payload.",
        });
    }

    const { durationDays, maxDevices, quantity, notes } = parsed.data;
    const actorId = req.auth!.userId;

    const created: {
      licenseKey: string;
      durationDays: number | null;
      maxDevices: number;
    }[] = [];

    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < quantity; i += 1) {
        let plain = generateLicenseKey();
        let hash = licenseKeyHash(plain);
        let tries = 0;
        while (tries < 20) {
          const exists = await tx.license.findUnique({
            where: { licenseKeyHash: hash },
          });
          if (!exists) break;
          plain = generateLicenseKey();
          hash = licenseKeyHash(plain);
          tries += 1;
        }
        if (tries >= 20) {
          throw new Error("Could not generate unique license key");
        }

        await tx.license.create({
          data: {
            licenseKeyHash: hash,
            licenseKeyPlain: plain,
            licenseKeyPreview: licenseKeyPreview(plain),
            status: "unused",
            durationDays: durationDays ?? null,
            maxDevices,
            notes: notes ?? null,
            createdById: actorId,
          },
        });

        created.push({
          licenseKey: plain,
          durationDays: durationDays ?? null,
          maxDevices,
        });
      }
    });

    await audit(actorId, "admin.license.create", "license", "bulk", {
      quantity,
    });

    return res.status(201).json({ success: true, licenses: created });
  } catch (err) {
    next(err);
  }
});

adminLicensesRouter.get("/", async (req, res, next) => {
  try {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res
        .status(400)
        .json({
          success: false,
          code: "INVALID_PAYLOAD",
          message: "Invalid list query.",
        });
    }

    const { page, limit, status, keyword } = parsed.data;
    const where: Prisma.LicenseWhereInput = { deletedAt: null };

    if (status) where.status = status;
    const kw = keyword?.trim();
    if (kw) {
      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          kw,
        );
      where.OR = [
        { licenseKeyPreview: { contains: kw, mode: "insensitive" } },
        { licenseKeyPlain: { contains: kw, mode: "insensitive" } },
        ...(isUuid ? [{ id: kw }] : []),
      ];
    }

    const [rows, total] = await Promise.all([
      prisma.license.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: { activatedBy: { select: { email: true } } },
      }),
      prisma.license.count({ where }),
    ]);

    return res.json({
      success: true,
      items: rows.map((l) => ({
        id: l.id,
        licenseKey: l.licenseKeyPlain,
        licenseKeyPreview: l.licenseKeyPreview,
        status: l.status,
        durationDays: l.durationDays,
        expiresAt: l.expiresAt,
        maxDevices: l.maxDevices,
        activatedBy: l.activatedBy?.email ?? null,
        activatedAt: l.activatedAt,
      })),
      total,
    });
  } catch (err) {
    next(err);
  }
});

adminLicensesRouter.delete(
  "/:licenseId/devices/:activationId",
  async (req, res, next) => {
    try {
      const { licenseId, activationId } = req.params;
      const actorId = req.auth!.userId;

      const activation = await prisma.licenseActivation.findFirst({
        where: { id: activationId, licenseId },
      });
      if (!activation) {
        return res
          .status(404)
          .json({
            success: false,
            code: "NOT_FOUND",
            message: "Activation not found.",
          });
      }

      await prisma.licenseActivation.update({
        where: { id: activationId },
        data: { revokedAt: new Date() },
      });

      await audit(
        actorId,
        "admin.license.revoke_device",
        "license_activation",
        activationId,
        { licenseId },
      );

      return res.json({ success: true, message: "Device revoked" });
    } catch (err) {
      next(err);
    }
  },
);

adminLicensesRouter.get("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const lic = await prisma.license.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        licenseKeyPlain: true,
        licenseKeyPreview: true,
        status: true,
        durationDays: true,
        expiresAt: true,
        maxDevices: true,
        notes: true,
        activatedAt: true,
        activatedBy: { select: { id: true, email: true } },
        activations: { orderBy: { activatedAt: "desc" } },
      },
    });
    if (!lic) {
      return res
        .status(404)
        .json({
          success: false,
          code: "NOT_FOUND",
          message: "License not found.",
        });
    }

    return res.json({
      success: true,
      license: {
        id: lic.id,
        licenseKey: lic.licenseKeyPlain,
        licenseKeyPreview: lic.licenseKeyPreview,
        status: lic.status,
        durationDays: lic.durationDays,
        expiresAt: lic.expiresAt,
        maxDevices: lic.maxDevices,
        notes: lic.notes,
        activatedBy: lic.activatedBy,
        activatedAt: lic.activatedAt,
        devices: lic.activations.map((a) => ({
          id: a.id,
          deviceId: a.deviceId,
          deviceName: a.deviceName,
          lastIp: a.lastIp,
          activatedAt: a.activatedAt,
          lastSeenAt: a.lastSeenAt,
          revokedAt: a.revokedAt,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

adminLicensesRouter.patch("/:id/block", async (req, res, next) => {
  try {
    const { id } = req.params;
    const actorId = req.auth!.userId;

    const lic = await prisma.license.findFirst({
      where: { id, deletedAt: null },
    });
    if (!lic) {
      return res
        .status(404)
        .json({
          success: false,
          code: "NOT_FOUND",
          message: "License not found.",
        });
    }

    await prisma.license.update({ where: { id }, data: { status: "blocked" } });
    await audit(actorId, "admin.license.block", "license", id, {});

    return res.json({ success: true, message: "License blocked" });
  } catch (err) {
    next(err);
  }
});

adminLicensesRouter.patch("/:id/unblock", async (req, res, next) => {
  try {
    const { id } = req.params;
    const actorId = req.auth!.userId;

    const lic = await prisma.license.findFirst({
      where: { id, deletedAt: null },
    });
    if (!lic) {
      return res
        .status(404)
        .json({
          success: false,
          code: "NOT_FOUND",
          message: "License not found.",
        });
    }

    const newStatus = resolveStatusAfterUnblock(lic);
    await prisma.license.update({ where: { id }, data: { status: newStatus } });
    await audit(actorId, "admin.license.unblock", "license", id, { newStatus });

    return res.json({ success: true, message: "License unblocked" });
  } catch (err) {
    next(err);
  }
});

adminLicensesRouter.patch("/:id/extend", async (req, res, next) => {
  try {
    const { id } = req.params;
    const parsed = extendSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({
          success: false,
          code: "INVALID_PAYLOAD",
          message: "Invalid extend payload.",
        });
    }
    const { extraDays } = parsed.data;
    const actorId = req.auth!.userId;

    const lic = await prisma.license.findFirst({
      where: { id, deletedAt: null },
    });
    if (!lic) {
      return res
        .status(404)
        .json({
          success: false,
          code: "NOT_FOUND",
          message: "License not found.",
        });
    }

    const ms = extraDays * 24 * 60 * 60 * 1000;
    let expiresAt: Date | null = lic.expiresAt;

    if (!lic.activatedById) {
      const current = lic.durationDays ?? 0;
      await prisma.license.update({
        where: { id },
        data: { durationDays: current + extraDays },
      });
    } else if (lic.expiresAt) {
      expiresAt = new Date(lic.expiresAt.getTime() + ms);
      await prisma.license.update({
        where: { id },
        data: { expiresAt },
      });
    } else {
      await prisma.license.update({
        where: { id },
        data: { durationDays: (lic.durationDays ?? 0) + extraDays },
      });
    }

    const updated = await prisma.license.findUnique({ where: { id } });
    await audit(actorId, "admin.license.extend", "license", id, { extraDays });

    return res.json({ success: true, expiresAt: updated?.expiresAt ?? null });
  } catch (err) {
    next(err);
  }
});

adminLicensesRouter.delete("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const actorId = req.auth!.userId;

    const lic = await prisma.license.findUnique({ where: { id } });
    if (!lic || lic.deletedAt) {
      return res
        .status(404)
        .json({
          success: false,
          code: "NOT_FOUND",
          message: "License not found.",
        });
    }

    await prisma.license.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById: actorId },
    });
    await audit(actorId, "admin.license.delete", "license", id, {});

    return res.json({ success: true, message: "License deleted." });
  } catch (err) {
    next(err);
  }
});
