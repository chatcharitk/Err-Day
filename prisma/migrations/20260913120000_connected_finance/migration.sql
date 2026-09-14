-- AlterTable
ALTER TABLE "Staff" ADD COLUMN     "normalWorkMinutes" INTEGER NOT NULL DEFAULT 540;

-- AlterTable
ALTER TABLE "StaffDailyPayout" ADD COLUMN     "adjustmentReason" TEXT,
ADD COLUMN     "adjustmentSatang" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "calculation" JSONB,
ADD COLUMN     "otMode" TEXT NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "revision" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "discountAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "documentDate" TIMESTAMP(3),
ADD COLUMN     "invoiceNumber" TEXT,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "payeeSnapshot" JSONB,
ADD COLUMN     "sourceKey" TEXT,
ADD COLUMN     "vatMode" TEXT NOT NULL DEFAULT 'LEGACY',
ADD COLUMN     "vatRate" DOUBLE PRECISION NOT NULL DEFAULT 7,
ADD COLUMN     "withholdingAmount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN     "address" TEXT,
ADD COLUMN     "bankAccount" TEXT,
ADD COLUMN     "bankAccountName" TEXT,
ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "legalName" TEXT,
ADD COLUMN     "staffId" TEXT,
ADD COLUMN     "taxBranch" TEXT,
ADD COLUMN     "taxId" TEXT,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'BUSINESS';

-- AlterTable
ALTER TABLE "ExpenseItem" ADD COLUMN     "kind" TEXT;

-- CreateTable
CREATE TABLE "StaffAttendance" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "clockIn" TIMESTAMP(3) NOT NULL,
    "clockOut" TIMESTAMP(3) NOT NULL,
    "breakMinutes" INTEGER NOT NULL DEFAULT 0,
    "confirmedBy" TEXT NOT NULL,
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceAudit" (
    "id" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffAttendance_date_idx" ON "StaffAttendance"("date");

-- CreateIndex
CREATE UNIQUE INDEX "StaffAttendance_staffId_date_key" ON "StaffAttendance"("staffId", "date");

-- CreateIndex
CREATE INDEX "FinanceAudit_entity_recordId_createdAt_idx" ON "FinanceAudit"("entity", "recordId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_sourceKey_key" ON "Expense"("sourceKey");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_staffId_key" ON "Vendor"("staffId");

-- AddForeignKey
ALTER TABLE "StaffAttendance" ADD CONSTRAINT "StaffAttendance_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Owner's confirmed exception; keyed by the verified staff ID, never by a fuzzy name.
UPDATE "Staff" SET "normalWorkMinutes" = 600 WHERE "id" = 'cmoe3m8pj00021oitx4lqk2zq';
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_normalWorkMinutes_check" CHECK ("normalWorkMinutes" BETWEEN 1 AND 1440);
ALTER TABLE "StaffAttendance" ADD CONSTRAINT "StaffAttendance_times_check" CHECK (
  "clockOut" > "clockIn" AND "clockOut" <= "clockIn" + INTERVAL '24 hours'
  AND "breakMinutes" >= 0 AND "breakMinutes" <= EXTRACT(EPOCH FROM ("clockOut" - "clockIn")) / 60
);
