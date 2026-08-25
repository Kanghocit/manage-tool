-- CreateEnum
CREATE TYPE "RegistrationSource" AS ENUM ('self', 'admin');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "registrationSource" "RegistrationSource" NOT NULL DEFAULT 'self';
ALTER TABLE "User" ADD COLUMN "createdByAdminId" TEXT;
ALTER TABLE "User" ADD COLUMN "welcomeTrialLicenseId" TEXT;
ALTER TABLE "User" ADD COLUMN "welcomeEmailSentAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "User_welcomeTrialLicenseId_key" ON "User"("welcomeTrialLicenseId");
CREATE INDEX "User_registrationSource_welcomeEmailSentAt_idx" ON "User"("registrationSource", "welcomeEmailSentAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_welcomeTrialLicenseId_fkey" FOREIGN KEY ("welcomeTrialLicenseId") REFERENCES "License"("id") ON DELETE SET NULL ON UPDATE CASCADE;
