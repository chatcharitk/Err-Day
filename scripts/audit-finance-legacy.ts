/** Read-only checks. Never repairs or rewrites historical money. */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ quiet: true });
async function main() {
  const { prisma } = await import("../src/lib/prisma");
  try {
    const rows = await prisma.$queryRaw`
  SELECT
    (SELECT count(*)::int FROM "Expense") AS "expenseCount",
    (SELECT count(*)::int FROM "Expense" e WHERE EXISTS (SELECT 1 FROM "ExpenseItem" i WHERE i."expenseId"=e.id) AND e."totalAmount" <> (SELECT sum(i."totalPrice") FROM "ExpenseItem" i WHERE i."expenseId"=e.id)) AS "itemSumNeedsReview",
    (SELECT count(*)::int FROM "StaffDailyPayout" p WHERE p.status='PAID' AND p."expenseId" IS NULL) AS "paidWithoutExpenseLink",
    (SELECT count(*)::int FROM "StaffDailyPayout" p WHERE p."expenseId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Expense" e WHERE e.id=p."expenseId")) AS "danglingExpenseLinks",
    (SELECT count(*)::int FROM "StaffDailyPayout" p JOIN "Expense" d ON d.id=p."expenseId" AND d.status='CONFIRMED' WHERE EXISTS (SELECT 1 FROM "Expense" m WHERE m."branchId"=p."branchId" AND m.status='CONFIRMED' AND position('[PAYROLL:' || p."staffId" || ':' || to_char(p.date,'YYYY-MM') || ']' in m.notes)>0)) AS "dailyAlsoInMonthlyExpense",
    (SELECT count(*)::int FROM "Expense" WHERE "vendorId" IS NULL) AS "expensesWithoutPayeeLink",
    (SELECT count(*)::int FROM "Staff" WHERE "isActive" AND "baseSatang"=0 AND COALESCE("otRateSatang",0)=0) AS "activeStaffWithoutOtRate"
  `;
    console.log(JSON.stringify(rows, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}
main();
