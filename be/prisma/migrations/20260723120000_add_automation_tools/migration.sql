-- CreateEnum
CREATE TYPE "AutomationRunStatus" AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "AutomationSessionStatus" AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');

-- CreateTable
CREATE TABLE "AutomationTool" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "steps" JSONB NOT NULL,
    "defaultLoopCount" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationTool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrowserProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userAgent" TEXT,
    "proxyUrl" TEXT,
    "viewportWidth" INTEGER,
    "viewportHeight" INTEGER,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrowserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationRun" (
    "id" TEXT NOT NULL,
    "toolId" TEXT NOT NULL,
    "loopCount" INTEGER NOT NULL,
    "status" "AutomationRunStatus" NOT NULL DEFAULT 'pending',
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationRunSession" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "status" "AutomationSessionStatus" NOT NULL DEFAULT 'pending',
    "currentLoop" INTEGER NOT NULL DEFAULT 0,
    "log" TEXT NOT NULL DEFAULT '',
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationRunSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AutomationTool_createdById_idx" ON "AutomationTool"("createdById");

-- CreateIndex
CREATE INDEX "AutomationTool_deletedAt_idx" ON "AutomationTool"("deletedAt");

-- CreateIndex
CREATE INDEX "BrowserProfile_createdById_idx" ON "BrowserProfile"("createdById");

-- CreateIndex
CREATE INDEX "AutomationRun_toolId_idx" ON "AutomationRun"("toolId");

-- CreateIndex
CREATE INDEX "AutomationRun_status_idx" ON "AutomationRun"("status");

-- CreateIndex
CREATE INDEX "AutomationRun_createdById_idx" ON "AutomationRun"("createdById");

-- CreateIndex
CREATE INDEX "AutomationRunSession_runId_idx" ON "AutomationRunSession"("runId");

-- CreateIndex
CREATE INDEX "AutomationRunSession_profileId_idx" ON "AutomationRunSession"("profileId");

-- AddForeignKey
ALTER TABLE "AutomationTool" ADD CONSTRAINT "AutomationTool_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrowserProfile" ADD CONSTRAINT "BrowserProfile_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRun" ADD CONSTRAINT "AutomationRun_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "AutomationTool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRun" ADD CONSTRAINT "AutomationRun_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRunSession" ADD CONSTRAINT "AutomationRunSession_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AutomationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRunSession" ADD CONSTRAINT "AutomationRunSession_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "BrowserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
