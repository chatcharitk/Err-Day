-- CreateEnum
CREATE TYPE "StaffPayType" AS ENUM ('MONTHLY_SALARY', 'DAILY_WAGE');

-- CreateEnum
CREATE TYPE "PayCadence" AS ENUM ('MONTHLY', 'WEEKLY');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'PAID');

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "commissionSatang" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Staff" ADD COLUMN     "baseSatang" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "otRateSatang" INTEGER,
ADD COLUMN     "payCadence" "PayCadence" NOT NULL DEFAULT 'MONTHLY',
ADD COLUMN     "payType" "StaffPayType" NOT NULL DEFAULT 'MONTHLY_SALARY';

-- CreateTable
CREATE TABLE "StaffDailyPayout" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "otHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "worked" BOOLEAN NOT NULL DEFAULT true,
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "commissionSatang" INTEGER,
    "otSatang" INTEGER,
    "paidAt" TIMESTAMP(3),
    "paidBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffDailyPayout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffDailyPayout_branchId_date_idx" ON "StaffDailyPayout"("branchId", "date");

-- CreateIndex
CREATE INDEX "StaffDailyPayout_status_date_idx" ON "StaffDailyPayout"("status", "date");

-- CreateIndex
CREATE UNIQUE INDEX "StaffDailyPayout_staffId_date_key" ON "StaffDailyPayout"("staffId", "date");

-- AddForeignKey
ALTER TABLE "StaffDailyPayout" ADD CONSTRAINT "StaffDailyPayout_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

