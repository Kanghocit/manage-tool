-- CreateEnum
CREATE TYPE "LicenseRequestStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "LicenseRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "durationDays" INTEGER NOT NULL DEFAULT 1,
    "note" TEXT,
    "status" "LicenseRequestStatus" NOT NULL DEFAULT 'pending',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectReason" TEXT,
    "fulfilledLicenseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LicenseRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LicenseRequest_fulfilledLicenseId_key" ON "LicenseRequest"("fulfilledLicenseId");

-- CreateIndex
CREATE INDEX "LicenseRequest_userId_idx" ON "LicenseRequest"("userId");

-- CreateIndex
CREATE INDEX "LicenseRequest_status_idx" ON "LicenseRequest"("status");

-- AddForeignKey
ALTER TABLE "LicenseRequest" ADD CONSTRAINT "LicenseRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LicenseRequest" ADD CONSTRAINT "LicenseRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LicenseRequest" ADD CONSTRAINT "LicenseRequest_fulfilledLicenseId_fkey" FOREIGN KEY ("fulfilledLicenseId") REFERENCES "License"("id") ON DELETE SET NULL ON UPDATE CASCADE;
