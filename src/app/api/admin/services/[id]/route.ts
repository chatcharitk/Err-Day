import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { revalidateReferenceData } from "@/lib/revalidate";

// PATCH /api/admin/services/[id] — update service metadata
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const _gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (_gate instanceof Response) return _gate;

  try {
    const { id } = await params;
    const body = await request.json();
    const {
      name, nameTh, category, description, descriptionTh,
      advanceBookingRequired, memberPrice, memberDiscountPercent, isActive,
    } = body;

    const service = await prisma.service.update({
      where: { id },
      data: {
        ...(name       !== undefined ? { name }                                              : {}),
        ...(nameTh     !== undefined ? { nameTh }                                            : {}),
        ...(category   !== undefined ? { category }                                          : {}),
        ...(description   !== undefined ? { description:   description   || null }           : {}),
        ...(descriptionTh !== undefined ? { descriptionTh: descriptionTh || null }           : {}),
        ...(advanceBookingRequired !== undefined ? { advanceBookingRequired }                 : {}),
        ...(memberPrice !== undefined
          ? { memberPrice: memberPrice ? Math.round(Number(memberPrice) * 100) : null }
          : {}),
        ...(memberDiscountPercent !== undefined ? { memberDiscountPercent: Number(memberDiscountPercent) } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
      include: {
        branches: { include: { branch: true } },
      },
    });

    revalidateReferenceData();
    return NextResponse.json(service);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update service" }, { status: 500 });
  }
}

// DELETE /api/admin/services/[id] — soft delete
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const _gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (_gate instanceof Response) return _gate;

  try {
    const { id } = await params;
    await prisma.service.update({
      where: { id },
      data: { isActive: false },
    });
    revalidateReferenceData();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete service" }, { status: 500 });
  }
}
