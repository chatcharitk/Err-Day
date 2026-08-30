-- Split booking notes into customer-visible and staff-only copies.
-- Existing bookings start with identical values; future edits are independent.
ALTER TABLE "Booking" ADD COLUMN "internalNotes" TEXT;

UPDATE "Booking"
SET "internalNotes" = "notes"
WHERE "notes" IS NOT NULL;
