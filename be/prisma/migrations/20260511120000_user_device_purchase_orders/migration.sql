-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('pending', 'paid', 'failed', 'expired');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "registeredDeviceId" TEXT;

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "packageCode" TEXT NOT NULL,
    "amountVnd" INTEGER NOT NULL,
    "transferContent" TEXT NOT NULL,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'pending',
    "sepayTransactionId" INTEGER,
    "fulfilledLicenseId" TEXT,
    "webhookPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_transferContent_key" ON "PurchaseOrder"("transferContent");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_sepayTransactionId_key" ON "PurchaseOrder"("sepayTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_fulfilledLicenseId_key" ON "PurchaseOrder"("fulfilledLicenseId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_userId_idx" ON "PurchaseOrder"("userId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_status_idx" ON "PurchaseOrder"("status");

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_fulfilledLicenseId_fkey" FOREIGN KEY ("fulfilledLicenseId") REFERENCES "License"("id") ON DELETE SET NULL ON UPDATE CASCADE;
