import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import {
  computeBranchDailyPayout,
  bangkokDayRange,
  bangkokDayNoon,
  bangkokTodayStr,
  otPaySatang,
} from "@/lib/payroll";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/admin/payroll?branchId=...&date=YYYY-MM-DD
 * Daily payout rows (commission + OT) for one branch/day. OWNER only (salary data).
 */
export async function GET(request: Request) {
  const gate = await requireOwner().catch((e: unknown) => e as Response);
  if (gate instanceof Response) return gate;

  const { searchParams } = new URL(request.url);
  const branchId = searchParams.get("branchId");
  const date = searchParams.get("date") || bangkokTodayStr();
  if (!branchId) return NextResponse.json({ error: "branchId required" }, { status: 400 });
  if (!DATE_RE.test(date)) return NextResponse.json({ error: "invalid date" }, { status: 400 });

  const rows = await computeBranchDailyPayout(branchId, date);
  return NextResponse.json({ date, branchId, rows });
}

/**
 * PATCH /api/admin/payroll
 * Body: { staffId, date, otHours?, worked?, action?: "pay" | "unpay" }
 * branchId is derived from the staff record (not trusted from the body).
 * Upserts the staff's daily payout row; `pay` snapshots commission+OT → PAID.
 */
export async function PATCH(request: Request) {
  const gate = await requireOwner().catch((e: unknown) => e as Response);
  if (gate instanceof Response) return gate;
  const admin = gate;

  try {
    const body = await request.json() as {
      staffId?: string; date?: string;
      otHours?: unknown; tipSatang?: unknown; worked?: unknown; action?: string;
    };
    const staffId = body.staffId;
    const date = body.date || bangkokTodayStr();
    if (!staffId) return NextResponse.json({ error: "staffId required" }, { status: 400 });
    if (!DATE_RE.test(date)) return NextResponse.json({ error: "invalid date" }, { status: 400 });

    const action = body.action;
    if (action !== undefined && action !== "pay" && action !== "unpay") {
      return NextResponse.json({ error: "invalid action" }, { status: 400 });
    }

    const staff = await prisma.staff.findUnique({
      where: { id: staffId },
      select: { id: true, branchId: true, payType: true, baseSatang: true, otRateSatang: true },
    });
    if (!staff) return NextResponse.json({ error: "ไม่พบพนักงาน" }, { status: 404 });
    const branchId = staff.branchId; // authoritative — never trust the body

    // Validate / clamp OT hours (0–24, finite number).
    let otHours: number | undefined;
    if (body.otHours !== undefined && body.otHours !== null && body.otHours !== "") {
      const n = Number(body.otHours);
      if (!Number.isFinite(n)) return NextResponse.json({ error: "invalid otHours" }, { status: 400 });
      otHours = Math.min(24, Math.max(0, n));
    }
    const worked = typeof body.worked === "boolean" ? body.worked : undefined;

    // Validate / clamp tip amount (0–50,000 baht, finite number).
    let tipSatang: number | undefined;
    if (body.tipSatang !== undefined && body.tipSatang !== null && body.tipSatang !== "") {
      const n = Number(body.tipSatang);
      if (!Number.isFinite(n)) return NextResponse.json({ error: "invalid tipSatang" }, { status: 400 });
      tipSatang = Math.min(5_000_000, Math.max(0, Math.round(n)));
    }

    const noon = bangkokDayNoon(date);
    const baseData = {
      ...(otHours !== undefined ? { otHours } : {}),
      ...(tipSatang !== undefined ? { tipSatang } : {}),
      ...(worked !== undefined ? { worked } : {}),
    };

    if (action === "pay") {
      const { start, end } = bangkokDayRange(date);
      const bookings = await prisma.booking.findMany({
        where: { branchId, staffId, status: "COMPLETED", date: { gte: start, lte: end } },
        select: {
          commissionSatang: true,
          service: { select: { commissionSatang: true } },
          addons:  { select: { addon: { select: { commissionSatang: true } } } },
        },
      });
      const commissionSatang = bookings.reduce(
        (s, b) => s + (b.commissionSatang
          ?? ((b.service?.commissionSatang ?? 0)
            + b.addons.reduce((t, a) => t + (a.addon?.commissionSatang ?? 0), 0))),
        0,
      );
      const existing = await prisma.staffDailyPayout.findUnique({ where: { staffId_date: { staffId, date: noon } } });
      const effectiveOtHours = otHours ?? existing?.otHours ?? 0;
      const otSatang = otPaySatang(staff, effectiveOtHours);

      const row = await prisma.staffDailyPayout.upsert({
        where: { staffId_date: { staffId, date: noon } },
        update: { ...baseData, status: "PAID", commissionSatang, otSatang, paidAt: new Date(), paidBy: admin.username },
        create: { staffId, branchId, date: noon, otHours: effectiveOtHours, ...baseData, status: "PAID", commissionSatang, otSatang, paidAt: new Date(), paidBy: admin.username },
      });
      return NextResponse.json({ ok: true, row });
    }

    if (action === "unpay") {
      const row = await prisma.staffDailyPayout.upsert({
        where: { staffId_date: { staffId, date: noon } },
        update: { ...baseData, status: "PENDING", commissionSatang: null, otSatang: null, paidAt: null, paidBy: null },
        create: { staffId, branchId, date: noon, ...baseData, status: "PENDING" },
      });
      return NextResponse.json({ ok: true, row });
    }

    const row = await prisma.staffDailyPayout.upsert({
      where: { staffId_date: { staffId, date: noon } },
      update: baseData,
      create: { staffId, branchId, date: noon, ...baseData },
    });
    return NextResponse.json({ ok: true, row });
  } catch (error) {
    console.error("Payroll PATCH error:", error);
    return NextResponse.json({ error: "Failed to update payout" }, { status: 500 });
  }
}
