-- Anyone with a LINE login can vote (not only people already in Customer).
-- One vote per LINE account per day replaces one per customer per day.
ALTER TABLE "StaffVote" ALTER COLUMN "customerId" DROP NOT NULL;
ALTER TABLE "StaffVote" ADD COLUMN "voterName" TEXT;

DROP INDEX "StaffVote_eventKey_customerId_voteDay_key";
CREATE UNIQUE INDEX "StaffVote_eventKey_lineUserId_voteDay_key" ON "StaffVote"("eventKey", "lineUserId", "voteDay");
