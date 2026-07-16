import { NextResponse } from "next/server";
import { getKioskBranch } from "@/lib/kiosk-auth";
import { loadDeskBoard, deskBoardEtag } from "@/lib/desk";

export const dynamic = "force-dynamic";

/**
 * Deployment marker for the always-on kiosk devices: the board compares this
 * against the value it saw on first load and reloads itself when it changes,
 * so in-store iPads pick up new versions without staff touching them.
 * Falls back to "dev" (feature inert) when the Vercel system env is absent.
 */
const REV = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.VERCEL_DEPLOYMENT_ID ?? "dev";

/**
 * Live board payload for the kiosk poller. Authorized by the kiosk cookie.
 *
 * Change probe: the poller passes back the `etag` it last saw; when the cheap
 * one-query fingerprint still matches, we answer `{unchanged:true}` without
 * running the join-heavy board load — on an always-on kiosk the vast majority
 * of polls hit this path, which is what keeps serverless CPU per poll tiny.
 */
export async function GET(request: Request) {
  const branch = await getKioskBranch();
  if (!branch) return NextResponse.json({ error: "Kiosk not armed" }, { status: 401 });

  const clientEtag = new URL(request.url).searchParams.get("etag");
  const etag = await deskBoardEtag(branch.id);
  if (clientEtag && clientEtag === etag) {
    return NextResponse.json({ unchanged: true, rev: REV, etag });
  }

  const data = await loadDeskBoard(branch.id);
  return NextResponse.json({ branchName: branch.name, rev: REV, etag, ...data });
}
