-- Add BookingStaff junction table for multi-staff support on a single booking.
-- The primary staffId on Booking remains the lead stylist; extra staff go here.

CREATE TABLE "BookingStaff" (
    "id"        TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "staffId"   TEXT NOT NULL,
    CONSTRAINT "BookingStaff_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BookingStaff_bookingId_staffId_key" ON "BookingStaff"("bookingId", "staffId");
CREATE INDEX "BookingStaff_bookingId_idx" ON "BookingStaff"("bookingId");

ALTER TABLE "BookingStaff"
    ADD CONSTRAINT "BookingStaff_bookingId_fkey"
    FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BookingStaff"
    ADD CONSTRAINT "BookingStaff_staffId_fkey"
    FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
