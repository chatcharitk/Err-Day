import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { seedFinanceFixtures } from "./finance-fixtures";
import type { StaffPayoutRow } from "../src/lib/payroll";
const origin = process.env.FINANCE_TEST_ORIGIN || "http://127.0.0.1:3087";
if (!["127.0.0.1", "localhost"].includes(new URL(origin).hostname))
  throw new Error("HTTP integration tests only run locally");
async function login(username: string) {
  const r = await fetch(origin + "/api/admin/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password: "local-finance-test-only" }),
  });
  assert.equal(r.status, 200, await r.text());
  return r.headers.get("set-cookie")!.split(";")[0];
}
async function main() {
  const { branchId, date } = await seedFinanceFixtures();
  await prisma.staffDailyPayout.deleteMany({ where: { branchId } });
  await prisma.staffAttendance.deleteMany({ where: { staff: { branchId } } });
  await prisma.expense.deleteMany({ where: { branchId } });
  await prisma.vendor.updateMany({
    where: { name: "ร้านทดสอบ" },
    data: { legalName: null, taxId: null, address: null },
  });
  await prisma.booking.update({
    where: { id: "finance-booking-1" },
    data: { commissionSatang: 20000 },
  });
  const owner = await login("finance-owner"),
    admin = await login("finance-admin");
  async function api(
    path: string,
    method = "GET",
    body?: unknown,
    cookie = owner,
  ) {
    const res = await fetch(origin + path, {
      method,
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const text = await res.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { error: text };
    }
    return { status: res.status, body: parsed };
  }
  const rows = async (): Promise<StaffPayoutRow[]> => {
    const r = await api(`/api/admin/payroll?branchId=${branchId}&date=${date}`);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return r.body.rows;
  };
  assert.equal(
    (
      await api(
        `/api/admin/payroll?branchId=${branchId}&date=${date}`,
        "GET",
        undefined,
        admin,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await api("/api/admin/payroll/monthly", "POST", {
        branchId,
        month: "2026-09",
        staffId: "finance-normal",
      })
    ).status,
    410,
  );
  assert.equal(
    (await api("/api/admin/vendors?manage=1", "GET", undefined, admin)).status,
    403,
  );
  let normal = (await rows()).find((r) => r.staffId === "finance-normal")!;
  assert.equal(normal.commissionSatang, 35000);
  assert.equal(normal.workedMinutes, null);
  assert.equal(normal.otHours, 0);
  const payload = {
    staffId: normal.staffId,
    date,
    sourceToken: normal.sourceToken,
    action: "settle",
    clockIn: date + "T10:00:00+07:00",
    clockOut: date + "T20:30:00+07:00",
    breakMinutes: 0,
    attendanceNotes: "ยืนยันจากบันทึกทดสอบ",
    otMode: "AUTO",
    otHours: 0,
    tipSatang: 2000,
    adjustmentSatang: -1000,
    adjustmentReason: "ทดสอบปรับยอด",
    paymentMethod: "CASH",
  };
  const settled = await Promise.all([
    api("/api/admin/payroll", "PATCH", payload),
    api("/api/admin/payroll", "PATCH", payload),
  ]);
  assert.ok(
    settled.some((r) => r.status === 200),
    JSON.stringify(settled),
  );
  assert.ok(
    settled.every((r) => [200, 409].includes(r.status)),
    JSON.stringify(settled),
  );
  normal = (await rows()).find((r) => r.staffId === normal.staffId)!;
  assert.equal(normal.totalSatang, 51000);
  assert.equal(normal.otHours, 1.5);
  assert.equal(normal.status, "PAID");
  assert.equal(normal.changedSincePaid, false);
  const expense = await prisma.expense.findUniqueOrThrow({
    where: { id: normal.expenseId! },
  });
  assert.equal(expense.totalAmount, normal.totalSatang);
  assert.equal(expense.vendorId != null, true);
  assert.equal(
    await prisma.expense.count({
      where: {
        sourceKey: { startsWith: `PAYROLL:${normal.staffId}:${date}:` },
        status: "CONFIRMED",
      },
    }),
    1,
  );
  assert.equal((await api("/api/admin/payroll", "PATCH", payload)).status, 200);
  assert.equal(
    (
      await api(`/api/admin/expenses/${normal.expenseId}`, "PATCH", {
        items: [],
        totalAmount: 1,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await api(`/api/admin/expenses/${normal.expenseId}`, "DELETE", {
        reason: "invalid bypass",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await api("/api/admin/payroll", "PATCH", {
        ...payload,
        action: "save",
        sourceToken: normal.sourceToken,
      })
    ).status,
    400,
  );
  await prisma.booking.update({
    where: { id: "finance-booking-1" },
    data: { commissionSatang: 21000 },
  });
  normal = (await rows()).find((r) => r.staffId === normal.staffId)!;
  assert.equal(normal.totalSatang, 51000);
  assert.equal(normal.changedSincePaid, true);
  const reopen = await api("/api/admin/payroll", "PATCH", {
    staffId: normal.staffId,
    date,
    sourceToken: normal.sourceToken,
    action: "reopen",
    reason: "ทดสอบแก้ค่ามือ",
  });
  assert.equal(reopen.status, 200, JSON.stringify(reopen.body));
  assert.equal(
    (await prisma.expense.findUniqueOrThrow({ where: { id: expense.id } }))
      .status,
    "VOIDED",
  );
  normal = (await rows()).find((r) => r.staffId === normal.staffId)!;
  assert.equal(
    (
      await api("/api/admin/payroll", "PATCH", {
        ...payload,
        sourceToken: normal.sourceToken,
      })
    ).status,
    200,
  );
  normal = (await rows()).find((r) => r.staffId === normal.staffId)!;
  assert.equal(normal.totalSatang, 52000);
  let porn = (await rows()).find((r) => r.staffId === "finance-porn")!;
  const pornPayload = {
    ...payload,
    staffId: porn.staffId,
    sourceToken: porn.sourceToken,
    clockOut: date + "T20:00:00+07:00",
    tipSatang: 0,
    adjustmentSatang: 0,
    adjustmentReason: "",
  };
  assert.equal(
    (await api("/api/admin/payroll", "PATCH", pornPayload)).status,
    200,
  );
  porn = (await rows()).find((r) => r.staffId === porn.staffId)!;
  assert.equal(porn.otHours, 0);
  assert.equal(porn.totalSatang, 20000);
  assert.equal(porn.changedSincePaid, false);
  // Old paid records must retain their money and unknown paid date when first linked to an expense.
  await prisma.staffDailyPayout.create({
    data: {
      staffId: "finance-normal",
      branchId,
      date: new Date("2026-09-09T12:00:00Z"),
      status: "PAID",
      commissionSatang: 12345,
      otSatang: 5000,
      tipSatang: 700,
      otHours: 0.5,
    },
  });
  const legacy = (
    await api(`/api/admin/payroll?branchId=${branchId}&date=2026-09-09`)
  ).body.rows.find((r: StaffPayoutRow) => r.staffId === "finance-normal");
  const legacySettle = await api("/api/admin/payroll", "PATCH", {
    staffId: legacy.staffId,
    date: "2026-09-09",
    sourceToken: legacy.sourceToken,
    action: "settle",
    paymentMethod: "CASH",
  });
  assert.equal(legacySettle.status, 200, JSON.stringify(legacySettle.body));
  const legacyExpense = await prisma.expense.findUniqueOrThrow({
    where: { id: legacySettle.body.expenseId },
  });
  assert.equal(legacyExpense.totalAmount, 18045);
  assert.equal(legacyExpense.paidAt, null);
  // A deleted legacy expense link can be repaired from the saved payout, without recalculating its money.
  await prisma.staffDailyPayout.create({
    data: {
      staffId: "finance-porn",
      branchId,
      date: new Date("2026-09-09T12:00:00Z"),
      status: "PAID",
      commissionSatang: 1000,
      otSatang: 0,
      expenseId: "finance-missing-old-expense",
    },
  });
  const dangling = (
    await api(`/api/admin/payroll?branchId=${branchId}&date=2026-09-09`)
  ).body.rows.find((r: StaffPayoutRow) => r.staffId === "finance-porn");
  assert.equal(dangling.expenseId, null);
  const repaired = await api("/api/admin/payroll", "PATCH", {
    staffId: dangling.staffId,
    date: "2026-09-09",
    sourceToken: dangling.sourceToken,
    action: "settle",
    paymentMethod: "CASH",
  });
  assert.equal(repaired.status, 200, JSON.stringify(repaired.body));
  assert.notEqual(repaired.body.expenseId, "finance-missing-old-expense");
  // A changed source requires a fresh review, and a failed settlement must roll back attendance too.
  let stale = (
    await api(`/api/admin/payroll?branchId=${branchId}&date=2026-09-08`)
  ).body.rows.find((r: StaffPayoutRow) => r.staffId === "finance-normal");
  await prisma.staff.update({
    where: { id: "finance-normal" },
    data: { normalWorkMinutes: 541 },
  });
  assert.equal(
    (
      await api("/api/admin/payroll", "PATCH", {
        ...payload,
        date: "2026-09-08",
        sourceToken: stale.sourceToken,
      })
    ).status,
    409,
  );
  await prisma.staff.update({
    where: { id: "finance-normal" },
    data: { normalWorkMinutes: 540 },
  });
  stale = (
    await api(`/api/admin/payroll?branchId=${branchId}&date=2026-09-08`)
  ).body.rows.find((r: StaffPayoutRow) => r.staffId === "finance-normal");
  const rollback = await api("/api/admin/payroll", "PATCH", {
    ...payload,
    date: "2026-09-08",
    sourceToken: stale.sourceToken,
    clockIn: "2026-09-08T10:00:00+07:00",
    clockOut: "2026-09-08T20:30:00+07:00",
    paymentMethod: "INVALID",
  });
  assert.equal(rollback.status, 400);
  assert.equal(
    await prisma.staffAttendance.count({
      where: { date: new Date("2026-09-08T12:00:00Z") },
    }),
    0,
  );
  // Historical monthly expense blocks re-recording the same days.
  await prisma.expense.create({
    data: {
      id: "finance-legacy-month",
      branchId,
      category: "commission_bonus",
      date: new Date("2026-09-01T12:00:00Z"),
      totalAmount: 1,
      notes: "[PAYROLL:finance-normal:2026-09]",
    },
  });
  assert.equal(
    (
      await api("/api/admin/payroll", "PATCH", {
        ...payload,
        date: "2026-09-08",
        sourceToken: stale.sourceToken,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await api("/api/admin/expenses/finance-legacy-month", "DELETE", {
        reason: "duplicate historical summary",
      })
    ).status,
    200,
  );
  const month = await api(
    `/api/admin/payroll/monthly?branchId=${branchId}&month=2026-09`,
  );
  assert.equal(
    month.body.rows.find(
      (r: { staffId: string }) => r.staffId === normal.staffId,
    ).tipSatang,
    2700,
  );
  const body = {
    branchId,
    category: "shampoo",
    vendor: "ร้านทดสอบ",
    date,
    items: [
      { description: "แชมพู", quantity: 3, unitPrice: 12000, totalPrice: 1 },
      { description: "สี", quantity: 2, unitPrice: 25000, totalPrice: 1 },
    ],
    vatMode: "EXCLUSIVE",
    vatRate: 7,
    discountAmount: 6000,
    withholdingAmount: 2400,
    totalAmount: 85600,
    paidDate: date,
    paymentMethod: "TRANSFER",
    status: "CONFIRMED",
    attachments: [],
  };
  const bad = await api("/api/admin/expenses", "POST", {
    ...body,
    totalAmount: 1,
  });
  assert.equal(bad.status, 400);
  const created = await api("/api/admin/expenses", "POST", body);
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.equal(created.body.expense.totalAmount, 85600);
  assert.equal(created.body.expense.items[0].totalPrice, 36000);
  const updated = await api(
    `/api/admin/expenses/${created.body.expense.id}`,
    "PATCH",
    {
      ...body,
      items: [{ description: "สี", quantity: 2, unitPrice: 25000 }],
      discountAmount: 0,
      totalAmount: 53500,
    },
  );
  assert.equal(updated.status, 200, JSON.stringify(updated.body));
  assert.equal(updated.body.expense.totalAmount, 53500);
  // Master-data maintenance only updates an old document when explicitly requested.
  const payeeId = created.body.expense.vendorId;
  await prisma.vendor.update({
    where: { id: payeeId },
    data: {
      legalName: "ชื่อเอกสารใหม่",
      taxId: "1234567890123",
      address: "ที่อยู่ทดสอบ",
    },
  });
  const original = await prisma.expense.findUniqueOrThrow({
    where: { id: created.body.expense.id },
  });
  assert.notEqual(
    (original.payeeSnapshot as { legalName: string }).legalName,
    "ชื่อเอกสารใหม่",
  );
  const refreshed = await api(
    `/api/admin/expenses/${created.body.expense.id}`,
    "PATCH",
    {
      ...body,
      items: [{ description: "สี", quantity: 2, unitPrice: 25000 }],
      discountAmount: 0,
      totalAmount: 53500,
      vendorId: payeeId,
      refreshPayeeSnapshot: true,
    },
  );
  assert.equal(refreshed.status, 200, JSON.stringify(refreshed.body));
  assert.equal(
    refreshed.body.expense.payeeSnapshot.legalName,
    "ชื่อเอกสารใหม่",
  );
  const adminExpense = await api(
    `/api/admin/expenses/${created.body.expense.id}`,
    "GET",
    undefined,
    admin,
  );
  assert.equal(adminExpense.status, 200);
  assert.equal("payeeSnapshot" in adminExpense.body.expense, false);
  const report = await api(
    `/api/admin/payroll/report?branchId=${branchId}&from=${date}&to=${date}&staffId=${porn.staffId}`,
  );
  assert.equal(report.body.people.length, 1);
  assert.equal(report.body.totalSatang, 20000);
  const csv = await fetch(
    `${origin}/api/admin/expenses/export?branchId=${branchId}&from=${date}&to=${date}`,
    { headers: { Cookie: owner } },
  );
  assert.equal(csv.status, 200);
  assert.ok((await csv.text()).includes("ชื่อเอกสารใหม่"));
  assert.ok(
    (await prisma.financeAudit.count({ where: { entity: "PAYROLL" } })) >= 3,
  );
  console.log(
    "PASS: auth, automatic OT 9/10h, commission details, concurrent/idempotent payment, atomic expense link, locked paid amounts, traced reopen/void, corrected payout, tips in month, server expense totals, individual report and accounting export",
  );
}
main().finally(() => prisma.$disconnect());
