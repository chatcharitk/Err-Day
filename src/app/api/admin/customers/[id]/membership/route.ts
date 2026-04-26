import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Helper: compute expiresAt from activatedAt + validityDays
function computeExpiry(activatedAt: Date, validityDays: number): Date | null {
  if (validityDays <= 0) return null; // never expires
  const d = new Date(activatedAt);
  d.setDate(d.getDate() + validityDays);
  return d;
}

// POST /api/admin/customers/[id]/membership  — register or renew membership
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: customerId } = await params;
    const { tierId, activatedAt: rawActivatedAt, usagesAllowed } = await request.json();

    if (!tierId) {
      return NextResponse.json({ error: "tierId required" }, { status: 400 });
    }

    const tier = await prisma.membershipTier.findUnique({ where: { id: tierId } });
    if (!tier) {
      return NextResponse.json({ error: "Tier not found" }, { status: 404 });
    }

    const activatedAt = rawActivatedAt ? new Date(rawActivatedAt) : new Date();
    const expiresAt   = computeExpiry(activatedAt, tier.validityDays);
    const allowed     = usagesAllowed !== undefined ? usagesAllowed : 0;

    // Upsert — create if missing, renew if already exists
    const membership = await prisma.membership.upsert({
      where:  { customerId },
      update: {
        tierId,
        activatedAt,
        expiresAt,
        usagesUsed:   0,   // reset on renewal
        usagesAllowed: allowed,
        updatedAt:    new Date(),
      },
      create: {
        customerId,
        tierId,
        points:       0,
        activatedAt,
        expiresAt,
        usagesUsed:   0,
        usagesAllowed: allowed,
      },
      include: { tier: true },
    });

    return NextResponse.json(membership, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to register membership" }, { status: 500 });
  }
}

// PATCH /api/admin/customers/[id]/membership  — update membership (extend, change tier, etc.)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: customerId } = await params;
    const body = await request.json();
    const { tierId, activatedAt: rawActivatedAt, expiresAt: rawExpiresAt, usagesAllowed, usagesUsed, points } = body;

    const current = await prisma.membership.findUnique({
      where:   { customerId },
      include: { tier: true },
    });
    if (!current) {
      return NextResponse.json({ error: "Membership not found" }, { status: 404 });
    }

    // If a new tierId or activatedAt is given, recompute expiresAt unless explicitly overridden
    let newExpiresAt = current.expiresAt;
    if (rawExpiresAt !== undefined) {
      newExpiresAt = rawExpiresAt ? new Date(rawExpiresAt) : null;
    } else if (tierId || rawActivatedAt) {
      const tier = tierId
        ? await prisma.membershipTier.findUnique({ where: { id: tierId } })
        : current.tier;
      const base = rawActivatedAt ? new Date(rawActivatedAt) : current.activatedAt;
      newExpiresAt = tier ? computeExpiry(base, tier.validityDays) : null;
    }

    const membership = await prisma.membership.update({
      where: { customerId },
      data: {
        ...(tierId         !== undefined ? { tierId }                          : {}),
        ...(rawActivatedAt !== undefined ? { activatedAt: new Date(rawActivatedAt) } : {}),
        ...(newExpiresAt   !== undefined ? { expiresAt:   newExpiresAt }       : {}),
        ...(usagesAllowed  !== undefined ? { usagesAllowed }                   : {}),
        ...(usagesUsed     !== undefined ? { usagesUsed }                      : {}),
        ...(points         !== undefined ? { points }                          : {}),
      },
      include: { tier: true },
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
