-- Hot-path indexes for Booking + BookingAddon.
-- Without these, every booking query (calendar, mobile home, availability) was
-- a full table scan. Concurrent creation so production reads aren't blocked.

CREATE INDEX IF NOT EXISTS "Booking_branchId_date_idx"  ON "Booking" ("branchId", "date");
CREATE INDEX IF NOT EXISTS "Booking_customerId_idx"     ON "Booking" ("customerId");
CREATE INDEX IF NOT EXISTS "Booking_staffId_date_idx"   ON "Booking" ("staffId", "date");
CREATE INDEX IF NOT EXISTS "Booking_status_date_idx"    ON "Booking" ("status", "date");

CREATE INDEX IF NOT EXISTS "BookingAddon_bookingId_idx" ON "BookingAddon" ("bookingId");
