-- Reusable vendor/supplier registry (searchable, so a recurring payee can be
-- looked up and reused instead of retyped) and multi-file expense attachments
-- (an expense can have several files — e.g. a receipt photo plus a transfer
-- slip). Expense.vendor (free text) and .receiptUrl (single file) are kept
-- as-is for backward compatibility; new writes populate vendorId/attachments
-- alongside them.

-- CreateTable
CREATE TABLE "Vendor" (
    "id"        TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "phone"     TEXT,
    "category"  TEXT,
    "notes"     TEXT,
    "isActive"  BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (trigram — fast ILIKE '%q%' search, same pattern as Customer)
CREATE INDEX "Vendor_name_trgm_idx" ON "Vendor" USING GIN ("name" gin_trgm_ops);

-- CreateTable
CREATE TABLE "ExpenseAttachment" (
    "id"        TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "url"       TEXT NOT NULL,
    "filename"  TEXT,
    "fileType"  TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpenseAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExpenseAttachment_expenseId_idx" ON "ExpenseAttachment"("expenseId");

-- AddForeignKey
ALTER TABLE "ExpenseAttachment" ADD CONSTRAINT "ExpenseAttachment_expenseId_fkey"
    FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN "vendorId" TEXT;

-- CreateIndex
CREATE INDEX "Expense_vendorId_idx" ON "Expense"("vendorId");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_vendorId_fkey"
    FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
