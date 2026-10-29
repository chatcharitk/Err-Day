import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/admin-auth";
import { hashKey, newAgentKey } from "@/lib/print-agent";

/**
 * POST { branchId }  → new key for that branch's print helper (the old one stops
 * working). The key is returned ONCE; only its hash is stored.
 * DELETE { branchId } → turn the branch's printing off.
 */
export async function POST(request: Request) {
  const gate = await requireOwner().catch((e: unknown) => e as Response);
  if (gate instanceof Response) return gate;
  const { branchId } = await request.json().catch(() => ({})) as { branchId?: string };
  if (!branchId) return NextResponse.json({ error: "เลือกสาขา" }, { status: 400 });
  const key = newAgentKey();
  const r = await prisma.branch.updateMany({ where: { id: branchId }, data: { printAgentKeyHash: hashKey(key), printAgentSeenAt: null } });
  if (r.count !== 1) return NextResponse.json({ error: "ไม่พบสาขา" }, { status: 404 });
  return NextResponse.json({ key });
}

export async function DELETE(request: Request) {
  const gate = await requireOwner().catch((e: unknown) => e as Response);
  if (gate instanceof Response) return gate;
  const { branchId } = await request.json().catch(() => ({})) as { branchId?: string };
  if (!branchId) return NextResponse.json({ error: "เลือกสาขา" }, { status: 400 });
  await prisma.branch.updateMany({ where: { id: branchId }, data: { printAgentKeyHash: null, printAgentSeenAt: null } });
  return NextResponse.json({ ok: true });
}
