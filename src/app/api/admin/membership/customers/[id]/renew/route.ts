import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** POST /api/admin/membership/customers/[id]/renew
 *  Renews a customer's membership: extend expiresAt 30 days from today,
 *  reset usagesUsed to 0, and update activatedAt to now.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: customerId } = await params;

  const membership = await prisma.membership.findUnique({
    where: { customerId },
  });
  if (!membership) {
    return NextResponse.json({ error: "Membership not found" }, { status: 404 });
  }

  const now = new Date();
  const newExpiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // +30 days

  const updated = await prisma.membership.update({
    where: { customerId },
    data: {
      expiresAt:   newExpiry,
      activatedAt: now,
      usagesUsed:  0,
    },
    include: { tier: true },
  });

  return NextResponse.json(updated);
}
