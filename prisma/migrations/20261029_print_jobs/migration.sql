-- Shop receipt printers (XP-C300H over WiFi). A small helper program on each
-- branch's iMac claims PENDING jobs and sends them to the printer.
ALTER TABLE "Branch" ADD COLUMN "printAgentKeyHash" TEXT;
ALTER TABLE "Branch" ADD COLUMN "printAgentSeenAt" TIMESTAMP(3);

CREATE TABLE "PrintJob" (
  "id" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "receiptId" TEXT,
  "kind" TEXT NOT NULL DEFAULT 'RECEIPT',
  "lang" TEXT NOT NULL DEFAULT 'th',
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "error" TEXT,
  "requestedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "claimedAt" TIMESTAMP(3),
  "printedAt" TIMESTAMP(3),
  CONSTRAINT "PrintJob_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PrintJob_branchId_status_createdAt_idx" ON "PrintJob"("branchId", "status", "createdAt");
