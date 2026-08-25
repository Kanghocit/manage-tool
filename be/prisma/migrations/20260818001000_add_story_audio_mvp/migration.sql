CREATE TYPE "ProjectStatus" AS ENUM ('imported', 'processing', 'completed', 'failed');
CREATE TYPE "AudioJobStatus" AS ENUM ('queued', 'fetching', 'processing_text', 'generating_audio', 'merging_audio', 'completed', 'failed');
CREATE TYPE "AudioChunkStatus" AS ENUM ('pending', 'processing', 'completed', 'failed');

CREATE TABLE "Project" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "author" TEXT,
  "content" TEXT NOT NULL,
  "chapterCount" INTEGER NOT NULL DEFAULT 1,
  "totalChars" INTEGER NOT NULL,
  "status" "ProjectStatus" NOT NULL DEFAULT 'imported',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Chapter" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "index" INTEGER NOT NULL,
  "title" TEXT,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Chapter_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TextChunk" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "index" INTEGER NOT NULL,
  "text" TEXT NOT NULL,
  "charCount" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TextChunk_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AudioJob" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "status" "AudioJobStatus" NOT NULL DEFAULT 'queued',
  "progress" INTEGER NOT NULL DEFAULT 0,
  "totalChunks" INTEGER NOT NULL DEFAULT 0,
  "completedChunks" INTEGER NOT NULL DEFAULT 0,
  "voiceId" TEXT NOT NULL,
  "speed" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "format" TEXT NOT NULL DEFAULT 'mp3',
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "AudioJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AudioChunk" (
  "id" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "textChunkId" TEXT NOT NULL,
  "index" INTEGER NOT NULL,
  "text" TEXT NOT NULL,
  "status" "AudioChunkStatus" NOT NULL DEFAULT 'pending',
  "audioUrl" TEXT,
  "duration" DOUBLE PRECISION,
  "error" TEXT,
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AudioChunk_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GeneratedAudio" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "audioUrl" TEXT NOT NULL,
  "duration" DOUBLE PRECISION NOT NULL,
  "format" TEXT NOT NULL DEFAULT 'mp3',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GeneratedAudio_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Chapter_projectId_index_key" ON "Chapter"("projectId", "index");
CREATE UNIQUE INDEX "TextChunk_projectId_index_key" ON "TextChunk"("projectId", "index");
CREATE UNIQUE INDEX "AudioChunk_jobId_index_key" ON "AudioChunk"("jobId", "index");
CREATE UNIQUE INDEX "GeneratedAudio_jobId_key" ON "GeneratedAudio"("jobId");
CREATE INDEX "Project_userId_createdAt_idx" ON "Project"("userId", "createdAt");
CREATE INDEX "Project_status_idx" ON "Project"("status");
CREATE INDEX "TextChunk_projectId_idx" ON "TextChunk"("projectId");
CREATE INDEX "AudioJob_projectId_createdAt_idx" ON "AudioJob"("projectId", "createdAt");
CREATE INDEX "AudioJob_status_idx" ON "AudioJob"("status");
CREATE INDEX "AudioChunk_jobId_status_idx" ON "AudioChunk"("jobId", "status");
CREATE INDEX "GeneratedAudio_projectId_idx" ON "GeneratedAudio"("projectId");

ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Chapter" ADD CONSTRAINT "Chapter_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TextChunk" ADD CONSTRAINT "TextChunk_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AudioJob" ADD CONSTRAINT "AudioJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AudioChunk" ADD CONSTRAINT "AudioChunk_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "AudioJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AudioChunk" ADD CONSTRAINT "AudioChunk_textChunkId_fkey" FOREIGN KEY ("textChunkId") REFERENCES "TextChunk"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GeneratedAudio" ADD CONSTRAINT "GeneratedAudio_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GeneratedAudio" ADD CONSTRAINT "GeneratedAudio_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "AudioJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
