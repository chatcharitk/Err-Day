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
    include: { membership: true },
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
  const isUsagesExhausted =
    membership.usagesAllowed > 0 && membership.usagesUsed >= membership.usagesAllowed;

  // Fetch services that have a member discount
  const services = await prisma.service.findMany({
    where: { isActive: true, memberDiscountPercent: { gt: 0 } },
    select: {
      id: true,
      nameTh: true,
      name: true,
      memberDiscountPercent: true,
      branches: {
        where: { isActive: true },
        select: { price: true },
        orderBy: { price: "asc" },
        take: 1,
      },
    },
    orderBy: { nameTh: "asc" },
  });

  return NextResponse.json({
    customerName:   customer.name,
    label:          membership.label,
    points:         membership.points,
    activatedAt:    membership.activatedAt.toISOString(),
    expiresAt:      membership.expiresAt?.toISOString() ?? null,
    usagesUsed:     membership.usagesUsed,
    usagesAllowed:  membership.usagesAllowed,
    isExpired,
    isUsagesExhausted,
    services: services.map(s => ({
      id:                   s.id,
      nameTh:               s.nameTh || s.name,
      memberDiscountPercent: s.memberDiscountPercent,
      basePrice:            s.branches[0]?.price ?? null,
    })),
  });
}
