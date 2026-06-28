import { NextResponse } from "next/server";
import { getKioskBranch } from "@/lib/kiosk-auth";
import { loadDeskBoard } from "@/lib/desk";

export const dynamic = "force-dynamic";

/** Live board payload for the kiosk poller. Authorized by the kiosk cookie. */
export async function GET() {
  const branch = await getKioskBranch();
  if (!branch) return NextResponse.json({ error: "Kiosk not armed" }, { status: 401 });

  const data = await loadDeskBoard(branch.id);
  return NextResponse.json({ branchName: branch.name, ...data });
}
