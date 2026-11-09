CREATE TABLE "GmailConnection" (
    "userId" TEXT PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "account" TEXT NOT NULL,
    "encryptedRefreshToken" TEXT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3)
);

CREATE TABLE "EmailUpdate" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "account" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "category" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'pending',
    "applicationId" TEXT REFERENCES "JobApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "EmailUpdate_userId_account_messageId_key"
    ON "EmailUpdate"("userId", "account", "messageId");
CREATE INDEX "EmailUpdate_userId_state_receivedAt_idx"
    ON "EmailUpdate"("userId", "state", "receivedAt");
