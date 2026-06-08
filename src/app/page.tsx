import { prisma } from "@/lib/prisma";
import BookCallback from "./book/BookCallback";

// The branch list is reference data — cache the render (ISR) so the entry page
// is served from the edge instead of a cold dynamic render + DB hit per open.
export const revalidate = 60;

/**
 * `/` — Unified entry point.
 * Asks the user to sign in with LINE first (or continue without),
 * then shows the branch picker. Clicking a branch goes to `/book/[branchId]`
 * which is the booking flow.
 */
export default async function HomePage() {
  const branches = await prisma.branch.findMany({
    where:   { isActive: true },                                  // only admin-active branches
    orderBy: [{ bookingEnabled: "desc" }, { name: "asc" }],      // open branches first
    select:  { id: true, name: true, address: true, phone: true, bookingEnabled: true },
  });

  return <BookCallback branches={branches} />;
}
