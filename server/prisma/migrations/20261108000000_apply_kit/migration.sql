CREATE TABLE "ApplyKitEntry" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "starterKey" TEXT,
  "category" TEXT NOT NULL,
  "prompt" TEXT NOT NULL,
  "answer" TEXT NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "ApplyKitEntry_userId_starterKey_key" ON "ApplyKitEntry"("userId", "starterKey");
