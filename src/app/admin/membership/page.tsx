import { prisma } from "@/lib/prisma";
import MembershipManager from "./MembershipManager";

export const dynamic = "force-dynamic";

export default async function MembershipPage() {
  const tiers = await prisma.membershipTier.findMany({
    orderBy: { minPoints: "asc" },
    include: { _count: { select: { memberships: true } } },
  });

  return <MembershipManager tiers={tiers.map(t => ({
    id:              t.id,
    name:            t.name,
    nameTh:          t.nameTh,
    minPoints:       t.minPoints,
    discountPercent: t.discountPercent,
    color:           t.color,
    validityDays:    t.validityDays,
    maxUsages:       t.maxUsages,
    isActive:        t.isActive,
    _count:          { memberships: t._count.memberships },
  }))} />;
}
