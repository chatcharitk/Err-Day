import { prisma } from "@/lib/prisma";
import CustomerHub from "./CustomerHub";

// The branch list is reference data — cache the render (ISR) so the entry page
// is served from the edge instead of a cold dynamic render + DB hit per open.
export const revalidate = 3600;

/**
 * `/` — Unified customer hub for membership, booking history, booking entry,
 * and the AstrologyAPI-powered tarot experience.
 */
export default async function HomePage() {
  const branches = await prisma.branch.findMany({
    where:   { isActive: true },                                  // only admin-active branches
    orderBy: [{ bookingEnabled: "desc" }, { name: "asc" }],      // open branches first
    select:  { id: true, name: true, address: true, phone: true, bookingEnabled: true },
  });
  const branchOrder = ["branch-sukhumvit", "branch-bangna"];
  branches.sort((a, b) => {
    const aIndex = branchOrder.indexOf(a.id);
    const bIndex = branchOrder.indexOf(b.id);
    return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
  });

  return <CustomerHub branches={branches} />;
}
