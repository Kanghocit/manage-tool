import express from "express";
import { z } from "zod";
import type { LicenseStatus, Prisma } from "@prisma/client";

import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import {
  createUnusedLicense,
  DuplicateLicenseKeyError,
} from "../lib/createUnusedLicense";
import { licenseKeyPreview } from "../utils/licenseKey";
import { cellNumber, cellString, rowsToXlsxBuffer, sendXlsxDownload, xlsxBufferToRows } from "../lib/excel";
import { excelUpload } from "../middleware/upload";

const admin = [requireAuth, requireRole("admin")];

const MAX_IMPORT_ROWS = 500;
const MAX_EXPORT_ROWS = 10_000;

const LICENSE_EXPORT_HEADERS = [
  "licenseKey", "licenseKeyPreview", "status", "durationDays", "maxDevices",
  "expiresAt", "activatedByEmail", "activatedAt", "notes", "createdAt",
] as const;

const LICENSE_IMPORT_HEADERS = ["durationDays", "maxDevices", "notes", "licenseKey"] as const;

const createSchema = z.object({
  durationDays: z.number().int().positive().nullable().optional(),
  maxDevices: z.number().int().min(1).max(50).default(1),
  quantity: z.number().int().min(1).max(100).default(1),
  notes: z.string().max(500).optional(),
  licenseKey: z.string().trim().min(8).max(100).optional(),
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

    const { durationDays, maxDevices, notes, licenseKey } = parsed.data;
    const actorId = req.auth!.userId;
    const customKey = licenseKey?.trim() || null;
    // A custom key can only produce one license.
    const quantity = customKey ? 1 : parsed.data.quantity;

    const created: {
      licenseKey: string;
      durationDays: number | null;
      maxDevices: number;
    }[] = [];

    try {
      await prisma.$transaction(async (tx) => {
        for (let i = 0; i < quantity; i += 1) {
          const license = await createUnusedLicense(tx, {
            durationDays: durationDays ?? null,
            maxDevices,
            notes: notes ?? null,
            createdById: actorId,
            customKey,
          });
          created.push({
            licenseKey: license.licenseKeyPlain ?? "",
            durationDays: durationDays ?? null,
            maxDevices,
          });
        }
      });
    } catch (err) {
      if (err instanceof DuplicateLicenseKeyError) {
        return res.status(409).json({
          success: false,
          code: "DUPLICATE_KEY",
          message: "License key đã tồn tại. Vui lòng nhập key khác.",
        });
      }
      throw err;
    }

    await audit(actorId, "admin.license.create", "license", "bulk", {
      quantity,
      customKey: customKey ? true : false,
    });

    return res.status(201).json({ success: true, licenses: created });
  } catch (err) {
    next(err);
  }
});


adminLicensesRouter.get("/export/template", (_req, res) => {
  const buffer = rowsToXlsxBuffer(
    "Licenses",
    [{ durationDays: 30, maxDevices: 1, notes: "Imported license", licenseKey: "" }],
    [...LICENSE_IMPORT_HEADERS],
  );
  sendXlsxDownload(res, "licenses-import-template.xlsx", buffer);
});

adminLicensesRouter.get("/export", async (req, res, next) => {
  try {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ success: false, code: "INVALID_PAYLOAD", message: "Invalid export query." });
    }
    const { status, keyword } = parsed.data;
    const where: Prisma.LicenseWhereInput = { deletedAt: null };
    if (status) where.status = status;
    const kw = keyword?.trim();
    if (kw) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(kw);
      where.OR = [
        { licenseKeyPreview: { contains: kw, mode: "insensitive" } },
        { licenseKeyPlain: { contains: kw, mode: "insensitive" } },
        ...(isUuid ? [{ id: kw }] : []),
      ];
    }
    const rows = await prisma.license.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: MAX_EXPORT_ROWS,
      include: { activatedBy: { select: { email: true } } },
    });
    const data = rows.map((l) => ({
      licenseKey: l.licenseKeyPlain ?? "",
      licenseKeyPreview: l.licenseKeyPreview,
      status: l.status,
      durationDays: l.durationDays ?? "",
      maxDevices: l.maxDevices,
      expiresAt: l.expiresAt?.toISOString() ?? "",
      activatedByEmail: l.activatedBy?.email ?? "",
      activatedAt: l.activatedAt?.toISOString() ?? "",
      notes: l.notes ?? "",
      createdAt: l.createdAt.toISOString(),
    }));
    const buffer = rowsToXlsxBuffer("Licenses", data, [...LICENSE_EXPORT_HEADERS]);
    sendXlsxDownload(res, `licenses-${new Date().toISOString().slice(0, 10)}.xlsx`, buffer);
  } catch (err) { next(err); }
});

