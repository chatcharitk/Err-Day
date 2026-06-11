import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { hashPin } from "@/lib/staff-auth";

/** PUT /api/admin/staff/[id]/passcode — set or reset a staff member's 4-digit PIN */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const _gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (_gate instanceof Response) return _gate;

  const { id } = await params;
  const { pin } = await request.json();

  if (typeof pin !== "string" || !/^\d{4}$/.test(pin)) {
    return NextResponse.json({ error: "PIN ต้องเป็นตัวเลข 4 หลัก" }, { status: 400 });
  }

  try {
    const hash = await hashPin(pin);
    await prisma.staff.update({ where: { id }, data: { passcodeHash: hash } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[staff passcode]", e);
    return NextResponse.json({ error: "Failed to set PIN" }, { status: 500 });
  }
}

/** DELETE — clear the PIN, blocking portal access */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const _gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (_gate instanceof Response) return _gate;

  const { id } = await params;
  await prisma.staff.update({ where: { id }, data: { passcodeHash: null } });
  return NextResponse.json({ ok: true });
}
