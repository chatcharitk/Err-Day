-- One vote per customer per DAY (was one per event).
ALTER TABLE "StaffVote" ADD COLUMN "voteDay" TEXT;
UPDATE "StaffVote" SET "voteDay" = to_char("createdAt" + interval '7 hours', 'YYYY-MM-DD') WHERE "voteDay" IS NULL;
ALTER TABLE "StaffVote" ALTER COLUMN "voteDay" SET NOT NULL;

DROP INDEX "StaffVote_eventKey_customerId_key";
CREATE UNIQUE INDEX "StaffVote_eventKey_customerId_voteDay_key" ON "StaffVote"("eventKey", "customerId", "voteDay");
