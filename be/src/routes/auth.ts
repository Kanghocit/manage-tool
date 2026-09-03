import bcrypt from "bcrypt";
import express from "express";
import { z } from "zod";

import { prisma } from "../lib/prisma";
import { createUnusedLicense } from "../lib/createUnusedLicense";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  type JwtRole,
} from "../lib/jwt";
import { env } from "../config/env";
import { parseDurationToMs } from "../utils/duration";
import { sha256Hex } from "../utils/crypto";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../middleware/auth";
import {
  consumeAuthHandoffCode,
  createAuthHandoffCode,
} from "../lib/authHandoffService";

const deviceIdSchema = z.string().min(8).max(128);

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(6),
  deviceId: deviceIdSchema.optional(),
});

const registerSchema = z.object({
  fullName: z.string().min(2),
  email: z.email(),
  password: z.string().min(6),
  deviceId: deviceIdSchema.optional(),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

const logoutSchema = z.object({
  refreshToken: z.string().min(10),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(6),
  newPassword: z.string().min(6),
});

const handoffExchangeSchema = z.object({
  code: z.string().min(16).max(256),
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

async function issueUserSession(user: {
  id: string;
  email: string;
  fullName: string;
  role: JwtRole;
  status: string;
}) {
  const accessToken = signAccessToken({ sub: user.id, role: user.role });
  const refreshToken = signRefreshToken({ sub: user.id, role: user.role });
  const expiresAt = new Date(Date.now() + parseDurationToMs(env.jwt.refreshTtl));

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: refreshTokenHash(refreshToken),
      expiresAt,
    },
  });

  return {
    accessToken,
    refreshToken,
    user: sanitizeUser(user),
  };
}

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

    if (user.role === "user" && parsed.data.deviceId) {
      const deviceId = parsed.data.deviceId;
      if (!user.registeredDeviceId) {
        await prisma.user.updateMany({
          where: { id: user.id, registeredDeviceId: null },
          data: { registeredDeviceId: deviceId },
        });
        const refreshed = await prisma.user.findUnique({
          where: { id: user.id },
          select: { registeredDeviceId: true },
        });
        if (refreshed?.registeredDeviceId !== deviceId) {
          return res.status(403).json({
            success: false,
            code: "DEVICE_MISMATCH",
            message: "This account is bound to another device.",
          });
        }
      } else if (user.registeredDeviceId !== deviceId) {
        return res.status(403).json({
          success: false,
          code: "DEVICE_MISMATCH",
          message: "This account is bound to another device.",
        });
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

    const { user, accessToken, refreshToken } = await prisma.$transaction(
      async (tx) => {
        const createdUser = await tx.user.create({
          data: {
            email: parsed.data.email,
            passwordHash,
            fullName: parsed.data.fullName,
            role: "user",
            status: "active",
            registrationSource: "self",
          },
        });

        const trialLicense = await createUnusedLicense(tx, {
          durationDays: 1,
          maxDevices: 1,
          notes: "Welcome trial",
        });

        const updatedUser = await tx.user.update({
          where: { id: createdUser.id },
          data: { welcomeTrialLicenseId: trialLicense.id },
        });

        const accessToken = signAccessToken({
          sub: updatedUser.id,
          role: updatedUser.role,
        });
        const refreshToken = signRefreshToken({
          sub: updatedUser.id,
          role: updatedUser.role,
        });

        const expiresAt = new Date(
          Date.now() + parseDurationToMs(env.jwt.refreshTtl),
        );
        await tx.refreshToken.create({
          data: {
            userId: updatedUser.id,
            tokenHash: refreshTokenHash(refreshToken),
            expiresAt,
          },
        });

        return { user: updatedUser, accessToken, refreshToken };
      },
    );

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

authRouter.post("/change-password", requireAuth, async (req, res, next) => {
  try {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: "INVALID_PAYLOAD",
        message: "Invalid change password payload.",
      });
    }

    const userId = req.auth!.userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "User not found.",
      });
    }
    if (user.status !== "active") {
      return res.status(403).json({
        success: false,
        code: "USER_BLOCKED",
        message: "User is blocked.",
      });
    }

    const ok = await bcrypt.compare(
      parsed.data.currentPassword,
      user.passwordHash,
    );
    if (!ok) {
      return res.status(401).json({
        success: false,
        code: "INVALID_CREDENTIALS",
        message: "Current password is incorrect.",
      });
    }

    const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return res.json({ success: true, message: "Password changed." });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/handoff", requireAuth, async (req, res, next) => {
  try {
    const userId = req.auth!.userId;
    const redirect = typeof req.body?.redirect === "string" ? req.body.redirect : "/support";
    const safeRedirect =
      redirect.startsWith("/") && !redirect.startsWith("//") ? redirect : "/support";

    const handoff = await createAuthHandoffCode(userId);
    const base = env.appPublicUrl.replace(/\/$/, "");

    return res.json({
      success: true,
      code: handoff.code,
      expiresIn: handoff.expiresIn,
      redirect: safeRedirect,
      url: `${base}/auth/extension?code=${encodeURIComponent(handoff.code)}&redirect=${encodeURIComponent(safeRedirect)}`,
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post(
  "/handoff/exchange",
  rateLimit({
    windowMs: 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
  }),
  async (req, res, next) => {
    try {
      const parsed = handoffExchangeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          code: "INVALID_PAYLOAD",
          message: "Invalid handoff payload.",
        });
      }

      const user = await consumeAuthHandoffCode(parsed.data.code);
      if (!user) {
        return res.status(401).json({
          success: false,
          code: "HANDOFF_INVALID",
          message: "Handoff code is invalid or expired.",
        });
      }

      const session = await issueUserSession({
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        status: user.status,
      });
      return res.json({ success: true, ...session });
    } catch (err) {
      next(err);
    }
  },
);
