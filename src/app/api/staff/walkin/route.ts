import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentStaffPerson } from "@/lib/staff-auth";
import { maskPhone } from "@/lib/staff-person";
import { customerSearchWhere, rankCustomers, searchWords } from "@/lib/customer-search";
import { bangkokTodayYmd } from "@/lib/desk";
import { SALE_ONLY_SKUS } from "@/lib/capacity";
import { createWalkin, WalkinError } from "@/lib/walkin";

const isSynthetic = (phone: string) => /^(walkin-|pos-)/.test(phone);

async function myRowAt(staffIds: string[], branchId: string) {
  return prisma.staff.findFirst({
    where:  { id: { in: staffIds }, branchId, isActive: true },
    select: { id: true },
  });
}

/**
 * GET /api/staff/walkin?branchId=…&q=… — customer search for the stylist's
 * phone. Phones are masked (staff never see full numbers). Each hit says
 * whether the customer is a member and whether they already have a booking
 * today at this branch, so staff open that booking instead of making a second.
 */
export async function GET(request: Request) {
  const me = await getCurrentStaffPerson();
  if (!me) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบใหม่" }, { status: 401 });

  const url = new URL(request.url);
  const branchId = url.searchParams.get("branchId") ?? "";
  const q = (url.searchParams.get("q") ?? "").trim();
  if (!me.person.branchIds.includes(branchId)) {
    return NextResponse.json({ error: "คุณไม่ได้ประจำสาขานี้" }, { status: 403 });
  }
  if (searchWords(q).join("").length < 2) return NextResponse.json({ results: [] });

  const todayYmd = bangkokTodayYmd();
  const dayStart = new Date(todayYmd + "T00:00:00.000Z");
  const dayEnd   = new Date(dayStart.getTime() + 24 * 3600e3);
  const todayUTC = new Date(); todayUTC.setUTCHours(0, 0, 0, 0);

  const pool = await prisma.customer.findMany({
    where: {
      AND: [
        customerSearchWhere(q),
        // Anonymous desk walk-ins are all called "Walk-in" — nothing to find.
        { NOT: { name: { equals: "Walk-in", mode: "insensitive" } } },
      ],
    },
    take: 60,
    select: {
      id: true, name: true, nickname: true, lineDisplayName: true, phone: true,
      membership: { select: { expiresAt: true, pendingActivation: true, usagesUsed: true, usagesAllowed: true } },
      packages: {
        where:  { closedAt: null, pendingActivation: false, expiresAt: { gte: todayUTC } },
        select: { usagesUsed: true, usageLimit: true },
      },
      bookings: {
        where: {
          branchId,
          date:      { gte: dayStart, lt: dayEnd },
          status:    { notIn: ["CANCELLED", "NO_SHOW"] },
          serviceId: { notIn: SALE_ONLY_SKUS },
        },
        select: { id: true, startTime: true, status: true, checkedInAt: true },
        orderBy: { startTime: "asc" },
        take: 1,
      },
    },
  });

  const results = rankCustomers(pool, q, 8).map(c => {
    const m = c.membership;
    const memberActive = (!!m && !m.pendingActivation
      && !(m.expiresAt != null && m.expiresAt < todayUTC)
      && !(m.usagesAllowed > 0 && m.usagesUsed >= m.usagesAllowed))
      || c.packages.some(p => p.usageLimit === 0 || p.usagesUsed < p.usageLimit);
    const b = c.bookings[0];
    return {
      id:       c.id,
      name:     c.name,
      nickname: c.nickname,
      phone:    isSynthetic(c.phone) ? "" : maskPhone(c.phone),
      member:   memberActive,
      today:    b ? {
        id: b.id, startTime: b.startTime,
        state: b.status === "COMPLETED" ? "done" : b.checkedInAt ? "inservice" : "waiting",
      } : null,
    };
  });
  return NextResponse.json({ results });
}

/**
 * POST /api/staff/walkin { branchId, customerId? } — walk-in (สระไดร์) at the
 * current time, already checked in to me. No customerId = anonymous walk-in.
 */
export async function POST(request: Request) {
  const me = await getCurrentStaffPerson();
  if (!me) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบใหม่" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const branchId = typeof body.branchId === "string" ? body.branchId : "";
  const customerId = typeof body.customerId === "string" && body.customerId ? body.customerId : null;

  const row = await myRowAt(me.person.staffIds, branchId);
  if (!row) return NextResponse.json({ error: "คุณไม่ได้ประจำสาขานี้" }, { status: 403 });

  try {
    const booking = await createWalkin({ branchId, staffId: row.id, customerId });
    return NextResponse.json({ ok: true, id: booking.id }, { status: 201 });
  } catch (e) {
    if (e instanceof WalkinError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
