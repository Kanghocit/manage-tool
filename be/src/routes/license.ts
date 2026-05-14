import express from "express";
import { z } from "zod";

import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { licenseKeyHash } from "../utils/licenseKey";

const activateSchema = z.object({
  licenseKey: z.string().min(8),
  deviceId: z.string().min(4),
  deviceName: z.string().min(1).optional(),
  userAgent: z.string().min(1).optional(),
});

const verifySchema = z.object({
  deviceId: z.string().min(4),
});

export const licenseRouter = express.Router();

licenseRouter.post("/activate", requireAuth, async (req, res, next) => {
  try {
    const parsed = activateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: "INVALID_PAYLOAD",
        message: "Invalid activate payload.",
      });
    }

    const { userId } = req.auth!;
    const keyHash = licenseKeyHash(parsed.data.licenseKey.trim());

    const license = await prisma.license.findFirst({
      where: { licenseKeyHash: keyHash, deletedAt: null },
    });
    if (!license) {
      return res.status(404).json({
        success: false,
        code: "LICENSE_NOT_FOUND",
        message: "License not found.",
      });
    }
    if (license.status === "blocked") {
      return res.status(403).json({
        success: false,
        code: "LICENSE_BLOCKED",
        message: "License is blocked.",
      });
    }
    if (license.expiresAt && license.expiresAt.getTime() <= Date.now()) {
      if (license.status !== "expired") {
        await prisma.license.update({
          where: { id: license.id },
          data: { status: "expired" },
        });
      }
      return res.status(403).json({
        success: false,
        code: "LICENSE_EXPIRED",
        message: "License is expired.",
      });
    }

    // if active but belongs to another user
    if (license.activatedById && license.activatedById !== userId) {
      return res.status(403).json({
        success: false,
        code: "LICENSE_ALREADY_USED_BY_OTHER_USER",
        message: "License already used by another user.",
      });
    }

    // if license already has this device active -> idempotent OK
    const existingActivation = await prisma.licenseActivation.findUnique({
      where: {
        licenseId_deviceId: {
          licenseId: license.id,
          deviceId: parsed.data.deviceId,
        },
      },
    });

    if (existingActivation && !existingActivation.revokedAt) {
      return res.json({
        success: true,
        status: license.status,
        expiresAt: license.expiresAt,
        maxDevices: license.maxDevices,
        message: "License activated successfully",
      });
    }
    if (existingActivation?.revokedAt) {
      return res.status(403).json({
        success: false,
        code: "DEVICE_REVOKED",
        message: "Device is revoked.",
      });
    }

    // device limit check
    const activeCount = await prisma.licenseActivation.count({
      where: { licenseId: license.id, revokedAt: null },
    });
    if (activeCount >= license.maxDevices) {
      return res.status(403).json({
        success: false,
        code: "DEVICE_LIMIT_REACHED",
        message: "Device limit reached.",
      });
    }

    const now = new Date();

    // first activation: bind to user, compute expiresAt if durationDays
    let updated = license;
    if (license.status === "unused") {
      const expiresAt = license.durationDays
        ? new Date(now.getTime() + license.durationDays * 24 * 60 * 60 * 1000)
        : null;

      updated = await prisma.license.update({
        where: { id: license.id },
        data: {
          status: "active",
          activatedById: userId,
          activatedAt: now,
          expiresAt: expiresAt ?? license.expiresAt,
        },
      });
    } else if (license.status !== "active") {
      // normalize (e.g. expired already handled)
      updated = await prisma.license.update({
        where: { id: license.id },
        data: { status: "active" },
      });
    }

    await prisma.licenseActivation.create({
      data: {
        licenseId: updated.id,
        userId,
        deviceId: parsed.data.deviceId,
        deviceName: parsed.data.deviceName,
        userAgent: parsed.data.userAgent,
        lastIp: req.ip,
        activatedAt: now,
        lastSeenAt: now,
      },
    });

    return res.json({
      success: true,
      status: updated.status,
      expiresAt: updated.expiresAt,
      maxDevices: updated.maxDevices,
      message: "License activated successfully",
    });
  } catch (err) {
    next(err);
  }
});

