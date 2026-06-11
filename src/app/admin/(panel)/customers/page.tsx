import { prisma } from "@/lib/prisma";
import CustomersManager from "./CustomersManager";

export const revalidate = 30;

export default async function CustomersPage() {
  // Slim select — only the columns CustomersManager renders. (Was a bare
  // `include`, which also pulled every Customer scalar — notes, photoUrls, pdpa*,
  // pictureUrl, etc. — and the full Membership row, for every customer.) The list
  // is still fully loaded because search/sort/stats run client-side; if the
  // customer count ever gets large, move search to /api/admin/customers?q=.
  const customers = await prisma.customer.findMany({
    orderBy: { name: "asc" },
    select: {
      id:          true,
      name:        true,
      nickname:    true,
      phone:       true,
      email:       true,
      gender:      true,
      dateOfBirth: true,
      pictureUrl:  true,
      lineUserId:  true,
      createdAt:   true,
      _count:     { select: { bookings: true } },
      membership: {
        select: {
          label:             true,
          points:            true,
          activatedAt:       true,
          expiresAt:         true,
          usagesUsed:        true,
          usagesAllowed:     true,
          pendingActivation: true,
        },
      },
    },
  });

  return (
    <CustomersManager
      customers={customers.map(c => ({
        id:         c.id,
        name:       c.name,
        nickname:   c.nickname,
        phone:      c.phone,
        email:      c.email,
        gender:      c.gender,
        dateOfBirth: c.dateOfBirth?.toISOString() ?? null,
        pictureUrl:  c.pictureUrl,
        lineUserId: c.lineUserId,
        createdAt:  c.createdAt.toISOString(),
        membership: c.membership
          ? {
              label:         c.membership.label,
              points:        c.membership.points,
              activatedAt:       c.membership.activatedAt.toISOString(),
              expiresAt:         c.membership.expiresAt?.toISOString() ?? null,
              usagesUsed:        c.membership.usagesUsed,
              usagesAllowed:     c.membership.usagesAllowed,
              pendingActivation: c.membership.pendingActivation,
            }
          : null,
        _count: { bookings: c._count.bookings },
      }))}
    />
  );
}
