-- CreateTable
CREATE TABLE "ClockPunch" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "kind" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClockPunch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClockPunch_staffId_date_idx" ON "ClockPunch"("staffId", "date");

-- CreateIndex
CREATE INDEX "ClockPunch_branchId_date_idx" ON "ClockPunch"("branchId", "date");
