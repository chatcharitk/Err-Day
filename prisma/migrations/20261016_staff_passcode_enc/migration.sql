-- Admin-viewable copy of the staff portal PIN (encrypted; login still uses the hash).
ALTER TABLE "Staff" ADD COLUMN "passcodeEnc" TEXT;
