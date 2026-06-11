/**
 * DELETE /api/admin/branches/[id]/capacity-overrides/[overrideId]
 *   — Remove a single override.
 */
import { requireAdmin } from "@/lib/admin-auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; overrideId: string }> },
) {
  const _gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (_gate instanceof Response) return _gate;

  const { id, overrideId } = await params;
  // Defensive: only delete if the override actually belongs to this branch
  const row = await prisma.capacityOverride.findUnique({ where: { id: overrideId } });
  if (!row || row.branchId !== id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.capacityOverride.delete({ where: { id: overrideId } });
  return NextResponse.json({ ok: true });
}
