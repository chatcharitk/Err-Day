import { NextResponse } from "next/server";
import { getKioskBranch } from "@/lib/kiosk-auth";
import { loadDeskBoard } from "@/lib/desk";

export const dynamic = "force-dynamic";

/**
 * Deployment marker for the always-on kiosk devices: the board compares this
 * against the value it saw on first load and reloads itself when it changes,
 * so in-store iPads pick up new versions without staff touching them.
 * Falls back to "dev" (feature inert) when the Vercel system env is absent.
 */
const REV = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.VERCEL_DEPLOYMENT_ID ?? "dev";

/** Live board payload for the kiosk poller. Authorized by the kiosk cookie. */
export async function GET() {
  const branch = await getKioskBranch();
  if (!branch) return NextResponse.json({ error: "Kiosk not armed" }, { status: 401 });

  const data = await loadDeskBoard(branch.id);
  return NextResponse.json({ branchName: branch.name, rev: REV, ...data });
}
