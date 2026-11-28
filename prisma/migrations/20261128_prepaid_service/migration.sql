-- Prepaid service tickets ("บัตรบริการล่วงหน้า") reuse CustomerPackage.
ALTER TABLE "CustomerPackage" ADD COLUMN "serviceId" TEXT;
ALTER TABLE "CustomerPackage" ADD COLUMN "label" TEXT;
