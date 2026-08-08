CREATE TABLE "TarotUsage" (
    "id" TEXT NOT NULL,
    "lineUserId" TEXT NOT NULL,
    "usageDate" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TarotUsage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TarotUsage_lineUserId_usageDate_key"
ON "TarotUsage"("lineUserId", "usageDate");

CREATE INDEX "TarotUsage_updatedAt_idx" ON "TarotUsage"("updatedAt");
