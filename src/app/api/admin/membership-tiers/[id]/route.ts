import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PATCH /api/admin/membership-tiers/[id]  — update tier
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { name, nameTh, minPoints, discountPercent, color, validityDays, maxUsages, isActive } =
      await request.json();

    const tier = await prisma.membershipTier.update({
      where: { id },
      data: {
        ...(name            !== undefined ? { name:            name.trim()            } : {}),
        ...(nameTh          !== undefined ? { nameTh:          nameTh.trim()          } : {}),
        ...(minPoints       !== undefined ? { minPoints                               } : {}),
        ...(discountPercent !== undefined ? { discountPercent                         } : {}),
        ...(color           !== undefined ? { color                                   } : {}),
        ...(validityDays    !== undefined ? { validityDays                            } : {}),
        ...(maxUsages       !== undefined ? { maxUsages                               } : {}),
        ...(isActive        !== undefined ? { isActive                                } : {}),
      },
    });
    return NextResponse.json(tier);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update tier" }, { status: 500 });
  }
}

// DELETE /api/admin/membership-tiers/[id]  — soft delete
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await prisma.membershipTier.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete tier" }, { status: 500 });
  }
}
