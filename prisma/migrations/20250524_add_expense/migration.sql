-- Admin expense tracking. Two tables: Expense + ExpenseItem (line items).
-- branchId NULL = shared / HQ expense. Amounts in satang (THB * 100).

CREATE TABLE "Expense" (
    "id"            TEXT NOT NULL,
    "branchId"      TEXT,
    "category"      TEXT NOT NULL,
    "vendor"        TEXT,
    "date"          TIMESTAMP(3) NOT NULL,
    "totalAmount"   INTEGER NOT NULL,
    "vatAmount"     INTEGER,
    "paymentMethod" TEXT,
    "receiptUrl"    TEXT,
    "notes"         TEXT,
    "status"        TEXT NOT NULL DEFAULT 'CONFIRMED',
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Expense_branchId_date_idx" ON "Expense"("branchId", "date");
CREATE INDEX "Expense_category_date_idx" ON "Expense"("category", "date");
CREATE INDEX "Expense_date_idx"          ON "Expense"("date");

ALTER TABLE "Expense" ADD CONSTRAINT "Expense_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;


CREATE TABLE "ExpenseItem" (
    "id"          TEXT NOT NULL,
    "expenseId"   TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity"    DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unitPrice"   INTEGER NOT NULL,
    "totalPrice"  INTEGER NOT NULL,

    CONSTRAINT "ExpenseItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ExpenseItem_expenseId_idx" ON "ExpenseItem"("expenseId");

ALTER TABLE "ExpenseItem" ADD CONSTRAINT "ExpenseItem_expenseId_fkey"
    FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;
