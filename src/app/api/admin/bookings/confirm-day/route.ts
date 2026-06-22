import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { sendBookingConfirmed } from "@/lib/notifications";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * POST /api/admin/bookings/confirm-day
 * Body: { branchId, date: "YYYY-MM-DD" }
 * Confirms every PENDING booking for that branch+day in one tap. Fires the
 * per-customer LINE confirmation fire-and-forget (each deduped by its own
 * NotificationLog key, so re-running is safe).
 */
export async function POST(request: Request) {
  const gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (gate instanceof Response) return gate;

  try {
    const { branchId, date } = await request.json() as { branchId?: string; date?: string };
    if (!branchId || !date || !DATE_RE.test(date)) {
      return NextResponse.json({ error: "branchId and valid date required" }, { status: 400 });
    }

    const [y, m, d] = date.split("-").map(Number);
    const start = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
    const end   = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));

    const pending = await prisma.booking.findMany({
      where: { branchId, status: "PENDING", date: { gte: start, lte: end } },
      select: { id: true },
    });
    if (pending.length === 0) return NextResponse.json({ ok: true, confirmed: 0 });

    await prisma.booking.updateMany({
      where: { id: { in: pending.map(b => b.id) } },
      data:  { status: "CONFIRMED" },
    });

    // Notify each customer (fire-and-forget; deduped per booking).
    for (const b of pending) {
      sendBookingConfirmed(b.id).catch(e => console.error("[confirm-day] notify failed", b.id, e));
    }

    return NextResponse.json({ ok: true, confirmed: pending.length });
  } catch (error) {
    console.error("confirm-day error:", error);
    return NextResponse.json({ error: "Failed to confirm bookings" }, { status: 500 });
  }
}
