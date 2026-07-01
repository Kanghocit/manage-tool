import express from "express";
import { z } from "zod";

import { prisma } from "../lib/prisma";
import {
  formatLicenseRequestTelegramMessage,
  sendTelegramMessage,
} from "../lib/telegram";
import { requireAuth } from "../middleware/auth";

const createBodySchema = z.object({
  note: z.string().max(500).optional(),
});

function serializeRequest(row: {
  id: string;
  durationDays: number;
  note: string | null;
  status: string;
  rejectReason: string | null;
  fulfilledLicenseId: string | null;
  createdAt: Date;
  reviewedAt: Date | null;
}) {
  return {
    id: row.id,
    durationDays: row.durationDays,
    note: row.note,
    status: row.status,
    rejectReason: row.rejectReason,
    fulfilledLicenseId: row.fulfilledLicenseId,
    createdAt: row.createdAt,
    reviewedAt: row.reviewedAt,
  };
}

export const licenseRequestsRouter = express.Router();
licenseRequestsRouter.use(requireAuth);

licenseRequestsRouter.post("/", async (req, res, next) => {
  try {
    const parsed = createBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: "INVALID_PAYLOAD",
        message: "Invalid request payload.",
      });
    }

    const userId = req.auth!.userId;

    const existingPending = await prisma.licenseRequest.findFirst({
      where: { userId, status: "pending" },
      select: { id: true },
    });
    if (existingPending) {
      return res.status(409).json({
        success: false,
        code: "PENDING_REQUEST_EXISTS",
        message: "You already have a pending license request.",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, fullName: true },
    });
    if (!user) {
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "User not found.",
      });
    }

    const request = await prisma.licenseRequest.create({
      data: {
        userId,
        durationDays: 1,
        note: parsed.data.note?.trim() || null,
        status: "pending",
      },
    });

    void sendTelegramMessage(
      formatLicenseRequestTelegramMessage({
        requestId: request.id,
        userEmail: user.email,
        userFullName: user.fullName,
        note: request.note,
        createdAt: request.createdAt,
      }),
    );

    return res.status(201).json({
      success: true,
      request: serializeRequest(request),
    });
  } catch (err) {
    next(err);
  }
});

licenseRequestsRouter.get("/me", async (req, res, next) => {
  try {
    const request = await prisma.licenseRequest.findFirst({
      where: { userId: req.auth!.userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        durationDays: true,
        note: true,
        status: true,
        rejectReason: true,
        fulfilledLicenseId: true,
        createdAt: true,
        reviewedAt: true,
      },
    });

    return res.json({
      success: true,
      request: request ? serializeRequest(request) : null,
    });
  } catch (err) {
    next(err);
  }
});
