-- CreateEnum
CREATE TYPE "SupportSessionStatus" AS ENUM ('open', 'waiting_admin');

-- CreateEnum
CREATE TYPE "SupportMessageSender" AS ENUM ('user', 'bot', 'admin');

-- CreateTable
CREATE TABLE "SupportSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "SupportSessionStatus" NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "sender" "SupportMessageSender" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupportSession_userId_status_idx" ON "SupportSession"("userId", "status");

-- CreateIndex
CREATE INDEX "SupportSession_status_createdAt_idx" ON "SupportSession"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SupportMessage_sessionId_createdAt_idx" ON "SupportMessage"("sessionId", "createdAt");

-- AddForeignKey
ALTER TABLE "SupportSession" ADD CONSTRAINT "SupportSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "SupportSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
