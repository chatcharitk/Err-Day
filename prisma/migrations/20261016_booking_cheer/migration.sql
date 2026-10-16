-- ค่าเชียร์: per-service upsell commission, credited to the staff who cheered it at checkout.
ALTER TABLE "Service" ADD COLUMN "cheerSatang" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "BookingCheer" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "amountSatang" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BookingCheer_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BookingCheer_bookingId_idx" ON "BookingCheer"("bookingId");
CREATE INDEX "BookingCheer_staffId_idx" ON "BookingCheer"("staffId");
ALTER TABLE "BookingCheer" ADD CONSTRAINT "BookingCheer_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookingCheer" ADD CONSTRAINT "BookingCheer_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BookingCheer" ADD CONSTRAINT "BookingCheer_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Rates given by the owner: Davines Spa ฿70, PJOLI Treatment ฿60.
UPDATE "Service" SET "cheerSatang" = 7000 WHERE "id" = 'svc-davines-spa';
UPDATE "Service" SET "cheerSatang" = 6000 WHERE "id" = 'svc-pjoli-treatment';
