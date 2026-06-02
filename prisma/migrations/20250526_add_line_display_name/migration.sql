-- Store the LINE profile display name separately from the customer's real name.
-- The customer's real name (and nickname) are now entered manually at registration
-- rather than being auto-populated from the LINE profile.
ALTER TABLE "Customer" ADD COLUMN "lineDisplayName" TEXT;
