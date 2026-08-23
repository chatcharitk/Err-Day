/**
 * POST /api/admin/payroll/daily-expense
 * Body: { staffId, date, commissionSatang, otSatang, tipSatang, category? }
 *
 * Records one staff's daily payout as an Expense. The three amounts are
 * supplied by the client (pre-filled from the day's row, editable in a
 * review step before submitting) rather than recomputed here — this route
 * is the "check and adjust before recording" step, not a recompute.
 *
 * Idempotent per (staffId, date): the StaffDailyPayout.expenseId field is
 * the source of truth — a second POST for the same day returns the existing
 * expense instead of creating a duplicate.
 */
import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { bangkokDayNoon } from "@/lib/payroll";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_SATANG = 5_000_000; // ฿50,000 sanity ceiling per component

function clampSatang(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.min(MAX_SATANG, Math.max(0, Math.round(n)));
}

export async function POST(request: Request) {
  const gate = await requireOwner().catch((e: unknown) => e as Response);
  if (gate instanceof Response) return gate;

  const body = await request.json().catch(() => ({})) as {
    staffId?: string; date?: string;
    commissionSatang?: unknown; otSatang?: unknown; tipSatang?: unknown;
    category?: string;
  };
  const { staffId, date } = body;
  if (!staffId) return NextResponse.json({ error: "staffId required" }, { status: 400 });
  if (!date || !DATE_RE.test(date)) return NextResponse.json({ error: "invalid date" }, { status: 400 });

  const staff = await prisma.staff.findUnique({
    where: { id: staffId },
    select: { id: true, name: true, branchId: true },
  });
  if (!staff) return NextResponse.json({ error: "ไม่พบพนักงาน" }, { status: 404 });

  const noon = bangkokDayNoon(date);

  const existingRow = await prisma.staffDailyPayout.findUnique({
    where: { staffId_date: { staffId, date: noon } },
  });
  if (existingRow?.expenseId) {
    const expense = await prisma.expense.findUnique({ where: { id: existingRow.expenseId } });
    if (expense) return NextResponse.json({ expense, alreadyRecorded: true });
  }

  const commissionSatang = clampSatang(body.commissionSatang);
  const otSatang = clampSatang(body.otSatang);
  const tipSatang = clampSatang(body.tipSatang);
  const total = commissionSatang + otSatang + tipSatang;
  if (total <= 0) {
    return NextResponse.json({ error: "ยอดรวมต้องมากกว่า 0" }, { status: 400 });
  }

  const category = body.category === "salary" ? "salary" : "commission_bonus";

  try {
    const expense = await prisma.expense.create({
      data: {
        branchId: staff.branchId,
        category,
        vendor: staff.name,
        date: noon,
        totalAmount: total,
        notes: "จ่ายเงินสดประจำวัน (บันทึกจากระบบเงินเดือน)",
        status: "CONFIRMED",
        items: {
          create: [
            ...(commissionSatang > 0 ? [{ description: "ค่าคอมมิชชั่น", quantity: 1, unitPrice: commissionSatang, totalPrice: commissionSatang }] : []),
            ...(otSatang > 0 ? [{ description: "ค่า OT", quantity: 1, unitPrice: otSatang, totalPrice: otSatang }] : []),
            ...(tipSatang > 0 ? [{ description: "ทิป", quantity: 1, unitPrice: tipSatang, totalPrice: tipSatang }] : []),
          ],
        },
      },
      include: { items: true },
    });

    // Persist the (possibly-edited) amounts back onto the payout snapshot too —
    // otherwise the "ค่าตอบแทน" table keeps showing the pre-edit numbers while
    // the Expense just created reflects what was actually confirmed here.
    await prisma.staffDailyPayout.upsert({
      where: { staffId_date: { staffId, date: noon } },
      update: { expenseId: expense.id, commissionSatang, otSatang, tipSatang, status: "PAID" },
      create: {
        staffId, branchId: staff.branchId, date: noon, expenseId: expense.id,
        commissionSatang, otSatang, tipSatang, status: "PAID",
      },
    });

    return NextResponse.json({ expense, alreadyRecorded: false }, { status: 201 });
  } catch (e) {
    console.error("[payroll/daily-expense POST]", e);
    return NextResponse.json({ error: "บันทึกไม่สำเร็จ" }, { status: 500 });
  }
}
