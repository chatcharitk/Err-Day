import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { activateHeldMembership } from "@/lib/membership";

// POST /api/admin/customers/[id]/membership  — register or renew membership
//
// Renewal-in-advance behavior:
//   If the customer already has an ACTIVE (non-expired, non-pending) membership,
//   we EXTEND the existing expiresAt by the new period (rawExpiresAt - now)
//   instead of overwriting. This lets staff sell renewals before expiry without
//   the customer losing their remaining days.
//
//   If the existing membership is expired/pending, we reset it to the new dates.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const _gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (_gate instanceof Response) return _gate;

  try {
    const { id: customerId } = await params;
    const { activatedAt: rawActivatedAt, expiresAt: rawExpiresAt, usagesAllowed, label, pendingActivation } =
      await request.json();

    const activatedAt = rawActivatedAt ? new Date(rawActivatedAt) : new Date();
    const newExpiresAt = rawExpiresAt ? new Date(rawExpiresAt) : null;
    const pending     = !!pendingActivation;

    const existing = await prisma.membership.findUnique({ where: { customerId } });

    // Detect "renewal-in-advance": existing membership is still valid (not expired, not pending)
    // and a finite expiresAt is supplied for the new period.
    const now = new Date();
    const existingActive = !!existing
      && !existing.pendingActivation
      && (existing.expiresAt == null || existing.expiresAt > now);

    let finalExpiresAt: Date | null = newExpiresAt;
    let finalActivatedAt = activatedAt;
    if (existingActive && newExpiresAt && existing.expiresAt && !pending) {
      // Extend: add the new period (now → newExpiresAt) on top of remaining time.
      const periodMs = newExpiresAt.getTime() - now.getTime();
      if (periodMs > 0) {
        finalExpiresAt = new Date(existing.expiresAt.getTime() + periodMs);
      }
      // Keep the original activation date so customer history is preserved
      finalActivatedAt = existing.activatedAt;
    }

    // Run upsert + cycle creation atomically so the purchase history stays consistent.
    const result = await prisma.$transaction(async (tx) => {
      const membership = await tx.membership.upsert({
        where:  { customerId },
        update: {
          label:        label        ?? "สมาชิก",
          activatedAt:  finalActivatedAt,
          expiresAt:    finalExpiresAt,
          // Preserve usagesUsed when extending (renewal in advance), reset otherwise.
          ...(existingActive && !pending ? {} : { usagesUsed: 0 }),
          usagesAllowed: usagesAllowed ?? 0,
          pendingActivation: pending,
          updatedAt:    new Date(),
        },
        create: {
          customerId,
          label:        label        ?? "สมาชิก",
          points:       0,
          activatedAt:  finalActivatedAt,
          expiresAt:    finalExpiresAt,
          usagesUsed:   0,
          usagesAllowed: usagesAllowed ?? 0,
          pendingActivation: pending,
        },
      });

      // Always log a MembershipCycle for the manual registration so the purchase
      // history shows what was entered. paymentMethod="Manual" + paidAmount=0
      // distinguishes admin entries from POS sales.
      //
      // Renewal-in-advance (extending an existing active membership): close the
      // previous open cycle first, then create a new one for the extension period.
      if (existingActive && !pending && newExpiresAt && existing) {
        const bookingsUsed = await tx.booking.count({
          where: {
            customerId,
            status: "COMPLETED",
            ...(existing.activatedAt ? { date: { gte: existing.activatedAt } } : {}),
          },
        });
        await tx.membershipCycle.updateMany({
          where: { membershipId: existing.id, closedAt: null },
          data:  { closedAt: now, bookingsUsed },
        });
      }

      await tx.membershipCycle.create({
        data: {
          customerId,
          membershipId:  membership.id,
          startedAt:     finalActivatedAt,
          endedAt:       finalExpiresAt ?? finalActivatedAt, // fallback when no expiry
          paidAmount:    0,
          paymentMethod: "Manual",
          notes:         "Manual entry via admin",
        },
      });

      return membership;
    });

    return NextResponse.json({ ...result, extended: existingActive && !pending && newExpiresAt != null }, { status: 201 });
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
  const _gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (_gate instanceof Response) return _gate;

  try {
    const { id: customerId } = await params;
    const { activatedAt, expiresAt, usagesAllowed, usagesUsed, points, label, pendingActivation, activate } =
      await request.json();

    // Activate a held (pre-paid, pending) membership: starts a fresh 30-day
    // window today and fixes the open prepayment cycle. Used by the customer
    // screen's "เปิดใช้งาน" button so the return-visit clock starts correctly.
    if (activate) {
      const membership = await activateHeldMembership(customerId);
      return NextResponse.json(membership);
    }

    const membership = await prisma.membership.update({
      where: { customerId },
      data: {
        ...(label             !== undefined ? { label }                              : {}),
        ...(activatedAt       !== undefined ? { activatedAt: new Date(activatedAt) } : {}),
        ...(expiresAt         !== undefined ? { expiresAt: expiresAt ? new Date(expiresAt) : null } : {}),
        ...(usagesAllowed     !== undefined ? { usagesAllowed }                      : {}),
        ...(usagesUsed        !== undefined ? { usagesUsed }                         : {}),
        ...(points            !== undefined ? { points }                             : {}),
        ...(pendingActivation !== undefined ? { pendingActivation: !!pendingActivation } : {}),
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
  const _gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (_gate instanceof Response) return _gate;

  try {
    const { id: customerId } = await params;

    const membership = await prisma.membership.findUnique({
      where:  { customerId },
      select: { id: true },
    });
    // Already gone — treat as success so the UI stays idempotent.
    if (!membership) return NextResponse.json({ ok: true, alreadyGone: true });

    // MembershipCycle rows reference Membership without onDelete: Cascade, so a
    // bare membership.delete() fails with a foreign-key violation for any
    // customer who has renewal/purchase history. Remove the cycles first, then
    // the membership, atomically.
    await prisma.$transaction([
      prisma.membershipCycle.deleteMany({ where: { membershipId: membership.id } }),
      prisma.membership.delete({ where: { id: membership.id } }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete membership" }, { status: 500 });
  }
}
