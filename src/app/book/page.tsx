import { prisma } from "@/lib/prisma";
import BookCallback from "./BookCallback";

// The branch list is reference data — cache the render (ISR) so the entry page
// is served from the edge instead of a cold dynamic render + DB hit per open.
export const revalidate = 60;

/**
 * /book — Handles the LIFF OAuth callback (Line endpoint URL points here).
 * Initializes LIFF on the client, then redirects either:
 *   1. back to the page the user came from (saved in sessionStorage), or
 *   2. to a branch selection list if no return URL is set.
 */
export default async function BookIndex() {
  // name: "desc" puts สุขุมวิท (ส) before บางนา (บ) — Thai ส > บ Unicode order.
  // Open branches (bookingEnabled) still float to the top.
  const branches = await prisma.branch.findMany({
    where:   { isActive: true },
    orderBy: [{ bookingEnabled: "desc" }, { name: "desc" }],
    select:  { id: true, name: true, address: true, phone: true, bookingEnabled: true },
  });

  return <BookCallback branches={branches} />;
}
