-- CreateEnum
CREATE TYPE "CaseStudySetStatus" AS ENUM ('draft', 'published');

-- CreateTable
CREATE TABLE "CaseStudySet" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" "CaseStudySetStatus" NOT NULL DEFAULT 'draft',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseStudySet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseStudyPassage" (
    "id" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "part" INTEGER NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "contentEn" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CaseStudyPassage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseStudyQuestion" (
    "id" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "passageId" TEXT,
    "part" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "stemEn" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "correctKey" TEXT NOT NULL,
    "explanationVi" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CaseStudyQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseStudyAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "currentIndex" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "answers" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseStudyAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CaseStudySet_status_idx" ON "CaseStudySet"("status");

-- CreateIndex
CREATE INDEX "CaseStudySet_createdById_idx" ON "CaseStudySet"("createdById");

-- CreateIndex
CREATE INDEX "CaseStudyPassage_setId_sortOrder_idx" ON "CaseStudyPassage"("setId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "CaseStudyQuestion_setId_number_key" ON "CaseStudyQuestion"("setId", "number");

-- CreateIndex
CREATE INDEX "CaseStudyQuestion_setId_sortOrder_idx" ON "CaseStudyQuestion"("setId", "sortOrder");

-- CreateIndex
CREATE INDEX "CaseStudyQuestion_passageId_idx" ON "CaseStudyQuestion"("passageId");

-- CreateIndex
CREATE UNIQUE INDEX "CaseStudyAttempt_userId_setId_key" ON "CaseStudyAttempt"("userId", "setId");

-- CreateIndex
CREATE INDEX "CaseStudyAttempt_userId_idx" ON "CaseStudyAttempt"("userId");

-- AddForeignKey
ALTER TABLE "CaseStudySet" ADD CONSTRAINT "CaseStudySet_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseStudyPassage" ADD CONSTRAINT "CaseStudyPassage_setId_fkey" FOREIGN KEY ("setId") REFERENCES "CaseStudySet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseStudyQuestion" ADD CONSTRAINT "CaseStudyQuestion_setId_fkey" FOREIGN KEY ("setId") REFERENCES "CaseStudySet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseStudyQuestion" ADD CONSTRAINT "CaseStudyQuestion_passageId_fkey" FOREIGN KEY ("passageId") REFERENCES "CaseStudyPassage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseStudyAttempt" ADD CONSTRAINT "CaseStudyAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseStudyAttempt" ADD CONSTRAINT "CaseStudyAttempt_setId_fkey" FOREIGN KEY ("setId") REFERENCES "CaseStudySet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
