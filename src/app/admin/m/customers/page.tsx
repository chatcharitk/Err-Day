import { prisma } from "@/lib/prisma";
import CustomersList from "./CustomersList";

export const dynamic = "force-dynamic";

export default async function MobileCustomersPage() {
  const customers = await prisma.customer.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      nickname: true,
      phone: true,
      membership: { select: { pendingActivation: true } },
      _count:     { select: { bookings: true } },
    },
  });

  const rows = customers.map(c => ({
    id:         c.id,
    name:       c.name,
    nickname:   c.nickname,
    phone:      c.phone,
    bookings:   c._count.bookings,
    isMember:   !!c.membership && !c.membership.pendingActivation,
    isPending:  !!c.membership?.pendingActivation,
  }));

  return <CustomersList initialCustomers={rows} />;
}
