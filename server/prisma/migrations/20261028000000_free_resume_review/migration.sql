ALTER TABLE "JobApplication" ADD COLUMN IF NOT EXISTS "jobDescription" TEXT;
ALTER TABLE "Analysis" ALTER COLUMN "resumeId" DROP NOT NULL;
ALTER TABLE "Analysis" ADD COLUMN IF NOT EXISTS "applicationId" TEXT;
ALTER TABLE "Analysis" ADD COLUMN IF NOT EXISTS "status" TEXT;
ALTER TABLE "Analysis" ADD COLUMN IF NOT EXISTS "failureReason" TEXT;
UPDATE "Analysis" SET status = CASE WHEN result IS NULL THEN 'failed' ELSE 'completed' END WHERE status IS NULL;
ALTER TABLE "Analysis" ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE "Analysis" ALTER COLUMN status SET NOT NULL;
CREATE INDEX IF NOT EXISTS "Analysis_applicationId_idx" ON "Analysis"("applicationId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Analysis_applicationId_fkey') THEN
    ALTER TABLE "Analysis" ADD CONSTRAINT "Analysis_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "JobApplication"(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
