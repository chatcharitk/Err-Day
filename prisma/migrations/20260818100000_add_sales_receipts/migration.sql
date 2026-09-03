-- AlterTable
ALTER TABLE "Branch" ADD COLUMN     "taxBranchCode" TEXT;

-- CreateTable
CREATE TABLE "CompanyProfile" (
    "id" TEXT NOT NULL DEFAULT 'company',
    "legalName" TEXT NOT NULL DEFAULT '',
    "legalNameEn" TEXT,
    "taxId" TEXT NOT NULL DEFAULT '',
    "addressLine" TEXT NOT NULL DEFAULT '',
    "phone" TEXT,
    "vatRegistered" BOOLEAN NOT NULL DEFAULT false,
    "vatRatePercent" INTEGER NOT NULL DEFAULT 7,
    "receiptFooterTh" TEXT,
    "logoUrl" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceiptCounter" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "lastNumber" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ReceiptCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Receipt" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "bookingId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "customerId" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedByAdminId" TEXT,
    "issuedByName" TEXT,
    "sellerName" TEXT NOT NULL,
    "sellerTaxId" TEXT NOT NULL,
    "sellerAddress" TEXT NOT NULL,
    "sellerBranchCode" TEXT,
    "sellerPhone" TEXT,
    "buyerName" TEXT,
    "buyerTaxId" TEXT,
    "buyerAddress" TEXT,
    "grossSatang" INTEGER NOT NULL,
    "netSatang" INTEGER NOT NULL,
    "vatSatang" INTEGER NOT NULL,
    "vatRatePercent" INTEGER NOT NULL,
    "vatRegistered" BOOLEAN NOT NULL,
    "docType" TEXT NOT NULL DEFAULT 'RECEIPT',
    "paymentMethod" TEXT,
    "publicToken" TEXT NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "voidedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceiptItem" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unitPriceSatang" INTEGER NOT NULL,
    "totalSatang" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ReceiptItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_number_key" ON "Receipt"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_bookingId_key" ON "Receipt"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_publicToken_key" ON "Receipt"("publicToken");

-- CreateIndex
CREATE INDEX "Receipt_branchId_issuedAt_idx" ON "Receipt"("branchId", "issuedAt");

-- CreateIndex
CREATE INDEX "Receipt_issuedAt_idx" ON "Receipt"("issuedAt");

-- CreateIndex
CREATE INDEX "Receipt_sequence_idx" ON "Receipt"("sequence");

-- CreateIndex
CREATE INDEX "ReceiptItem_receiptId_idx" ON "ReceiptItem"("receiptId");

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptItem" ADD CONSTRAINT "ReceiptItem_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Seed the singleton rows so the app never has to branch on "does it exist yet".
-- Blank company details are fine: the settings screen fills them in, and receipts
-- stay non-VAT until vatRegistered is switched on.
INSERT INTO "CompanyProfile" ("id", "updatedAt") VALUES ('company', CURRENT_TIMESTAMP)
  ON CONFLICT ("id") DO NOTHING;

INSERT INTO "ReceiptCounter" ("id", "lastNumber") VALUES ('global', 0)
  ON CONFLICT ("id") DO NOTHING;
