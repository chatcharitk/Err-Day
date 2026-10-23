import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { inboxVersion } from "@/lib/inbox";

export const dynamic = "force-dynamic";

/** GET /api/admin/inbox/version[?thread=id] — tiny change marker polled by the live inbox screens. */
export async function GET(request: Request) {
  const gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (gate instanceof Response) return gate;
  const thread = new URL(request.url).searchParams.get("thread") || undefined;
  return NextResponse.json({ v: await inboxVersion(thread) }, { headers: { "Cache-Control": "no-store" } });
}
