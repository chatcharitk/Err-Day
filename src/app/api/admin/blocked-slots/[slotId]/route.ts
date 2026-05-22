import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** DELETE /api/admin/blocked-slots/[slotId] */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ slotId: string }> },
) {
  const { slotId } = await params;
  try {
    await prisma.blockedSlot.delete({ where: { id: slotId } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
