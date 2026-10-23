import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { draftReply } from "@/lib/inbox-ai";

export const maxDuration = 60;

/**
 * POST /api/admin/inbox/[id]/draft — draft a fresh reply now (no debounce).
 * Optional body { instruction, previous } rewrites the last draft ("สั้นลง", …).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (gate instanceof Response) return gate;
  const { id } = await params;
  const latest = await prisma.inboxMessage.findFirst({ where: { threadId: id, direction: "IN" }, orderBy: { createdAt: "desc" }, select: { id: true } });
  if (!latest) return NextResponse.json({ error: "ยังไม่มีข้อความจากลูกค้า" }, { status: 404 });
  const b = await request.json().catch(() => ({})) as { instruction?: unknown; previous?: unknown };
  const draft = await draftReply(id, latest.id, {
    instruction: typeof b.instruction === "string" ? b.instruction : undefined,
    previous: Array.isArray(b.previous) ? b.previous.filter((x): x is string => typeof x === "string") : undefined,
  });
  return NextResponse.json({ ok: !!draft && draft.status === "READY" });
}
