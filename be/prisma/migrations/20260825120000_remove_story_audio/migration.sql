-- Drop story/audio MVP tables and enums

DROP TABLE IF EXISTS "GeneratedAudio";
DROP TABLE IF EXISTS "AudioChunk";
DROP TABLE IF EXISTS "AudioJob";
DROP TABLE IF EXISTS "TextChunk";
DROP TABLE IF EXISTS "Chapter";
DROP TABLE IF EXISTS "Project";

DROP TYPE IF EXISTS "AudioChunkStatus";
DROP TYPE IF EXISTS "AudioJobStatus";
DROP TYPE IF EXISTS "ProjectStatus";
