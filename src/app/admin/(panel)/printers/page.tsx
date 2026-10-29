import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { isAgentOnline } from "@/lib/print-agent";
import PrinterManager from "./PrinterManager";

export const dynamic = "force-dynamic";

export default async function PrintersPage() {
  const me = await getCurrentAdmin();
  if (me?.role !== "OWNER") {
    return <div className="p-8 text-sm" style={{ color: "#977A6F" }}>หน้านี้สำหรับเจ้าของร้านเท่านั้น</div>;
  }
  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, printAgentKeyHash: true, printAgentSeenAt: true },
  });
  const jobs = await prisma.printJob.findMany({
    orderBy: { createdAt: "desc" }, take: 12,
    select: { id: true, branchId: true, kind: true, status: true, error: true, createdAt: true, requestedBy: true },
  });
  return (
    <PrinterManager
      branches={branches.map(b => ({
        id: b.id, name: b.name, configured: !!b.printAgentKeyHash,
        online: isAgentOnline(b.printAgentSeenAt),
        seenAt: b.printAgentSeenAt?.toISOString() ?? null,
      }))}
      jobs={jobs.map(j => ({ ...j, createdAt: j.createdAt.toISOString(), branchName: branches.find(b => b.id === j.branchId)?.name ?? j.branchId }))}
    />
  );
}
