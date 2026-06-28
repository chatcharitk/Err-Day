import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCachedBranches } from "@/lib/branches-cache";
import { loadDeskBoard } from "@/lib/desk";
import LiveView, { type LiveBoard } from "@/app/admin/(panel)/live/LiveView";

export const dynamic  = "force-dynamic";
export const metadata = { title: "หน้าร้านสด — err.day" };

/** Mobile-admin live staff-load view. Reuses the shared LiveView, routing
 *  branch switches within /admin/m/live. */
export default async function MobileLivePage({
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

  return (
    <main className="pb-10">
      <header className="sticky top-0 z-20 bg-white px-3 py-3 flex items-center gap-2"
        style={{ borderBottom: "1px solid #E8D8CC" }}>
        <Link href="/admin/m" className="p-1" style={{ color: "#3B2A24" }} aria-label="กลับ">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-base font-bold" style={{ color: "#3B2A24" }}>หน้าร้านสด</h1>
      </header>
      <LiveView branches={branches} activeBranchId={activeBranchId} initialBoards={boards} basePath="/admin/m/live" />
    </main>
  );
}
