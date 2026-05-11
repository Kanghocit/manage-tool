import crypto from "node:crypto";
import express from "express";
import { z } from "zod";

import { env } from "../config/env";
import { getPackageByCode, packageCodeSchema } from "../config/licensePackages";
import { createUnusedLicense } from "../lib/createUnusedLicense";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

const createBodySchema = z.object({
  packageCode: packageCodeSchema,
});

function buildSepayQrImageUrl(amountVnd: number, des: string): string | null {
  const bank = env.sepayQr.bank.trim();
  const acc = (env.sepayQr.acc || env.vietQr.accountNo).trim();
  if (!bank || !acc) return null;
  const params = new URLSearchParams({
    acc,
    bank,
    amount: String(amountVnd),
    des,
  });
  if (env.sepayQr.template) {
    params.set("template", env.sepayQr.template);
  }
  return `https://qr.sepay.vn/img?${params.toString()}`;
}

function buildVietQrImageUrl(
  amountVnd: number,
  addInfo: string,
): string | null {
  const { bankCode, accountNo, accountName } = env.vietQr;
  if (!bankCode || !accountNo) return null;
  const params = new URLSearchParams({
    amount: String(amountVnd),
    addInfo,
  });
  if (accountName) {
    params.set("accountName", accountName);
  }
  return `https://img.vietqr.io/image/${bankCode}-${accountNo}-compact2.png?${params.toString()}`;
}

/**
 * QR image for checkout: SePay qr.sepay.vn (if SEPAY_QR_BANK + acc), else VietQR.io, else static URL.
 */
export function resolvePurchaseQrImageUrl(
  amountVnd: number,
  transferContent: string,
): string | null {
  const sepayImg = buildSepayQrImageUrl(amountVnd, transferContent);
  if (sepayImg) return sepayImg;
  const vietQr = buildVietQrImageUrl(amountVnd, transferContent);
  if (vietQr) return vietQr;
  if (env.sepayCheckoutQrUrl) return env.sepayCheckoutQrUrl;
  return null;
}

