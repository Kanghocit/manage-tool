-- One open/waiting_admin support session per user (prevents duplicate conversations).
CREATE UNIQUE INDEX "SupportSession_userId_active_unique"
ON "SupportSession"("userId")
WHERE "status" IN ('open', 'waiting_admin');