licenseRouter.post("/verify", requireAuth, async (req, res, next) => {
  try {
    const parsed = verifySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: "INVALID_PAYLOAD",
        message: "Invalid verify payload.",
      });
    }

    const { userId } = req.auth!;

    const license = await prisma.license.findFirst({
      where: { activatedById: userId, status: "active", deletedAt: null },
      orderBy: { activatedAt: "desc" },
    });

    if (!license) {
      return res.json({
        success: true,
        allowed: false,
        code: "LICENSE_NOT_FOUND",
        message: "No active license.",
      });
    }
    if (license.status === "blocked") {
      return res.json({
        success: true,
        allowed: false,
        code: "LICENSE_BLOCKED",
        message: "License is blocked.",
      });
    }
    if (license.expiresAt && license.expiresAt.getTime() <= Date.now()) {
      await prisma.license.update({
        where: { id: license.id },
        data: { status: "expired" },
      });
      return res.json({
        success: true,
        allowed: false,
        code: "LICENSE_EXPIRED",
        message: "License is expired.",
      });
    }

    const activation = await prisma.licenseActivation.findUnique({
      where: {
        licenseId_deviceId: {
          licenseId: license.id,
          deviceId: parsed.data.deviceId,
        },
      },
    });
    if (!activation) {
      return res.json({
        success: true,
        allowed: false,
        code: "DEVICE_LIMIT_REACHED",
        message: "Device not activated.",
      });
    }
    if (activation.revokedAt) {
      return res.json({
        success: true,
        allowed: false,
        code: "DEVICE_REVOKED",
        message: "Device revoked.",
      });
    }

    await prisma.licenseActivation.update({
      where: { id: activation.id },
      data: { lastSeenAt: new Date(), lastIp: req.ip },
    });

    return res.json({
      success: true,
      allowed: true,
      license: {
        status: license.status,
        expiresAt: license.expiresAt,
        maxDevices: license.maxDevices,
      },
    });
  } catch (err) {
    next(err);
  }
});

licenseRouter.get("/me", requireAuth, async (req, res, next) => {
  try {
    const { userId } = req.auth!;
    const license = await prisma.license.findFirst({
      where: { activatedById: userId, deletedAt: null },
      orderBy: { activatedAt: "desc" },
      include: {
        activations: {
          where: { revokedAt: null },
          orderBy: { lastSeenAt: "desc" },
          select: {
            id: true,
            deviceId: true,
            deviceName: true,
            activatedAt: true,
            lastSeenAt: true,
          },
        },
      },
    });

    // Load from PurchaseOrder (FK side) instead of filtering License.fulfilledFromOrder —
    // optional reverse filters can error on some Prisma/DB setups.
    const paidOrdersWithLicense = await prisma.purchaseOrder.findMany({
      where: {
        userId,
        status: "paid",
        fulfilledLicenseId: { not: null },
      },
      orderBy: { createdAt: "desc" },
      include: { fulfilledLicense: true },
    });

    let purchasedUnusedLicense: {
      id: string;
      licenseKeyPreview: string;
      durationDays: number | null;
      purchaseOrderId: string | null;
    } | null = null;

    for (const order of paidOrdersWithLicense) {
      const l = order.fulfilledLicense;
      if (
        l &&
        l.status === "unused" &&
        l.deletedAt === null &&
        l.activatedById === null
      ) {
        purchasedUnusedLicense = {
          id: l.id,
          licenseKeyPreview: l.licenseKeyPreview,
          durationDays: l.durationDays,
          purchaseOrderId: order.id,
        };
        break;
      }
    }

    if (!license) {
      if (req.auth!.role === 'user' && !purchasedUnusedLicense) {
        return res.status(404).json({
          success: false,
          code: 'NO_LICENSE',
          message: 'Bạn chưa có license. Vui lòng mua hoặc nhập license key để tiếp tục.',
        });
      }
      return res.json({
        success: true,
        license: null,
        devices: [],
        purchasedUnusedLicense,
      });
    }

    const expired = !!license.expiresAt && license.expiresAt.getTime() <= Date.now();
    const blocked = license.status === "blocked";
    const active = license.status === "active" && !blocked && !expired;
    const devices = license.activations.map((d) => ({
      id: d.id,
      deviceId: d.deviceId,
      deviceName: d.deviceName,
      status: "active",
      activatedAt: d.activatedAt,
      lastSeenAt: d.lastSeenAt,
    }));

    return res.json({
      success: true,
      license: {
        id: license.id,
        licenseKey: license.licenseKeyPreview,
        status: license.status,
        active,
        blocked,
        expired,
        userId: license.activatedById,
        expiresAt: license.expiresAt,
        durationDays: license.durationDays,
        activatedAt: license.activatedAt,
        maxDevices: license.maxDevices,
        devices,
      },
      devices,
      purchasedUnusedLicense,
    });
  } catch (err) {
    next(err);
  }
});
