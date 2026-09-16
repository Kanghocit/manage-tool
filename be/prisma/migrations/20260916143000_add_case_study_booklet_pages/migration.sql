-- CreateTable
CREATE TABLE "CaseStudyBookletPage" (
    "id" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "pageIndex" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "questionFrom" INTEGER NOT NULL DEFAULT 0,
    "questionTo" INTEGER NOT NULL DEFAULT 0,
    "mimeType" TEXT NOT NULL DEFAULT 'image/jpeg',

    CONSTRAINT "CaseStudyBookletPage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CaseStudyBookletPage_setId_pageIndex_key" ON "CaseStudyBookletPage"("setId", "pageIndex");

-- CreateIndex
CREATE INDEX "CaseStudyBookletPage_setId_idx" ON "CaseStudyBookletPage"("setId");

-- AddForeignKey
ALTER TABLE "CaseStudyBookletPage" ADD CONSTRAINT "CaseStudyBookletPage_setId_fkey" FOREIGN KEY ("setId") REFERENCES "CaseStudySet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
