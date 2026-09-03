import { randomBytes } from "crypto";

import type { User } from "@prisma/client";

import { prisma } from "./prisma";
import { sha256Hex } from "../utils/crypto";

const HANDOFF_TTL_MS = 2 * 60 * 1000;

function hashHandoffCode(code: string) {
  return sha256Hex(code);
}

export async function createAuthHandoffCode(userId: string) {
  await prisma.authHandoffCode.deleteMany({
    where: {
      userId,
      OR: [{ expiresAt: { lt: new Date() } }, { usedAt: { not: null } }],
    },
  });

  const code = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + HANDOFF_TTL_MS);

  await prisma.authHandoffCode.create({
    data: {
      userId,
      codeHash: hashHandoffCode(code),
      expiresAt,
    },
  });

  return {
    code,
    expiresIn: Math.floor(HANDOFF_TTL_MS / 1000),
  };
}

export async function consumeAuthHandoffCode(code: string): Promise<User | null> {
  const trimmed = code.trim();
  if (!trimmed) return null;

  const record = await prisma.authHandoffCode.findUnique({
    where: { codeHash: hashHandoffCode(trimmed) },
    include: { user: true },
  });

  if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) {
    return null;
  }

  if (record.user.status !== "active") {
    return null;
  }

  const updated = await prisma.authHandoffCode.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  if (updated.count !== 1) {
    return null;
  }

  return record.user;
}
