-- Catch-up for the window between the paidAt column landing (05:53 UTC) and
-- this code deploying: sales checked out on the OLD code in that window are
-- COMPLETED with paidAt NULL even though they were genuinely paid.
--
-- Only stamp rows we can prove were paid — guarded by paidAt IS NULL so this
-- can never clobber a mark-paid/un-paid edit made through the new UI:
--   1. a receipt/slip is attached (receipt = payment evidence), or
--   2. a pure POS walk-in sale (synthetic pos-* customer phone; those are
--      created only at the moment of payment).
-- Desk-finished bookings without a receipt stay unpaid — that's correct.
UPDATE "Booking" b
SET "paidAt" = COALESCE(b."completedAt", b."date")
FROM "Customer" c
WHERE c."id" = b."customerId"
  AND b."status" = 'COMPLETED'
  AND b."paidAt" IS NULL
  AND (b."receiptUrl" IS NOT NULL OR c."phone" LIKE 'pos-%');
