import { prisma } from "@/lib/prisma";
import MembershipLookup from "./MembershipLookup";

export const dynamic = "force-dynamic";

export default async function MembershipPage() {
  const tiers = await prisma.membershipTier.findMany({
    where: { isActive: true },
    orderBy: { minPoints: "asc" },
  });

  return <MembershipLookup tiers={tiers} />;
}
