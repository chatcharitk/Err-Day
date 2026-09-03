-- Receipt.bookingId stops being globally unique so a stale receipt can be
-- voided and immediately replaced by a corrected one on the same booking
-- (POS finalizing a sale that an earlier, less-authoritative event — e.g. an
-- admin "mark paid" toggle with no item/discount detail — had already
-- receipted at the wrong total).
DROP INDEX "Receipt_bookingId_key";

CREATE INDEX "Receipt_bookingId_idx" ON "Receipt"("bookingId");

-- Partial unique index: at most one ACTIVE (non-voided) receipt per booking,
-- enforced at the DB level regardless of what application code does.
CREATE UNIQUE INDEX "Receipt_bookingId_active_key"
  ON "Receipt"("bookingId")
  WHERE "voidedAt" IS NULL;
