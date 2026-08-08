-- AlterTable
ALTER TABLE "Report" ADD COLUMN "aiRejectedReason" TEXT;
ALTER TABLE "Report" ADD COLUMN "aiVerified" BOOLEAN;
ALTER TABLE "Report" ADD COLUMN "boundingBox" TEXT;
ALTER TABLE "Report" ADD COLUMN "confidenceScore" REAL;
ALTER TABLE "Report" ADD COLUMN "detectedImageUrl" TEXT;
