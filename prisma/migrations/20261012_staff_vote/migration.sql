-- Staff-vote events (Halloween Staff Challenge 2026). Additive: two new tables.
CREATE TABLE "VoteCandidate" (
    "id" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "staffId" TEXT,
    "photoUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VoteCandidate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StaffVote" (
    "id" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "lineUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StaffVote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VoteCandidate_eventKey_sortOrder_idx" ON "VoteCandidate"("eventKey", "sortOrder");
CREATE UNIQUE INDEX "StaffVote_eventKey_customerId_key" ON "StaffVote"("eventKey", "customerId");
CREATE INDEX "StaffVote_eventKey_candidateId_idx" ON "StaffVote"("eventKey", "candidateId");

ALTER TABLE "StaffVote" ADD CONSTRAINT "StaffVote_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "VoteCandidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StaffVote" ADD CONSTRAINT "StaffVote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
