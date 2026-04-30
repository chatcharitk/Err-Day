import { prisma } from "@/lib/prisma";
import BookCallback from "./book/BookCallback";

export const dynamic = "force-dynamic";

/**
 * `/` — Unified entry point.
 * Asks the user to sign in with LINE first (or continue without),
 * then shows the branch picker. Clicking a branch goes to `/book/[branchId]`
 * which is the booking flow.
 */
export default async function HomePage() {
  const branches = await prisma.branch.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select:  { id: true, name: true, address: true, phone: true, isActive: true },
  });

  return <BookCallback branches={branches} />;
}
