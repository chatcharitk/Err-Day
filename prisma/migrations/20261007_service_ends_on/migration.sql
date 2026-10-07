-- Dedicated inclusive end date for time-limited services (availableFrom/To are time-of-day).
ALTER TABLE "Service" ADD COLUMN "endsOn" TEXT;
