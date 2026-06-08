import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import BookingFlow from "./BookingFlow";

// Branch hours, the service list/prices and add-ons are slow-changing reference
// data, so cache the page (ISR) — it's served from the edge with no cold start
// or DB round-trip on a cache hit. Live availability is fetched client-side
// from /api/availability, so cached HTML never shows stale slots.
export const revalidate = 60;

// A dynamic [branchId] segment with no generateStaticParams renders
// dynamically on every request (even with `revalidate` set) — so list the
// branches to prerender them at build and turn this into a cached ISR page.
// There are only a couple of branches; new ones fall back to on-demand render.
export async function generateStaticParams() {
  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    select: { id: true },
  });
  return branches.map((b) => ({ branchId: b.id }));
}

export default async function BookPage({ params }: { params: Promise<{ branchId: string }> }) {
  const { branchId } = await params;

  // Three independent reads — run them in parallel instead of as a waterfall.
  const [branch, branchServices, addons] = await Promise.all([
    prisma.branch.findUnique({
      where: { id: branchId, isActive: true },
    }),
    prisma.branchService.findMany({
      where: { branchId, isActive: true },
      include: { service: true },
      orderBy: { service: { category: "asc" } },
    }),
    prisma.serviceAddon.findMany({
      where: { isActive: true },
      orderBy: { price: "asc" },
    }),
  ]);
  if (!branch) notFound();

  return <BookingFlow branch={branch} branchServices={branchServices} addons={addons} />;
}
