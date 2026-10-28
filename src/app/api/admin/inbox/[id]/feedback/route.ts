import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { DRAFT_FEEDBACK_REASONS } from "@/lib/inbox-feedback";

/**
 * POST /api/admin/inbox/[threadId]/feedback { draftId, reasons, note? } — why the
 * owner edited (or didn't use) an AI draft. Feeds the reply-quality loop.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (gate instanceof Response) return gate;
  const { id: threadId } = await params;
  const b = await request.json().catch(() => null) as { draftId?: string; reasons?: unknown; note?: unknown } | null;
  if (!b?.draftId) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const reasons = Array.isArray(b.reasons) ? b.reasons.filter((r): r is string => typeof r === "string" && (DRAFT_FEEDBACK_REASONS as readonly string[]).includes(r)) : [];
  const note = typeof b.note === "string" && b.note.trim() ? b.note.trim().slice(0, 300) : null;
  const r = await prisma.inboxDraft.updateMany({
    where: { id: b.draftId, threadId },
    data: { feedback: reasons, feedbackNote: note, feedbackAt: new Date() },
  });
  if (!r.count) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
