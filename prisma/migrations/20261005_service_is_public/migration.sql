-- Internal-only services: hidden from customer booking, still usable by staff.
ALTER TABLE "Service" ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT true;
