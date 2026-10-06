-- Booking-level tip (separate from the per-booking commission) and a travel
-- allowance on the daily staff payout. Additive, defaults keep old rows at 0.
ALTER TABLE "Booking" ADD COLUMN "tipSatang" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "StaffDailyPayout" ADD COLUMN "bookingTipSatang" INTEGER;
ALTER TABLE "StaffDailyPayout" ADD COLUMN "travelSatang" INTEGER NOT NULL DEFAULT 0;
