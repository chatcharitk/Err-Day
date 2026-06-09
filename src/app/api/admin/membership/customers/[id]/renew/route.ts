import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { activateOrRenewMembership, MEMBERSHIP_PRICE_SATANG } from "@/lib/membership";
import { sendMembershipActivated } from "@/lib/notifications";

/** POST /api/admin/membership/customers/[id]/renew
 *  Manual admin renewal — extends membership +30 days, resets cycle counter,
 *  and writes a MembershipCycle row marked as "Manual" (no payment captured).
 *
 *  Use this for edge cases (free renewal, fixing mistakes). The primary path
 *  for renewal is the POS — staff sells the membership SKU.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: customerId } = await params;

  const existing = await prisma.membership.findUnique({ where: { customerId } });
  if (!existing) {
    return NextResponse.json({ error: "Membership not found" }, { status: 404 });
  }

  // Optional override: { paidAmount, notes } in body
  let paidAmount = 0; // manual renewals default to ฿0 (no payment captured)
  let notes: string | undefined;
  try {
    const body = await request.json();
    if (typeof body.paidAmount === "number") paidAmount = body.paidAmount;
    if (typeof body.notes === "string")      notes      = body.notes;
  } catch { /* no body */ }

  const { membership, cycle, renewed } = await activateOrRenewMembership({
    customerId,
    paidAmount,
    paymentMethod: "Manual",
    notes:         notes ?? "Manual renew via admin",
  });

  // Send the LINE confirmation flex (deduped per cycle). Fire-and-forget so a
  // LINE failure never blocks the renewal.
  sendMembershipActivated(membership.id, { cycleId: cycle.id, renewed })
    .catch((e) => console.error("[notify] membership renew flex failed", e));

  return NextResponse.json({ membership, cycle, defaultPrice: MEMBERSHIP_PRICE_SATANG });
}
