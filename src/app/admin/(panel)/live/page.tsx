import { getCachedBranches } from "@/lib/branches-cache";
import { loadDeskBoard } from "@/lib/desk";
import LiveView, { type LiveBoard } from "./LiveView";

// Live counts — never cache.
export const dynamic  = "force-dynamic";
export const metadata = { title: "หน้าร้านสด — err.day" };

export default async function LivePage({
  searchParams,
}: {
  searchParams: Promise<{ branchId?: string }>;
}) {
  const { branchId: raw } = await searchParams;
  const activeBranchId = raw && raw !== "all" ? raw : "all";

  const branches = await getCachedBranches();
  const ids = activeBranchId === "all" ? branches.map(b => b.id) : [activeBranchId];

  const boards: LiveBoard[] = await Promise.all(ids.map(async id => {
    const board = await loadDeskBoard(id);
    return { branchName: branches.find(b => b.id === id)?.name ?? id, ...board };
  }));

  return <LiveView branches={branches} activeBranchId={activeBranchId} initialBoards={boards} />;
}
