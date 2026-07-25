/*
  Warnings:

  - You are about to drop the column `resumeUrl` on the `JobApplication` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `JobApplication` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "JobApplication" DROP COLUMN "resumeUrl",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "jobLink" TEXT,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "salary" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'Applied';
