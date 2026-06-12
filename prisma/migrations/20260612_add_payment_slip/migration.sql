-- CreateTable
CREATE TABLE "PaymentSlip" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "lineMessageId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "amount" INTEGER,
    "transferAt" TEXT,
    "bankName" TEXT,
    "senderName" TEXT,
    "ocrStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "bookingId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "confirmedBy" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentSlip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentSlip_lineMessageId_key" ON "PaymentSlip"("lineMessageId");

-- CreateIndex
CREATE INDEX "PaymentSlip_status_createdAt_idx" ON "PaymentSlip"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentSlip_branchId_status_idx" ON "PaymentSlip"("branchId", "status");

