import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { bookFromDraft, InboxBookingError } from "@/lib/inbox-booking";

/** POST /api/admin/inbox/[id]/book — { draftId } → create the booking the AI prepared. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (gate instanceof Response) return gate;
  const { id } = await params;
  const b = await request.json().catch(() => null) as { draftId?: unknown } | null;
  if (typeof b?.draftId !== "string") return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, ...(await bookFromDraft(b.draftId, id)) });
  } catch (e) {
    if (e instanceof InboxBookingError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
