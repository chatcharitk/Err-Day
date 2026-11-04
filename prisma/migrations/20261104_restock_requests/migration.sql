-- Restock checklist: staff tell the owner what a branch needs brought over.
CREATE TABLE "RestockRequest" (
  "id" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "items" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "extras" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "note" TEXT,
  "requestedBy" TEXT NOT NULL,
  "staffId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "doneAt" TIMESTAMP(3),
  "doneBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RestockRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RestockRequest_status_createdAt_idx" ON "RestockRequest"("status", "createdAt");
CREATE INDEX "RestockRequest_branchId_createdAt_idx" ON "RestockRequest"("branchId", "createdAt");
