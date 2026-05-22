import { prisma } from "@/lib/prisma";
import BookCallback from "./BookCallback";

export const dynamic = "force-dynamic";

/**
 * /book — Handles the LIFF OAuth callback (Line endpoint URL points here).
 * Initializes LIFF on the client, then redirects either:
 *   1. back to the page the user came from (saved in sessionStorage), or
 *   2. to a branch selection list if no return URL is set.
 */
export default async function BookIndex() {
  const branchRows = await prisma.branch.findMany({
    where:   { isActive: true },
    orderBy: [{ bookingEnabled: "desc" }, { name: "asc" }],
    select:  { id: true, name: true, address: true, phone: true, bookingEnabled: true },
  });

  // Explicit display order — first IDs listed appear first; unknown branches fall to the end.
  const BRANCH_ORDER = ["branch-sukhumvit", "branch-bangna"];
  const branches = [...branchRows].sort((a, b) => {
    const ia = BRANCH_ORDER.indexOf(a.id);
    const ib = BRANCH_ORDER.indexOf(b.id);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });

  return <BookCallback branches={branches} />;
}
