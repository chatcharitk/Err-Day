-- 50 ทวิ certificates with a running number (เล่มที่ / เลขที่).
CREATE TABLE "WithholdingCertificate" (
    "id" TEXT NOT NULL,
    "bookNo" INTEGER NOT NULL,
    "runNo" INTEGER NOT NULL,
    "expenseId" TEXT,
    "vendorId" TEXT,
    "payeeName" TEXT NOT NULL,
    "payeeTaxId" TEXT NOT NULL,
    "paidDate" TIMESTAMP(3),
    "incomeSatang" INTEGER NOT NULL,
    "taxSatang" INTEGER NOT NULL,
    "formType" TEXT NOT NULL DEFAULT 'PND53',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WithholdingCertificate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WithholdingCertificate_expenseId_key" ON "WithholdingCertificate"("expenseId");
CREATE UNIQUE INDEX "WithholdingCertificate_bookNo_runNo_key" ON "WithholdingCertificate"("bookNo", "runNo");
CREATE INDEX "WithholdingCertificate_vendorId_idx" ON "WithholdingCertificate"("vendorId");
