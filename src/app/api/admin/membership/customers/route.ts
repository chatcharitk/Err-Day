import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const customers = await prisma.customer.findMany({
    where: { membership: { isNot: null } },
    orderBy: { name: "asc" },
    include: {
      membership: { include: { tier: true } },
    },
  });

  // For each customer, count cycle bookings (since activatedAt) and total completed bookings
  const results = await Promise.all(
    customers.map(async (c) => {
      const m = c.membership!;

      const [cycleCount, totalCount] = await Promise.all([
        // Bookings in current cycle (since activatedAt)
        m.activatedAt
          ? prisma.booking.count({
              where: {
                customerId: c.id,
                status: "COMPLETED",
                date: { gte: m.activatedAt },
              },
            })
          : 0,
        // All completed bookings ever
        prisma.booking.count({
          where: { customerId: c.id, status: "COMPLETED" },
        }),
      ]);

      const now = new Date();
      const expired = m.expiresAt != null && new Date(m.expiresAt) <= now;
      const usedUp = m.usagesAllowed > 0 && m.usagesUsed >= m.usagesAllowed;
      const isValid = !expired && !usedUp;

      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        membership: {
          id: m.id,
          label: m.label,
          isValid,
          expired,
          usedUp,
          expiresAt: m.expiresAt?.toISOString() ?? null,
          activatedAt: m.activatedAt?.toISOString() ?? null,
          usagesAllowed: m.usagesAllowed,
          usagesUsed: m.usagesUsed,
          points: m.points,
          tier: m.tier
            ? { id: m.tier.id, name: m.tier.name, discountPercent: m.tier.discountPercent }
            : null,
        },
        cycleBookings: cycleCount,
        totalBookings: totalCount,
      };
    })
  );

  return NextResponse.json(results);
}
