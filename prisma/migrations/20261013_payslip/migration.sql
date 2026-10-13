-- Monthly pay slips (draft -> issued) for the staff portal. Additive: one new table.
CREATE TABLE "Payslip" (
    "id" TEXT NOT NULL,
    "personKey" TEXT NOT NULL,
    "staffIds" TEXT[],
    "month" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "taxId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "lines" JSONB NOT NULL,
    "grossSatang" INTEGER NOT NULL,
    "deductionSatang" INTEGER NOT NULL,
    "netSatang" INTEGER NOT NULL,
    "paidDailySatang" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "issuedAt" TIMESTAMP(3),
    "issuedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Payslip_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Payslip_personKey_month_key" ON "Payslip"("personKey", "month");
CREATE INDEX "Payslip_month_idx" ON "Payslip"("month");