adminLicensesRouter.post("/import", excelUpload.single("file"), async (req, res, next) => {
  try {
    const actorId = req.auth!.userId;
    if (!req.file?.buffer) {
      return res.status(400).json({ success: false, code: "NO_FILE", message: "Excel file is required." });
    }
    const rawRows = xlsxBufferToRows(req.file.buffer);
    if (rawRows.length === 0) {
      return res.status(400).json({ success: false, code: "EMPTY_FILE", message: "Excel file has no data rows." });
    }
    if (rawRows.length > MAX_IMPORT_ROWS) {
      return res.status(400).json({ success: false, code: "TOO_MANY_ROWS", message: `Maximum ${MAX_IMPORT_ROWS} rows per import.` });
    }
    const created: { licenseKey: string }[] = [];
    const skipped: { row: number; reason: string }[] = [];
    for (let i = 0; i < rawRows.length; i += 1) {
      const rowNum = i + 2;
      const row = rawRows[i];
      const durationDays = cellNumber(row, "durationDays");
      const maxDevicesRaw = cellNumber(row, "maxDevices");
      const notes = cellString(row, "notes") || null;
      const licenseKey = cellString(row, "licenseKey") || null;
      if (!durationDays || durationDays <= 0) {
        skipped.push({ row: rowNum, reason: "durationDays must be a positive number." });
        continue;
      }
      const maxDevices = maxDevicesRaw && maxDevicesRaw >= 1 ? Math.min(maxDevicesRaw, 50) : 1;
      try {
        const license = await createUnusedLicense(prisma, {
          durationDays,
          maxDevices,
          notes,
          createdById: actorId,
          customKey: licenseKey || undefined,
        });
        created.push({ licenseKey: license.licenseKeyPlain! });
      } catch (err) {
        if (err instanceof DuplicateLicenseKeyError) {
          skipped.push({ row: rowNum, reason: "License key already exists." });
          continue;
        }
        throw err;
      }
    }
    await audit(actorId, "admin.license.import", "license", "bulk", { created: created.length, skipped: skipped.length });
    return res.json({ success: true, createdCount: created.length, skippedCount: skipped.length, created, skipped });
  } catch (err) { next(err); }
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
    const previousExpiresAt = lic.expiresAt;
    const previousStatus = lic.status;

    let updateData: {
      durationDays?: number;
      expiresAt?: Date;
      status?: typeof lic.status;
    };

    if (!lic.activatedById) {
      updateData = { durationDays: (lic.durationDays ?? 0) + extraDays };
    } else {
      updateData = {
        expiresAt: new Date(Date.now() + ms),
        ...(lic.status === "expired" ? { status: "active" as const } : {}),
      };
    }

    const updated = await prisma.license.update({
      where: { id },
      data: updateData,
    });

    await audit(actorId, "admin.license.extend", "license", id, {
      extraDays,
      previousExpiresAt: previousExpiresAt?.toISOString() ?? null,
      newExpiresAt: updated.expiresAt?.toISOString() ?? null,
      previousStatus,
      newStatus: updated.status,
    });

    return res.json({
      success: true,
      expiresAt: updated.expiresAt,
      status: updated.status,
    });
  } catch (err) {
    next(err);
  }
});

adminLicensesRouter.delete("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const actorId = req.auth!.userId;

    const lic = await prisma.license.findUnique({ where: { id } });
    if (!lic) {
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
