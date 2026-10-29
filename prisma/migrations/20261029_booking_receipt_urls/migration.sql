-- Several payment-slip images per booking. `receiptUrl` stays as the first image
-- (older readers keep working); `receiptUrls` is the full list.
ALTER TABLE "Booking" ADD COLUMN "receiptUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
UPDATE "Booking" SET "receiptUrls" = ARRAY["receiptUrl"] WHERE "receiptUrl" IS NOT NULL;
