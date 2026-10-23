import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { draftReply } from "@/lib/inbox-ai";

export const maxDuration = 60;

/** POST /api/admin/inbox/[id]/draft — draft a fresh reply now (no debounce). */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (gate instanceof Response) return gate;
  const { id } = await params;
  const latest = await prisma.inboxMessage.findFirst({ where: { threadId: id, direction: "IN" }, orderBy: { createdAt: "desc" }, select: { id: true } });
  if (!latest) return NextResponse.json({ error: "ยังไม่มีข้อความจากลูกค้า" }, { status: 404 });
  const draft = await draftReply(id, latest.id);
  return NextResponse.json({ ok: !!draft && draft.status === "READY" });
}
