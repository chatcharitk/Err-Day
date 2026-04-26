import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, phone, branchId, commissionRate, isActive } = body;

    const staff = await prisma.staff.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(phone !== undefined ? { phone: phone?.trim() || null } : {}),
        ...(branchId !== undefined ? { branchId } : {}),
        ...(commissionRate !== undefined ? { commissionRate: Number(commissionRate) } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
      include: { branch: true },
    });
    return NextResponse.json(staff);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update staff" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Soft delete
    await prisma.staff.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete staff" }, { status: 500 });
  }
}
