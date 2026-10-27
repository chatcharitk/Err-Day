import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { MergeError, mergeCustomers } from "@/lib/customer-merge";

/**
 * GET  /api/admin/customers/[id]/merge — short summary used by the merge sheet.
 * POST /api/admin/customers/[id]/merge { removeId } — merge removeId INTO [id] (kept).
 */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (gate instanceof Response) return gate;
  const { id } = await params;
  const c = await prisma.customer.findUnique({
    where: { id },
    select: { id: true, name: true, nickname: true, phone: true, lineUserId: true, createdAt: true,
      membership: { select: { pendingActivation: true, expiresAt: true } }, _count: { select: { bookings: true } } },
  });
  if (!c) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({
    id: c.id, name: c.name, nickname: c.nickname, phone: c.phone, line: !!c.lineUserId, bookings: c._count.bookings,
    member: c.membership ? (c.membership.pendingActivation ? "รอเปิดใช้" : c.membership.expiresAt && c.membership.expiresAt < new Date() ? "หมดอายุ" : "ใช้งานได้") : null,
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (gate instanceof Response) return gate;
  const { id } = await params;
  const b = await request.json().catch(() => null) as { removeId?: string } | null;
  if (!b?.removeId) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  try {
    return NextResponse.json(await mergeCustomers(id, b.removeId, gate.name));
  } catch (e) {
    if (e instanceof MergeError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
