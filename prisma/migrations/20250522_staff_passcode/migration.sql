-- Staff self-service portal credentials.
-- Admin sets a 4-digit PIN per staff; bcrypt hash is stored here.

ALTER TABLE "Staff" ADD COLUMN "passcodeHash" TEXT;
ALTER TABLE "Staff" ADD COLUMN "lastLoginAt"  TIMESTAMP(3);
