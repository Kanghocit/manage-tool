import express from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

import { createUnusedLicense } from "../lib/createUnusedLicense";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";

const admin = [requireAuth, requireRole("admin")];

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["pending", "approved", "rejected"]).optional(),
  keyword: z.string().max(100).optional(),
});

const rejectBodySchema = z.object({
  reason: z.string().max(500).optional(),
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

export const adminLicenseRequestsRouter = express.Router();
adminLicenseRequestsRouter.use(...admin);

adminLicenseRequestsRouter.get("/", async (req, res, next) => {
  try {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: "INVALID_PAYLOAD",
        message: "Invalid list query.",
      });
    }

    const { page, limit, status, keyword } = parsed.data;
    const where: Prisma.LicenseRequestWhereInput = {};

    if (status) where.status = status;
    const kw = keyword?.trim();
    if (kw) {
      where.user = {
        OR: [
          { email: { contains: kw, mode: "insensitive" } },
          { fullName: { contains: kw, mode: "insensitive" } },
        ],
      };
    }

    const [rows, total] = await Promise.all([
      prisma.licenseRequest.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { id: true, email: true, fullName: true } },
          reviewedBy: { select: { id: true, email: true, fullName: true } },
        },
      }),
      prisma.licenseRequest.count({ where }),
    ]);

    return res.json({
      success: true,
      items: rows.map((r) => ({
        id: r.id,
        durationDays: r.durationDays,
        note: r.note,
        status: r.status,
        rejectReason: r.rejectReason,
        fulfilledLicenseId: r.fulfilledLicenseId,
        createdAt: r.createdAt,
        reviewedAt: r.reviewedAt,
        user: r.user,
        reviewedBy: r.reviewedBy,
      })),
      total,
    });
  } catch (err) {
    next(err);
  }
});

adminLicenseRequestsRouter.patch("/:id/approve", async (req, res, next) => {
  try {
    const id = z.string().uuid().safeParse(req.params.id);
    if (!id.success) {
      return res.status(400).json({
        success: false,
        code: "INVALID_ID",
        message: "Invalid request id.",
      });
    }

    const actorId = req.auth!.userId;
    const now = new Date();

    const existing = await prisma.licenseRequest.findUnique({
      where: { id: id.data },
      include: { user: { select: { email: true } } },
    });
    if (!existing) {
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "License request not found.",
      });
    }
    if (existing.status !== "pending") {
      return res.status(409).json({
        success: false,
        code: "NOT_PENDING",
        message: `Request is already ${existing.status}.`,
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const locked = await tx.licenseRequest.findFirst({
        where: { id: id.data, status: "pending" },
      });
      if (!locked) {
        throw new Error("REQUEST_NOT_PENDING");
      }

      const license = await createUnusedLicense(tx, {
        durationDays: locked.durationDays,
        maxDevices: 1,
        notes: `request:${locked.id}`,
        createdById: actorId,
      });

      const updated = await tx.licenseRequest.update({
        where: { id: locked.id },
        data: {
          status: "approved",
          reviewedById: actorId,
          reviewedAt: now,
          fulfilledLicenseId: license.id,
        },
        include: {
          user: { select: { id: true, email: true, fullName: true } },
        },
      });

      return { updated, licenseId: license.id };
    });

    await audit(actorId, "admin.license_request.approve", "license_request", id.data, {
      userId: existing.userId,
      licenseId: result.licenseId,
    });

    return res.json({
      success: true,
      request: {
        id: result.updated.id,
        status: result.updated.status,
        fulfilledLicenseId: result.updated.fulfilledLicenseId,
        reviewedAt: result.updated.reviewedAt,
        user: result.updated.user,
      },
    });
  } catch (err) {
    if (err instanceof Error && err.message === "REQUEST_NOT_PENDING") {
      return res.status(409).json({
        success: false,
        code: "NOT_PENDING",
        message: "Request is no longer pending.",
      });
    }
    next(err);
  }
});

adminLicenseRequestsRouter.patch("/:id/reject", async (req, res, next) => {
  try {
    const id = z.string().uuid().safeParse(req.params.id);
    if (!id.success) {
      return res.status(400).json({
        success: false,
        code: "INVALID_ID",
        message: "Invalid request id.",
      });
    }

    const parsed = rejectBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: "INVALID_PAYLOAD",
        message: "Invalid reject payload.",
      });
    }

    const actorId = req.auth!.userId;
    const now = new Date();

    const existing = await prisma.licenseRequest.findUnique({
      where: { id: id.data },
    });
    if (!existing) {
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "License request not found.",
      });
    }
    if (existing.status !== "pending") {
      return res.status(409).json({
        success: false,
        code: "NOT_PENDING",
        message: `Request is already ${existing.status}.`,
      });
    }

    const updated = await prisma.licenseRequest.update({
      where: { id: id.data },
      data: {
        status: "rejected",
        reviewedById: actorId,
        reviewedAt: now,
        rejectReason: parsed.data.reason?.trim() || null,
      },
      include: {
        user: { select: { id: true, email: true, fullName: true } },
      },
    });

    await audit(actorId, "admin.license_request.reject", "license_request", id.data, {
      userId: existing.userId,
      reason: updated.rejectReason,
    });

    return res.json({
      success: true,
      request: {
        id: updated.id,
        status: updated.status,
        rejectReason: updated.rejectReason,
        reviewedAt: updated.reviewedAt,
        user: updated.user,
      },
    });
  } catch (err) {
    next(err);
  }
});
