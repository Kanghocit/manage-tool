-- CreateTable
CREATE TABLE "LicensePackage" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "baseAmountVnd" INTEGER NOT NULL,
    "labelKey" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LicensePackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LicensePackagePromotion" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "promoAmountVnd" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "label" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LicensePackagePromotion_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "PurchaseOrder" ADD COLUMN "originalAmountVnd" INTEGER,
ADD COLUMN "promotionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "LicensePackage_code_key" ON "LicensePackage"("code");

-- CreateIndex
CREATE INDEX "LicensePackagePromotion_packageId_idx" ON "LicensePackagePromotion"("packageId");

-- CreateIndex
CREATE INDEX "LicensePackagePromotion_startsAt_endsAt_idx" ON "LicensePackagePromotion"("startsAt", "endsAt");

-- AddForeignKey
ALTER TABLE "LicensePackagePromotion" ADD CONSTRAINT "LicensePackagePromotion_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "LicensePackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LicensePackagePromotion" ADD CONSTRAINT "LicensePackagePromotion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed default packages
INSERT INTO "LicensePackage" ("id", "code", "durationDays", "baseAmountVnd", "labelKey", "sortOrder", "isActive", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'PKG_1D', 1, 25000, 'PKG_1D', 1, true, NOW(), NOW()),
  (gen_random_uuid()::text, 'PKG_3M', 90, 1500000, 'PKG_3M', 2, true, NOW(), NOW()),
  (gen_random_uuid()::text, 'PKG_6M', 180, 2400000, 'PKG_6M', 3, true, NOW(), NOW()),
  (gen_random_uuid()::text, 'PKG_12M', 365, 4000000, 'PKG_12M', 4, true, NOW(), NOW()),
  (gen_random_uuid()::text, 'PKG_24M', 730, 6000000, 'PKG_24M', 5, true, NOW(), NOW())
ON CONFLICT ("code") DO NOTHING;
