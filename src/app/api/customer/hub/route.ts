import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyLineAccessToken } from "@/lib/line-auth";
import { findActivePackages } from "@/lib/packages";
import { startOfTodayUTC } from "@/lib/utils";
import { SALE_ONLY_SKUS } from "@/lib/capacity";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { lineAccessToken?: unknown } | null;
  const lineProfile = await verifyLineAccessToken(body?.lineAccessToken);
  if (!lineProfile) {
    return NextResponse.json({ error: "invalid_line_session" }, { status: 401 });
  }

  const customer = await prisma.customer.findUnique({
    where: { lineUserId: lineProfile.userId },
    include: {
      membership: true,
      bookings: {
        where: { serviceId: { notIn: SALE_ONLY_SKUS } },
        include: {
          branch: { select: { name: true } },
          service: { select: { name: true, nameTh: true, category: true } },
        },
        orderBy: [{ date: "desc" }, { startTime: "asc" }],
      },
    },
  });

  if (!customer) {
    return NextResponse.json({ customer: null, membership: null, packages: [], bookings: [] });
  }

  const activePackages = await findActivePackages(customer.id);
  const visibleMembership = customer.membership && !customer.membership.pendingActivation
    ? customer.membership
    : null;

  return NextResponse.json({
    customer: {
      name: customer.name,
      nickname: customer.nickname,
      phone: customer.phone,
      dateOfBirth: customer.dateOfBirth?.toISOString() ?? null,
    },
    membership: visibleMembership ? {
      label: visibleMembership.label,
      expiresAt: visibleMembership.expiresAt?.toISOString() ?? null,
      isExpired: visibleMembership.expiresAt ? visibleMembership.expiresAt < startOfTodayUTC() : false,
    } : null,
    packages: activePackages.map(item => ({
      id: item.id,
      nameTh: item.spec.nameTh,
      expiresAt: item.expiresAt.toISOString(),
      usagesLeft: item.usagesLeft,
      usageLimit: item.usageLimit,
    })),
    bookings: customer.bookings,
  });
}
