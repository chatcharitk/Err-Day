-- A coupon can be torn in the customer's app before the cashier rings up the bill.
ALTER TABLE "CouponRedemption" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'POS';
ALTER TABLE "CouponRedemption" ALTER COLUMN "bookingId" DROP NOT NULL;
