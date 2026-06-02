/**
 * PATCH  /api/admin/addons/[id]   — partial update
 *   body: any of { name, nameTh, price (baht), isActive }
 * DELETE /api/admin/addons/[id]   — soft delete (sets isActive=false).
 *   Hard delete is avoided so historical BookingAddon rows keep their FK valid.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();
  const { name, nameTh, price, isActive } = body;

  try {
    const addon = await prisma.serviceAddon.update({
      where: { id },
      data: {
        ...(name     !== undefined ? { name:     String(name).trim()   } : {}),
        ...(nameTh   !== undefined ? { nameTh:   String(nameTh).trim() } : {}),
        ...(price    !== undefined ? { price:    Math.round(Number(price) * 100) } : {}),
        ...(isActive !== undefined ? { isActive: Boolean(isActive)     } : {}),
      },
    });
    return NextResponse.json({ addon });
  } catch (e) {
    console.error("[addons PATCH]", e);
    return NextResponse.json({ error: "Failed to update addon" }, { status: 500 });
  }
}


export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    // Soft-delete to preserve BookingAddon history.
    await prisma.serviceAddon.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[addons DELETE]", e);
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
