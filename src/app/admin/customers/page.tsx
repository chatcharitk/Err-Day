import { prisma } from "@/lib/prisma";
import CustomersManager from "./CustomersManager";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const customers = await prisma.customer.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count:     { select: { bookings: true } },
      membership: true,
    },
  });

  return (
    <CustomersManager
      customers={customers.map(c => ({
        id:         c.id,
        name:       c.name,
        phone:      c.phone,
        email:      c.email,
        gender:     c.gender,
        pictureUrl: c.pictureUrl,
        lineUserId: c.lineUserId,
        createdAt:  c.createdAt.toISOString(),
        membership: c.membership
          ? {
              label:         c.membership.label,
              points:        c.membership.points,
              activatedAt:   c.membership.activatedAt.toISOString(),
              expiresAt:     c.membership.expiresAt?.toISOString() ?? null,
              usagesUsed:    c.membership.usagesUsed,
              usagesAllowed: c.membership.usagesAllowed,
            }
          : null,
        _count: { bookings: c._count.bookings },
      }))}
    />
  );
}
