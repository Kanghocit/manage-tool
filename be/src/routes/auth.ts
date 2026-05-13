import bcrypt from "bcrypt";
import express from "express";
import { z } from "zod";

import { prisma } from "../lib/prisma";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../lib/jwt";
import { env } from "../config/env";
import { parseDurationToMs } from "../utils/duration";
import { sha256Hex } from "../utils/crypto";
import rateLimit from "express-rate-limit";

const deviceIdSchema = z.string().min(8).max(128);

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(6),
  deviceId: deviceIdSchema,
});

const registerSchema = z.object({
  fullName: z.string().min(2),
  email: z.email(),
  password: z.string().min(6),
  deviceId: deviceIdSchema,
});

const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

const logoutSchema = z.object({
  refreshToken: z.string().min(10),
});

const sanitizeUser = (user: {
  id: string;
  email: string;
  fullName: string;
  role: string;
  status: string;
}) => ({
  id: user.id,
  email: user.email,
  fullName: user.fullName,
  role: user.role,
  status: user.status,
});

const refreshTokenHash = (token: string) =>
  sha256Hex(`${env.refreshTokenPepper}:${token}`);

export const authRouter = express.Router();

authRouter.use(
  "/login",
  rateLimit({
    windowMs: 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

authRouter.post("/login", async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: "INVALID_PAYLOAD",
        message: "Invalid login payload.",
      });
    }

    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email },
    });
    if (!user) {
      return res.status(401).json({
        success: false,
        code: "INVALID_CREDENTIALS",
        message: "Invalid email or password.",
      });
    }
    if (user.status !== "active") {
      return res.status(403).json({
        success: false,
        code: "USER_BLOCKED",
        message: "User is blocked.",
      });
    }

    const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({
        success: false,
        code: "INVALID_CREDENTIALS",
        message: "Invalid email or password.",
      });
    }

    if (user.role === 'user') {
      if (!user.registeredDeviceId) {
        await prisma.user.update({
          where: { id: user.id },
          data: { registeredDeviceId: parsed.data.deviceId },
        })
      } else if (user.registeredDeviceId !== parsed.data.deviceId) {
        return res.status(403).json({
          success: false,
          code: 'DEVICE_MISMATCH',
          message: 'This account is bound to another device.',
        })
      }
    }

    const accessToken = signAccessToken({ sub: user.id, role: user.role });
    const refreshToken = signRefreshToken({ sub: user.id, role: user.role });

    const expiresAt = new Date(
      Date.now() + parseDurationToMs(env.jwt.refreshTtl),
    );
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refreshTokenHash(refreshToken),
        expiresAt,
      },
    });

    return res.json({
      success: true,
      accessToken,
      refreshToken,
      user: sanitizeUser(user),
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/register", async (req, res, next) => {
  try {
    if (!env.allowRegister) {
      return res.status(403).json({
        success: false,
        code: "FORBIDDEN",
        message: "Registration is disabled.",
      });
    }

    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: "INVALID_PAYLOAD",
        message: "Invalid registration payload.",
      });
    }

    const exists = await prisma.user.findUnique({
      where: { email: parsed.data.email },
    });
    if (exists) {
      return res.status(409).json({
        success: false,
        code: "EMAIL_EXISTS",
        message: "Email already exists.",
      });
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    const user = await prisma.user.create({
      data: {
        email: parsed.data.email,
        passwordHash,
        fullName: parsed.data.fullName,
        role: "user",
        status: "active",
        registeredDeviceId: parsed.data.deviceId,
      },
    });

    const accessToken = signAccessToken({ sub: user.id, role: user.role });
    const refreshToken = signRefreshToken({ sub: user.id, role: user.role });

    const expiresAt = new Date(
      Date.now() + parseDurationToMs(env.jwt.refreshTtl),
    );
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refreshTokenHash(refreshToken),
        expiresAt,
      },
    });

    return res.status(201).json({
      success: true,
      accessToken,
      refreshToken,
      user: sanitizeUser(user),
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/refresh", async (req, res, next) => {
  try {
    const parsed = refreshSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: "INVALID_PAYLOAD",
        message: "Invalid refresh payload.",
      });
    }

    const { refreshToken } = parsed.data;
    const payload = verifyRefreshToken(refreshToken);
    const hash = refreshTokenHash(refreshToken);

    const record = await prisma.refreshToken.findUnique({
      where: { tokenHash: hash },
    });
    if (!record || record.revokedAt) {
      return res.status(401).json({
        success: false,
        code: "UNAUTHORIZED",
        message: "Refresh token is invalid.",
      });
    }
    if (record.expiresAt.getTime() <= Date.now()) {
      return res.status(401).json({
        success: false,
        code: "UNAUTHORIZED",
        message: "Refresh token expired.",
      });
    }
    if (record.userId !== payload.sub) {
      return res.status(401).json({
        success: false,
        code: "UNAUTHORIZED",
        message: "Refresh token is invalid.",
      });
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.status !== "active") {
      return res.status(403).json({
        success: false,
        code: "USER_BLOCKED",
        message: "User is blocked.",
      });
    }

    // rotate
    await prisma.refreshToken.update({
      where: { tokenHash: hash },
      data: { revokedAt: new Date() },
    });

    const newAccessToken = signAccessToken({ sub: user.id, role: user.role });
    const newRefreshToken = signRefreshToken({ sub: user.id, role: user.role });
    const expiresAt = new Date(
      Date.now() + parseDurationToMs(env.jwt.refreshTtl),
    );
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refreshTokenHash(newRefreshToken),
        expiresAt,
      },
    });

    return res.json({
      success: true,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/logout", async (req, res, next) => {
  try {
    const parsed = logoutSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: "INVALID_PAYLOAD",
        message: "Invalid logout payload.",
      });
    }

    const hash = refreshTokenHash(parsed.data.refreshToken);
    await prisma.refreshToken.updateMany({
      where: { tokenHash: hash, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
});
