import { prisma } from "@/lib/prisma";
import CustomersManager from "./CustomersManager";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const customers = await prisma.customer.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count:     { select: { bookings: true } },
      membership: { include: { tier: true } },
    },
  });

  return (
    <CustomersManager
      customers={customers.map(c => ({
        id:         c.id,
        name:       c.name,
        phone:      c.phone,
        email:      c.email,
        lineUserId: c.lineUserId,
        createdAt:  c.createdAt.toISOString(),
        membership: c.membership
          ? {
              points: c.membership.points,
              tier: {
                name:   c.membership.tier.name,
                nameTh: c.membership.tier.nameTh,
                color:  c.membership.tier.color,
              },
            }
          : null,
        _count: { bookings: c._count.bookings },
      }))}
    />
  );
}
