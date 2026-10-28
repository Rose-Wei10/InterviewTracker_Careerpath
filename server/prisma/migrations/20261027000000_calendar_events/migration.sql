-- Preserve the Interview table and its IDs while adding standalone calendar events.
ALTER TABLE "Interview" ADD COLUMN IF NOT EXISTS "userId" TEXT;
ALTER TABLE "Interview" ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'Interview';
ALTER TABLE "Interview" ADD COLUMN IF NOT EXISTS "allDay" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Interview" ADD COLUMN IF NOT EXISTS "reminderMinutes" INTEGER DEFAULT 1440;
UPDATE "Interview" AS i SET "userId" = a."userId", "reminderMinutes" = (
  SELECT GREATEST(0, ROUND(EXTRACT(EPOCH FROM (i."startsAt" - r."dueAt")) / 60))::integer
  FROM "Reminder" r WHERE r."interviewId" = i.id ORDER BY r."dueAt" DESC LIMIT 1
) FROM "JobApplication" a WHERE i."applicationId" = a.id AND i."userId" IS NULL;
ALTER TABLE "Interview" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "Interview" ALTER COLUMN "applicationId" DROP NOT NULL;
ALTER TABLE "Interview" ALTER COLUMN type SET DEFAULT 'other';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Interview_userId_fkey') THEN
    ALTER TABLE "Interview" ADD CONSTRAINT "Interview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "Interview_userId_startsAt_status_idx" ON "Interview"("userId", "startsAt", status);
DROP INDEX IF EXISTS "Interview_startsAt_status_idx";
INSERT INTO "Interview" (id,"userId","applicationId",category,title,"startsAt","timeZone",type,status,notes,"reminderMinutes")
SELECT 'legacy-follow-up:' || id,"userId",id,'Other','Application check-in',"followUpAt",'UTC','other','Scheduled','Converted from your saved follow-up date.',1440
FROM "JobApplication" WHERE "followUpAt" IS NOT NULL AND status NOT IN ('Offer','Reject','Ghosted')
ON CONFLICT (id) DO NOTHING;
UPDATE "Reminder" SET status = 'cancelled', "lockedUntil" = NULL
WHERE kind = 'follow-up' AND status IN ('pending','processing','failed','uncertain');
