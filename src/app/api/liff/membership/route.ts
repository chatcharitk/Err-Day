import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/liff/membership?lineUserId=xxx
// Public endpoint — returns membership status for a Line user
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lineUserId = searchParams.get("lineUserId");

  if (!lineUserId) {
    return NextResponse.json({ error: "lineUserId required" }, { status: 400 });
  }

  const customer = await prisma.customer.findUnique({
    where:   { lineUserId },
    include: {
      membership: { include: { tier: true } },
    },
  });

  if (!customer) {
    return NextResponse.json({ error: "ไม่พบลูกค้าในระบบ กรุณาจองผ่าน Line ก่อน" }, { status: 404 });
  }

  if (!customer.membership) {
    return NextResponse.json(
      { error: "ยังไม่มีสมาชิก สามารถสอบถามได้ที่ร้าน" },
      { status: 404 },
    );
  }

  const { membership } = customer;
  const now = new Date();
  const isExpired = membership.expiresAt ? membership.expiresAt < now : false;

  const effectiveMax = membership.usagesAllowed > 0
    ? membership.usagesAllowed
    : membership.tier.maxUsages;

  const isUsagesExhausted = effectiveMax > 0 && membership.usagesUsed >= effectiveMax;

  return NextResponse.json({
    customerName:      customer.name,
    tier: {
      name:            membership.tier.name,
      nameTh:          membership.tier.nameTh,
      color:           membership.tier.color,
      discountPercent: membership.tier.discountPercent,
    },
    points:            membership.points,
    activatedAt:       membership.activatedAt.toISOString(),
    expiresAt:         membership.expiresAt?.toISOString() ?? null,
    usagesUsed:        membership.usagesUsed,
    usagesAllowed:     membership.usagesAllowed,
    tierMaxUsages:     membership.tier.maxUsages,
    isExpired,
    isUsagesExhausted,
  });
}
