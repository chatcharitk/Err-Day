import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getCachedBranches } from "@/lib/branches-cache";
import { loadDeskBoard } from "@/lib/desk";

export const dynamic = "force-dynamic";

/** Live per-staff load for the admin "หน้าร้านสด" view poller. Admin-only. */
export async function GET(request: Request) {
  const gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (gate instanceof Response) return gate;

  const branchId = new URL(request.url).searchParams.get("branchId") || "all";
  const branches = await getCachedBranches();
  const ids = branchId === "all" ? branches.map(b => b.id) : [branchId];

  const boards = await Promise.all(ids.map(async id => {
    const board = await loadDeskBoard(id);
    return { branchName: branches.find(b => b.id === id)?.name ?? id, ...board };
  }));

  return NextResponse.json({ boards });
}