async function uniqueTransferContent(): Promise<string> {
  for (let i = 0; i < 12; i += 1) {
    const token = `LIC${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
    const clash = await prisma.purchaseOrder.findUnique({
      where: { transferContent: token },
      select: { id: true },
    });
    if (!clash) return token;
  }
  throw new Error("Could not allocate transfer reference");
}

/** Pending orders older than this are auto-expired (20 seconds). */
const ORDER_EXPIRY_MS = 30 * 1000;

/** Expire a stale pending order; returns true if it was expired. */
async function expireIfStale(
  orderId: string,
  createdAt: Date,
): Promise<boolean> {
  if (Date.now() - createdAt.getTime() < ORDER_EXPIRY_MS) return false;
  await prisma.purchaseOrder.updateMany({
    where: { id: orderId, status: "pending" },
    data: { status: "failed" },
  });
  return true;
}

export const purchasesRouter = express.Router();
purchasesRouter.use(requireAuth);

purchasesRouter.post("/", async (req, res, next) => {
  try {
    if (req.auth!.role !== "user") {
      return res
        .status(403)
        .json({
          success: false,
          code: "FORBIDDEN",
          message: "Only user accounts can purchase.",
        });
    }

    const parsed = createBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({
          success: false,
          code: "INVALID_PAYLOAD",
          message: "Invalid purchase payload.",
        });
    }

    const pkg = getPackageByCode(parsed.data.packageCode);
    if (!pkg) {
      return res
        .status(400)
        .json({
          success: false,
          code: "UNKNOWN_PACKAGE",
          message: "Unknown package.",
        });
    }

    // Admin-only packages cannot be purchased by regular users.
    // (role is already narrowed to 'user' above, so this guard is for future-proofing)
    if (pkg.adminOnly) {
      return res.status(403).json({ success: false, code: 'ADMIN_ONLY_PACKAGE', message: 'This package is not available for purchase.' })
    }

    // One-time limit: PKG_1D can only be purchased once per account.
    if (parsed.data.packageCode === "PKG_1D") {
      const alreadyBought = await prisma.purchaseOrder.findFirst({
        where: {
          userId: req.auth!.userId,
          packageCode: "PKG_1D",
          status: "paid",
        },
        select: { id: true },
      });
      if (alreadyBought) {
        return res.status(403).json({
          success: false,
          code: "PKG_1D_ALREADY_PURCHASED",
          message:
            "The 1-day trial package can only be purchased once per account.",
        });
      }
    }

    // Check for existing pending order; auto-expire if it is stale.
    const existingPending = await prisma.purchaseOrder.findFirst({
      where: { userId: req.auth!.userId, status: "pending" },
      orderBy: { createdAt: "desc" },
    });
    if (existingPending) {
      const expired = await expireIfStale(
        existingPending.id,
        existingPending.createdAt,
      );
      if (!expired) {
        const qrImageUrl = resolvePurchaseQrImageUrl(
          existingPending.amountVnd,
          existingPending.transferContent,
        );
        return res.status(409).json({
          success: false,
          code: "PENDING_ORDER_EXISTS",
          message:
            "You already have a transfer waiting for payment. Finish that payment or wait for it to expire.",
          order: {
            id: existingPending.id,
            packageCode: existingPending.packageCode,
            amountVnd: existingPending.amountVnd,
            transferContent: existingPending.transferContent,
            status: existingPending.status,
            createdAt: existingPending.createdAt,
            qrImageUrl,
          },
        });
      }
    }

    const transferContent = await uniqueTransferContent();
    const order = await prisma.purchaseOrder.create({
      data: {
        userId: req.auth!.userId,
        packageCode: pkg.code,
        amountVnd: pkg.amountVnd,
        transferContent,
        status: "pending",
      },
    });

    const qrImageUrl = resolvePurchaseQrImageUrl(
      order.amountVnd,
      order.transferContent,
    );

    return res.status(201).json({
      success: true,
      order: {
        id: order.id,
        packageCode: order.packageCode,
        amountVnd: order.amountVnd,
        transferContent: order.transferContent,
        status: order.status,
        createdAt: order.createdAt,
        qrImageUrl,
      },
    });
  } catch (err) {
    next(err);
  }
});

purchasesRouter.get("/pending", async (req, res, next) => {
  try {
    const order = await prisma.purchaseOrder.findFirst({
      where: { userId: req.auth!.userId, status: "pending" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        packageCode: true,
        amountVnd: true,
        transferContent: true,
        status: true,
        fulfilledLicenseId: true,
        createdAt: true,
      },
    });

    if (!order) {
      return res.json({ success: true, order: null });
    }

    // Auto-expire stale pending orders.
    const expired = await expireIfStale(order.id, order.createdAt);
    if (expired) {
      return res.json({ success: true, order: null });
    }

    const qrImageUrl = resolvePurchaseQrImageUrl(
      order.amountVnd,
      order.transferContent,
    );
    return res.json({ success: true, order: { ...order, qrImageUrl } });
  } catch (err) {
    next(err);
  }
});

purchasesRouter.delete("/:id", async (req, res, next) => {
  try {
    const id = z.string().uuid().safeParse(req.params.id);
    if (!id.success) {
      return res
        .status(400)
        .json({
          success: false,
          code: "INVALID_ID",
          message: "Invalid order id.",
        });
    }

    const order = await prisma.purchaseOrder.findFirst({
      where: { id: id.data, userId: req.auth!.userId },
      select: { id: true, status: true },
    });

    if (!order) {
      return res
        .status(404)
        .json({
          success: false,
          code: "NOT_FOUND",
          message: "Order not found.",
        });
    }

    if (order.status !== "pending") {
      return res.status(409).json({
        success: false,
        code: "NOT_CANCELLABLE",
        message: `Only pending orders can be cancelled. Current status: ${order.status}.`,
      });
    }

    await prisma.purchaseOrder.update({
      where: { id: order.id },
      data: { status: "failed" },
    });

    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

purchasesRouter.get("/:id", async (req, res, next) => {
  try {
    const id = z.string().uuid().safeParse(req.params.id);
    if (!id.success) {
      return res
        .status(400)
        .json({
          success: false,
          code: "INVALID_ID",
          message: "Invalid order id.",
        });
    }

    const order = await prisma.purchaseOrder.findFirst({
      where: { id: id.data, userId: req.auth!.userId },
      select: {
        id: true,
        packageCode: true,
        amountVnd: true,
        transferContent: true,
        status: true,
        fulfilledLicenseId: true,
        createdAt: true,
      },
    });

    if (!order) {
      return res
        .status(404)
        .json({
          success: false,
          code: "NOT_FOUND",
          message: "Order not found.",
        });
    }

    const qrImageUrl = resolvePurchaseQrImageUrl(
      order.amountVnd,
      order.transferContent,
    );

    return res.json({
      success: true,
      order: {
        ...order,
        qrImageUrl,
      },
    });
  } catch (err) {
    next(err);
  }
});
