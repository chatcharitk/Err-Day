import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/admin/customers/[id]/membership  — register or renew membership
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: customerId } = await params;
    const { activatedAt: rawActivatedAt, expiresAt: rawExpiresAt, usagesAllowed, label } =
      await request.json();

    const activatedAt = rawActivatedAt ? new Date(rawActivatedAt) : new Date();
    const expiresAt   = rawExpiresAt ? new Date(rawExpiresAt) : null;

    const membership = await prisma.membership.upsert({
      where:  { customerId },
      update: {
        label:        label        ?? "สมาชิก",
        activatedAt,
        expiresAt,
        usagesUsed:   0,   // reset on renewal
        usagesAllowed: usagesAllowed ?? 0,
        updatedAt:    new Date(),
      },
      create: {
        customerId,
        label:        label        ?? "สมาชิก",
        points:       0,
        activatedAt,
        expiresAt,
        usagesUsed:   0,
        usagesAllowed: usagesAllowed ?? 0,
      },
    });

    return NextResponse.json(membership, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to register membership" }, { status: 500 });
  }
}

// PATCH /api/admin/customers/[id]/membership  — update membership fields
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: customerId } = await params;
    const { activatedAt, expiresAt, usagesAllowed, usagesUsed, points, label } =
      await request.json();

    const membership = await prisma.membership.update({
      where: { customerId },
      data: {
        ...(label         !== undefined ? { label }                              : {}),
        ...(activatedAt   !== undefined ? { activatedAt: new Date(activatedAt) } : {}),
        ...(expiresAt     !== undefined ? { expiresAt: expiresAt ? new Date(expiresAt) : null } : {}),
        ...(usagesAllowed !== undefined ? { usagesAllowed }                      : {}),
        ...(usagesUsed    !== undefined ? { usagesUsed }                         : {}),
        ...(points        !== undefined ? { points }                             : {}),
      },
    });

    return NextResponse.json(membership);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update membership" }, { status: 500 });
  }
}

// DELETE /api/admin/customers/[id]/membership  — remove membership
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: customerId } = await params;
    await prisma.membership.delete({ where: { customerId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete membership" }, { status: 500 });
  }
}
