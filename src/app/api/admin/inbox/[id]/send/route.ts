import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { InboxSendError, sendInboxReply } from "@/lib/inbox";

/** POST /api/admin/inbox/[id]/send — { bubbles: string[], images?: string[], draftId? } → sends to the customer on LINE. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (gate instanceof Response) return gate;
  const { id } = await params;
  const b = await request.json().catch(() => null) as { bubbles?: unknown; images?: unknown; draftId?: unknown } | null;
  if (!b || !Array.isArray(b.bubbles) || !b.bubbles.every(x => typeof x === "string")) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  try {
    const r = await sendInboxReply(id, b.bubbles as string[], {
      draftId: typeof b.draftId === "string" ? b.draftId : null, sentBy: gate.username,
      images: Array.isArray(b.images) ? b.images.filter((x): x is string => typeof x === "string") : [],
    });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    if (e instanceof InboxSendError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
