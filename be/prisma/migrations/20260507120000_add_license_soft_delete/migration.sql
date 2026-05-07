-- AlterTable
ALTER TABLE "License"
ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "deletedById" TEXT;

-- CreateIndex
CREATE INDEX "License_deletedAt_idx" ON "License"("deletedAt");

-- AddForeignKey
ALTER TABLE "License"
ADD CONSTRAINT "License_deletedById_fkey"
FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
