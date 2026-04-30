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
  const branches = await prisma.branch.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }], // active branches first
    select:  { id: true, name: true, address: true, phone: true, isActive: true },
  });

  return <BookCallback branches={branches} />;
}
