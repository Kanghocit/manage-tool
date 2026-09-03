-- One-time codes for extension -> web auto-login handoff.
CREATE TABLE "AuthHandoffCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthHandoffCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AuthHandoffCode_codeHash_key" ON "AuthHandoffCode"("codeHash");
CREATE INDEX "AuthHandoffCode_userId_createdAt_idx" ON "AuthHandoffCode"("userId", "createdAt");
CREATE INDEX "AuthHandoffCode_expiresAt_idx" ON "AuthHandoffCode"("expiresAt");

ALTER TABLE "AuthHandoffCode" ADD CONSTRAINT "AuthHandoffCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
