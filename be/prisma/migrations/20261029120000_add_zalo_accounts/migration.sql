-- CreateEnum
CREATE TYPE "ZaloAccountStatus" AS ENUM ('active', 'disconnected', 'error');

-- CreateEnum
CREATE TYPE "ZaloGroupScanStatus" AS ENUM ('running', 'completed', 'failed');

-- CreateTable
CREATE TABLE "ZaloAccount" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "zaloUid" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatar" TEXT,
    "credentialsEnc" TEXT NOT NULL,
    "status" "ZaloAccountStatus" NOT NULL DEFAULT 'active',
    "lastActiveAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ZaloAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZaloGroupScan" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "groupName" TEXT,
    "memberCount" INTEGER NOT NULL DEFAULT 0,
    "status" "ZaloGroupScanStatus" NOT NULL DEFAULT 'running',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ZaloGroupScan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZaloGroupMember" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "displayName" TEXT,
    "zaloName" TEXT,
    "avatar" TEXT,
    "memberType" INTEGER,

    CONSTRAINT "ZaloGroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ZaloAccount_ownerUserId_idx" ON "ZaloAccount"("ownerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ZaloAccount_ownerUserId_zaloUid_key" ON "ZaloAccount"("ownerUserId", "zaloUid");

-- CreateIndex
CREATE INDEX "ZaloGroupScan_ownerUserId_createdAt_idx" ON "ZaloGroupScan"("ownerUserId", "createdAt");

-- CreateIndex
CREATE INDEX "ZaloGroupScan_accountId_idx" ON "ZaloGroupScan"("accountId");

-- CreateIndex
CREATE INDEX "ZaloGroupMember_scanId_idx" ON "ZaloGroupMember"("scanId");

-- CreateIndex
CREATE UNIQUE INDEX "ZaloGroupMember_scanId_uid_key" ON "ZaloGroupMember"("scanId", "uid");

-- AddForeignKey
ALTER TABLE "ZaloAccount" ADD CONSTRAINT "ZaloAccount_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZaloGroupScan" ADD CONSTRAINT "ZaloGroupScan_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ZaloAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZaloGroupScan" ADD CONSTRAINT "ZaloGroupScan_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZaloGroupMember" ADD CONSTRAINT "ZaloGroupMember_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "ZaloGroupScan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
