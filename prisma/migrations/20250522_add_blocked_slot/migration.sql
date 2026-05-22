-- CreateTable: BlockedSlot
-- Admin-created time blocks to prevent customer bookings on specific windows.
-- staffId = NULL → whole branch blocked; non-null → that staff member only.

CREATE TABLE "BlockedSlot" (
    "id"        TEXT NOT NULL,
    "branchId"  TEXT NOT NULL,
    "staffId"   TEXT,
    "date"      TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime"   TEXT NOT NULL,
    "reason"    TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlockedSlot_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "BlockedSlot_branchId_date_idx" ON "BlockedSlot"("branchId", "date");
CREATE INDEX "BlockedSlot_staffId_date_idx"  ON "BlockedSlot"("staffId",  "date");

-- Foreign keys
ALTER TABLE "BlockedSlot" ADD CONSTRAINT "BlockedSlot_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BlockedSlot" ADD CONSTRAINT "BlockedSlot_staffId_fkey"
    FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
