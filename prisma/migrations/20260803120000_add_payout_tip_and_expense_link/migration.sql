-- Daily payout: admin-entered tip amount + link to the Expense once recorded.
ALTER TABLE "StaffDailyPayout" ADD COLUMN "tipSatang" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "StaffDailyPayout" ADD COLUMN "expenseId" TEXT;
