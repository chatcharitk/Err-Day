import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { InboxSendError, markAnsweredInLineOa } from "@/lib/inbox";

/** POST /api/admin/inbox/[id]/answered — { text? } → the owner already replied in LINE OA Manager. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (gate instanceof Response) return gate;
  const { id } = await params;
  const b = await request.json().catch(() => ({})) as { text?: unknown };
  try {
    await markAnsweredInLineOa(id, typeof b.text === "string" ? b.text : null, gate.username);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof InboxSendError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
