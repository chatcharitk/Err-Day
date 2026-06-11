import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

/** DELETE /api/admin/blocked-slots/[slotId] */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ slotId: string }> },
) {
  const _gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (_gate instanceof Response) return _gate;

  const { slotId } = await params;
  try {
    await prisma.blockedSlot.delete({ where: { id: slotId } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
