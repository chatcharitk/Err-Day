import { prisma } from "@/lib/prisma";
import MembershipList from "./MembershipList";

export const revalidate = 30;

export default async function MobileMembershipPage() {
  // Fetch all customers who have memberships, ordered by expiry
  const memberships = await prisma.membership.findMany({
    select: {
      id:                true,
      label:             true,
      activatedAt:       true,
      expiresAt:         true,
      usagesUsed:        true,
      usagesAllowed:     true,
      pendingActivation: true,
      customer: {
        select: { id: true, name: true, nickname: true, phone: true, pictureUrl: true },
      },
    },
    orderBy: { activatedAt: "desc" },
    take:    200,
  });

  const data = memberships.map(m => ({
    id:                m.id,
    label:             m.label,
    activatedAt:       m.activatedAt.toISOString(),
    expiresAt:         m.expiresAt?.toISOString() ?? null,
    usagesUsed:        m.usagesUsed,
    usagesAllowed:     m.usagesAllowed,
    pendingActivation: m.pendingActivation,
    customer:          m.customer,
  }));

  return <MembershipList memberships={data} />;
}
