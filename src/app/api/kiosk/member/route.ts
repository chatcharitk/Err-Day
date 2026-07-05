import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getKioskBranch } from "@/lib/kiosk-auth";

const WALKIN_SERVICE = "svc-walkin";

/**
 * Member lookup for the desk's "วอร์คอิน สมาชิก" flow: find the customer by
 * phone, report membership validity (+ active packages as a hint for the
 * counter), and quote the effective walk-in (สระไดร์) price at this branch —
 * member price when the membership is valid, list price otherwise.
 * Branch-scoped via the kiosk cookie.
 */
export async function GET(request: Request) {
  const branch = await getKioskBranch();
  if (!branch) return NextResponse.json({ error: "Kiosk not armed" }, { status: 401 });

  const url = new URL(request.url);
  const phone = (url.searchParams.get("phone") ?? "").replace(/[\s-]/g, "");
  if (phone.length < 9) {
    return NextResponse.json({ error: "กรอกเบอร์โทรให้ครบ" }, { status: 400 });
  }

  // Inclusive expiry — a membership is valid through its expiresAt day (same
  // rule as the admin views).
  const todayUTC = new Date();
  todayUTC.setUTCHours(0, 0, 0, 0);

  const customer = await prisma.customer.findUnique({
    where: { phone },
    select: {
      id: true, name: true, nickname: true,
      membership: {
        select: { expiresAt: true, pendingActivation: true, usagesUsed: true, usagesAllowed: true },
      },
      packages: {
        where:  { closedAt: null, pendingActivation: false, expiresAt: { gte: todayUTC } },
        select: { packageSku: true, expiresAt: true, usagesUsed: true, usageLimit: true },
        orderBy: { expiresAt: "asc" },
        take: 3,
      },
    },
  });
  if (!customer) {
    return NextResponse.json({ error: "ไม่พบลูกค้าเบอร์นี้" }, { status: 404 });
  }

  const mem = customer.membership;
  const isMember = !!mem
    && !mem.pendingActivation
    && !(mem.expiresAt != null && mem.expiresAt < todayUTC)
    && !(mem.usagesAllowed > 0 && mem.usagesUsed >= mem.usagesAllowed);

  const bs = await prisma.branchService.findUnique({
    where:  { branchId_serviceId: { branchId: branch.id, serviceId: WALKIN_SERVICE } },
    select: { price: true, isActive: true, service: { select: { memberPrice: true, memberDiscountPercent: true } } },
  });
  if (!bs || !bs.isActive) {
    return NextResponse.json({ error: "ไม่พบบริการสระไดร์ในสาขา" }, { status: 404 });
  }

  let price = bs.price;
  if (isMember) {
    let memberPrice = bs.price;
    if (bs.service.memberPrice != null) {
      memberPrice = bs.service.memberPrice;
    } else if (bs.service.memberDiscountPercent > 0) {
      memberPrice = Math.round(bs.price * (1 - bs.service.memberDiscountPercent / 100));
    }
    price = Math.min(bs.price, memberPrice);
  }

  return NextResponse.json({
    customer:    { id: customer.id, name: customer.name, nickname: customer.nickname },
    isMember,
    memberUntil: isMember ? (mem!.expiresAt?.toISOString() ?? null) : null,
    packages:    customer.packages.map(p => ({
      sku:        p.packageSku,
      expiresAt:  p.expiresAt.toISOString(),
      usagesLeft: p.usageLimit > 0 ? Math.max(0, p.usageLimit - p.usagesUsed) : null,
    })),
    price,
  });
}
