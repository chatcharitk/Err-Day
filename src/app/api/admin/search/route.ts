import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";

/**
 * GET /api/admin/search?q=...&limit=8
 *
 * Single round-trip search used by the mobile admin.
 * Returns matching customers AND each customer's next-2 upcoming bookings.
 *
 * Replaces the N+1 pattern (one fetch per customer) with two parallel queries.
 */
export async function GET(request: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const q     = searchParams.get("q")?.trim() ?? "";
    const limit = Math.min(20, parseInt(searchParams.get("limit") ?? "8", 10) || 8);

    if (q.length < 1) return NextResponse.json([]);

    const customers = await prisma.customer.findMany({
      where: {
        OR: [
          { name:     { contains: q, mode: "insensitive" } },
          { nickname: { contains: q, mode: "insensitive" } },
          { phone:    { contains: q } },
        ],
      },
      orderBy: { name: "asc" },
      take: limit,
      select: { id: true, name: true, nickname: true, phone: true, email: true },
    });

    if (customers.length === 0) return NextResponse.json([]);

    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);

    // One query for upcoming bookings across all matched customers
    const upcoming = await prisma.booking.findMany({
      where: {
        customerId: { in: customers.map((c) => c.id) },
        date:       { gte: dayStart },
        status:     { notIn: ["CANCELLED", "COMPLETED", "NO_SHOW"] },
      },
      select: {
        id: true, customerId: true, date: true, startTime: true, endTime: true,
        status: true,
        service: { select: { nameTh: true } },
        branch:  { select: { name: true } },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });

    // Group bookings by customerId, keep first 2 each
    const byCustomer = new Map<string, typeof upcoming>();
    for (const b of upcoming) {
      const list = byCustomer.get(b.customerId) ?? [];
      if (list.length < 2) {
        list.push(b);
        byCustomer.set(b.customerId, list);
      }
    }

    return NextResponse.json(
      customers.map((c) => ({
        ...c,
        upcoming: (byCustomer.get(c.id) ?? []).map((b) => ({
          id:           b.id,
          date:         b.date.toISOString(),
          startTime:    b.startTime,
          status:       b.status,
          serviceName:  b.service.nameTh,
          branchName:   b.branch.name,
        })),
      })),
    );
  } catch (e) {
    if (e instanceof Response) return e;
    console.error(e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
