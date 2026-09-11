-- CreateEnum
CREATE TYPE "StudyWordStatus" AS ENUM ('new', 'learning', 'review', 'mastered');

-- CreateTable
CREATE TABLE "StudyWordList" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyWordList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyWord" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "pos" TEXT NOT NULL,
    "ipa" TEXT NOT NULL DEFAULT '',
    "definitionVi" TEXT NOT NULL,
    "definitionEn" TEXT NOT NULL,
    "examples" JSONB NOT NULL,
    "imageEmoji" TEXT NOT NULL DEFAULT '📖',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyWord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyUserWord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "pos" TEXT NOT NULL,
    "ipa" TEXT NOT NULL DEFAULT '',
    "definitionVi" TEXT NOT NULL,
    "definitionEn" TEXT NOT NULL,
    "examples" JSONB NOT NULL,
    "imageEmoji" TEXT NOT NULL DEFAULT '📖',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyUserWord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyListEnrollment" (
    "userId" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudyListEnrollment_pkey" PRIMARY KEY ("userId","listId")
);

-- CreateTable
CREATE TABLE "StudyWordProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "wordId" TEXT NOT NULL,
    "status" "StudyWordStatus" NOT NULL DEFAULT 'new',
    "intervalDays" INTEGER NOT NULL DEFAULT 0,
    "easiness" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "repetitions" INTEGER NOT NULL DEFAULT 0,
    "nextReviewAt" TIMESTAMP(3),
    "lastReviewedAt" TIMESTAMP(3),
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "wrongCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyWordProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyUserSettings" (
    "userId" TEXT NOT NULL,
    "dailyNewWords" INTEGER NOT NULL DEFAULT 30,
    "showAllLearned" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "StudyUserSettings_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "StudyDailyActivity" (
    "userId" TEXT NOT NULL,
    "activityDate" DATE NOT NULL,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "StudyDailyActivity_pkey" PRIMARY KEY ("userId","activityDate")
);

-- CreateTable
CREATE TABLE "StudyHiddenList" (
    "userId" TEXT NOT NULL,
    "listId" TEXT NOT NULL,

    CONSTRAINT "StudyHiddenList_pkey" PRIMARY KEY ("userId","listId")
);

-- CreateTable
CREATE TABLE "StudyHiddenWord" (
    "userId" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "wordId" TEXT NOT NULL,

    CONSTRAINT "StudyHiddenWord_pkey" PRIMARY KEY ("userId","listId","wordId")
);

-- CreateTable
CREATE TABLE "StudyWordOverride" (
    "userId" TEXT NOT NULL,
    "wordId" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "pos" TEXT NOT NULL,
    "ipa" TEXT NOT NULL DEFAULT '',
    "definitionVi" TEXT NOT NULL,
    "definitionEn" TEXT NOT NULL,
    "examples" JSONB NOT NULL,
    "imageEmoji" TEXT NOT NULL DEFAULT '📖',

    CONSTRAINT "StudyWordOverride_pkey" PRIMARY KEY ("userId","wordId")
);

-- CreateTable
CREATE TABLE "StudyListMetaOverride" (
    "userId" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,

    CONSTRAINT "StudyListMetaOverride_pkey" PRIMARY KEY ("userId","listId")
);

-- CreateIndex
CREATE INDEX "StudyWordList_userId_idx" ON "StudyWordList"("userId");

-- CreateIndex
CREATE INDEX "StudyWord_listId_sortOrder_idx" ON "StudyWord"("listId", "sortOrder");

-- CreateIndex
CREATE INDEX "StudyUserWord_userId_listId_idx" ON "StudyUserWord"("userId", "listId");

-- CreateIndex
CREATE INDEX "StudyWordProgress_userId_listId_idx" ON "StudyWordProgress"("userId", "listId");

-- CreateIndex
CREATE UNIQUE INDEX "StudyWordProgress_userId_listId_wordId_key" ON "StudyWordProgress"("userId", "listId", "wordId");

-- CreateIndex
CREATE INDEX "StudyDailyActivity_userId_activityDate_idx" ON "StudyDailyActivity"("userId", "activityDate");

-- CreateIndex
CREATE INDEX "StudyWordOverride_userId_listId_idx" ON "StudyWordOverride"("userId", "listId");

-- AddForeignKey
ALTER TABLE "StudyWordList" ADD CONSTRAINT "StudyWordList_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyWord" ADD CONSTRAINT "StudyWord_listId_fkey" FOREIGN KEY ("listId") REFERENCES "StudyWordList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyUserWord" ADD CONSTRAINT "StudyUserWord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyListEnrollment" ADD CONSTRAINT "StudyListEnrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyListEnrollment" ADD CONSTRAINT "StudyListEnrollment_listId_fkey" FOREIGN KEY ("listId") REFERENCES "StudyWordList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyWordProgress" ADD CONSTRAINT "StudyWordProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyUserSettings" ADD CONSTRAINT "StudyUserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyDailyActivity" ADD CONSTRAINT "StudyDailyActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyHiddenList" ADD CONSTRAINT "StudyHiddenList_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyHiddenWord" ADD CONSTRAINT "StudyHiddenWord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyWordOverride" ADD CONSTRAINT "StudyWordOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyListMetaOverride" ADD CONSTRAINT "StudyListMetaOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
