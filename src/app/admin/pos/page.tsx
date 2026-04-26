import { prisma } from "@/lib/prisma";
import PosTerminal from "./PosTerminal";

export const dynamic = "force-dynamic";

export default async function PosPage({
  searchParams,
}: {
  searchParams: Promise<{ branchId?: string }>;
}) {
  const { branchId } = await searchParams;

  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  const activeBranchId = branchId ?? branches[0]?.id ?? "";

  const branchServices = activeBranchId
    ? await prisma.branchService.findMany({
        where: { branchId: activeBranchId, isActive: true },
        include: { service: true },
        orderBy: [{ service: { category: "asc" } }],
      })
    : [];

  return (
    <PosTerminal
      branches={branches}
      activeBranchId={activeBranchId}
      branchServices={branchServices}
    />
  );
}
