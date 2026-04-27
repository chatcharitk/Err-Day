import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import BookingFlow from "./BookingFlow";

export const dynamic = "force-dynamic";

export default async function BookPage({ params }: { params: Promise<{ branchId: string }> }) {
  const { branchId } = await params;

  const branch = await prisma.branch.findUnique({
    where: { id: branchId, isActive: true },
  });
  if (!branch) notFound();

  const branchServices = await prisma.branchService.findMany({
    where: { branchId, isActive: true },
    include: { service: true },
    orderBy: { service: { category: "asc" } },
  });

  const addons = await prisma.serviceAddon.findMany({
    where: { isActive: true },
    orderBy: { price: "asc" },
  });

  return <BookingFlow branch={branch} branchServices={branchServices} addons={addons} />;
}
