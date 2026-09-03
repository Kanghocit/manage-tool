import type { Prisma } from "@prisma/client";

import { prisma } from "./prisma";

const activeSessionInclude = {
  messages: { orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.SupportSessionInclude;

const activeStatusFilter = {
  status: { in: ["open", "waiting_admin"] as ("open" | "waiting_admin")[] },
};

export async function findActiveSupportSession(userId: string) {
  return prisma.supportSession.findFirst({
    where: { userId, ...activeStatusFilter },
    orderBy: { updatedAt: "desc" },
    include: activeSessionInclude,
  });
}

export async function getOrCreateActiveSupportSession(userId: string) {
  const existing = await findActiveSupportSession(userId);
  if (existing) return existing;

  try {
    return await prisma.supportSession.create({
      data: { userId },
      include: activeSessionInclude,
    });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code !== "P2002") throw err;

    const raced = await findActiveSupportSession(userId);
    if (raced) return raced;
    throw err;
  }
}

export async function touchSupportSession(sessionId: string) {
  await prisma.supportSession.update({
    where: { id: sessionId },
    data: { updatedAt: new Date() },
  });
}
