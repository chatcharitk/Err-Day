-- Store the commission used for each booking so payroll history is not changed
-- when service or add-on commission settings are edited later.
ALTER TABLE "Booking" ADD COLUMN "commissionSatang" INTEGER;
