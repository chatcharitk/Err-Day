-- Separate "service finished" (status COMPLETED / completedAt) from "payment
-- received" (paidAt). Staff finishing a service at the desk board no longer
-- implies the customer has paid — only admin flows set paidAt.
ALTER TABLE "Booking" ADD COLUMN "paidAt" TIMESTAMP(3);

-- Backfill: every booking COMPLETED before this split was checked out through
-- POS / slip confirmation (i.e. actually paid), so stamp them paid at their
-- completion time. Keeps all historical revenue reports byte-identical.
UPDATE "Booking"
SET "paidAt" = COALESCE("completedAt", "date")
WHERE "status" = 'COMPLETED';
