/**
 * GET  /api/admin/payroll/monthly?branchId=&month=YYYY-MM
 *   Per-staff commission+OT rollup for one branch/month (PAID days only).
 * POST /api/admin/payroll/monthly
 *   { staffId, branchId, month } — records one staff's monthly rollup as an
 *   Expense (category commission_bonus). Idempotent: re-posting the same
 *   staff/month returns the existing expense instead of creating a duplicate.
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { computeBranchMonthlyPayout, payrollExpenseMarker, bangkokMonthRange } from "@/lib/payroll";

const MONTH_RE = /^\d{4}-\d{2}$/;

export async function GET(request: Request) {
  const _gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (_gate instanceof Response) return _gate;

  const { searchParams } = new URL(request.url);
  const branchId = searchParams.get("branchId");
  const month    = searchParams.get("month");
  if (!branchId) return NextResponse.json({ error: "branchId required" }, { status: 400 });
  if (!month || !MONTH_RE.test(month)) return NextResponse.json({ error: "invalid month (expect YYYY-MM)" }, { status: 400 });

  const rows = await computeBranchMonthlyPayout(branchId, month);
  return NextResponse.json({ rows });
}

export async function POST(request: Request) {
  const admin = await requireAdmin().catch((e: unknown) => e as Response);
  if (admin instanceof Response) return admin;

  const body = await request.json().catch(() => ({}));
  const { staffId, branchId, month } = body;
  if (!staffId || !branchId) return NextResponse.json({ error: "staffId and branchId required" }, { status: 400 });
  if (!month || !MONTH_RE.test(month)) return NextResponse.json({ error: "invalid month (expect YYYY-MM)" }, { status: 400 });

  const marker = payrollExpenseMarker(staffId, month);

  // Idempotency: this staff/month already recorded → return the existing row
  // rather than creating a second one.
  const existing = await prisma.expense.findFirst({
    where: { branchId, category: "commission_bonus", notes: { contains: marker } },
  });
  if (existing) {
    return NextResponse.json({ expense: existing, alreadyRecorded: true });
  }

  const rows = await computeBranchMonthlyPayout(branchId, month);
  const row = rows.find(r => r.staffId === staffId);
  if (!row || row.totalSatang <= 0) {
    return NextResponse.json({ error: "ไม่มีค่าคอมมิชชั่น/OT ที่จ่ายแล้วในเดือนนี้" }, { status: 400 });
  }

  const { lastDay } = bangkokMonthRange(month);
  const [y, m] = month.split("-");

  try {
    const expense = await prisma.expense.create({
      data: {
        branchId,
        category:    "commission_bonus",
        vendor:      row.name,
        date:        new Date(`${month}-${String(lastDay).padStart(2, "0")}T12:00:00`),
        totalAmount: row.totalSatang,
        notes:       `สรุปค่าคอมมิชชั่น + OT เดือน ${m}/${y} (${row.daysPaid} วันที่จ่ายแล้ว) ${marker}`,
        status:      "CONFIRMED",
        items: {
          create: [
            ...(row.commissionSatang > 0 ? [{ description: "ค่าคอมมิชชั่น", quantity: 1, unitPrice: row.commissionSatang, totalPrice: row.commissionSatang }] : []),
            ...(row.otSatang > 0 ? [{ description: "ค่า OT", quantity: 1, unitPrice: row.otSatang, totalPrice: row.otSatang }] : []),
          ],
        },
      },
      include: { items: true },
    });
    return NextResponse.json({ expense, alreadyRecorded: false }, { status: 201 });
  } catch (e) {
    console.error("[payroll/monthly POST]", e);
    return NextResponse.json({ error: "Failed to create expense" }, { status: 500 });
  }
}
