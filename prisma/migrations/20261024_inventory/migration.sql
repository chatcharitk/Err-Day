CREATE TABLE "Product" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "brand" TEXT,
  "size" TEXT,
  "unit" TEXT NOT NULL DEFAULT 'ชิ้น',
  "packUnit" TEXT,
  "packSize" INTEGER NOT NULL DEFAULT 1,
  "costSatang" INTEGER,
  "usage" TEXT NOT NULL DEFAULT 'USE',
  "serviceId" TEXT,
  "minQty" INTEGER NOT NULL DEFAULT 0,
  "imageUrl" TEXT,
  "notes" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Product_serviceId_key" ON "Product"("serviceId");
CREATE INDEX "Product_isActive_name_idx" ON "Product"("isActive", "name");

CREATE TABLE "StockLevel" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "location" TEXT NOT NULL,
  "qty" INTEGER NOT NULL DEFAULT 0,
  "minQty" INTEGER,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StockLevel_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StockLevel_productId_location_key" ON "StockLevel"("productId", "location");
CREATE INDEX "StockLevel_location_idx" ON "StockLevel"("location");
ALTER TABLE "StockLevel" ADD CONSTRAINT "StockLevel_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "StockMovement" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "location" TEXT NOT NULL,
  "qty" INTEGER NOT NULL,
  "type" TEXT NOT NULL,
  "balance" INTEGER NOT NULL,
  "note" TEXT,
  "actorName" TEXT NOT NULL,
  "staffId" TEXT,
  "adminId" TEXT,
  "expenseId" TEXT,
  "receiptId" TEXT,
  "transferId" TEXT,
  "countId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StockMovement_productId_createdAt_idx" ON "StockMovement"("productId", "createdAt");
CREATE INDEX "StockMovement_location_createdAt_idx" ON "StockMovement"("location", "createdAt");
CREATE INDEX "StockMovement_type_createdAt_idx" ON "StockMovement"("type", "createdAt");
CREATE INDEX "StockMovement_receiptId_idx" ON "StockMovement"("receiptId");
CREATE INDEX "StockMovement_expenseId_idx" ON "StockMovement"("expenseId");
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "StockTransfer" (
  "id" TEXT NOT NULL,
  "fromLocation" TEXT NOT NULL,
  "toLocation" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'SENT',
  "note" TEXT,
  "sentBy" TEXT NOT NULL,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "receivedBy" TEXT,
  "receivedAt" TIMESTAMP(3),
  CONSTRAINT "StockTransfer_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StockTransfer_toLocation_status_idx" ON "StockTransfer"("toLocation", "status");
CREATE INDEX "StockTransfer_sentAt_idx" ON "StockTransfer"("sentAt");

CREATE TABLE "StockTransferItem" (
  "id" TEXT NOT NULL,
  "transferId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "qtySent" INTEGER NOT NULL,
  "qtyReceived" INTEGER,
  CONSTRAINT "StockTransferItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StockTransferItem_transferId_idx" ON "StockTransferItem"("transferId");
ALTER TABLE "StockTransferItem" ADD CONSTRAINT "StockTransferItem_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "StockTransfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "StockCount" (
  "id" TEXT NOT NULL,
  "location" TEXT NOT NULL,
  "countedBy" TEXT NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockCount_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StockCount_location_createdAt_idx" ON "StockCount"("location", "createdAt");

CREATE TABLE "StockCountLine" (
  "id" TEXT NOT NULL,
  "countId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "expected" INTEGER NOT NULL,
  "counted" INTEGER NOT NULL,
  CONSTRAINT "StockCountLine_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StockCountLine_countId_idx" ON "StockCountLine"("countId");
CREATE INDEX "StockCountLine_productId_idx" ON "StockCountLine"("productId");
ALTER TABLE "StockCountLine" ADD CONSTRAINT "StockCountLine_countId_fkey" FOREIGN KEY ("countId") REFERENCES "StockCount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
