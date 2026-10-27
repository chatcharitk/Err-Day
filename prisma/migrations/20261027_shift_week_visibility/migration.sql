CREATE TABLE "ShiftWeekVisibility" (
  "weekStart" TEXT NOT NULL,
  "hidden" BOOLEAN NOT NULL DEFAULT false,
  "updatedBy" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShiftWeekVisibility_pkey" PRIMARY KEY ("weekStart")
);
