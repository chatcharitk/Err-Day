-- Terms & conditions acceptance. All columns are nullable with no backfill:
-- rows created before this migration were never shown the terms, and stamping
-- them would fabricate consent that was never given.

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "termsAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "termsVersion" TEXT;

-- AlterTable
ALTER TABLE "Membership" ADD COLUMN     "termsAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "termsVersion" TEXT;

-- AlterTable
ALTER TABLE "CustomerPackage" ADD COLUMN     "termsAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "termsVersion" TEXT;

-- AlterEnum
-- Safe inside the migration's transaction on PG 12+ because the new value is
-- only added here, never written to in this same transaction.
ALTER TYPE "NotificationKind" ADD VALUE 'BOOKING_TERMS_REMINDER';
