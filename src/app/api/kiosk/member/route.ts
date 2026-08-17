import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getKioskBranch } from "@/lib/kiosk-auth";

const WALKIN_SERVICE = "svc-walkin";

/**
 * Member list / lookup for the desk's "วอร์คอิน สมาชิก" flow.
 *
 * GET /api/kiosk/member            → ALL activated members (the modal's
 *                                    dropdown list; active first, then lapsed)
 * GET /api/kiosk/member?q=<text>   → name/nickname/phone lookup (any customer)
 *
 * Every entry carries membership validity, active packages (a hint for the
 * counter), and the effective walk-in (สระไดร์) price at this branch —
 * member price when the membership is valid. Synthetic walk-in/POS
 * placeholder customers are excluded. Branch-scoped via the kiosk cookie.
 */
export async function GET(request: Request) {
  const branch = await getKioskBranch();
  if (!branch) return NextResponse.json({ error: "Kiosk not armed" }, { status: 401 });

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const listMode = q.length === 0;
  if (!listMode && q.length < 2) {
    return NextResponse.json({ error: "พิมพ์อย่างน้อย 2 ตัวอักษร" }, { status: 400 });
  }

  // Inclusive expiry — a membership is valid through its expiresAt day (same
  // rule as the admin views).
  const todayUTC = new Date();
  todayUTC.setUTCHours(0, 0, 0, 0);

  const customers = await prisma.customer.findMany({
    where: {
      ...(listMode
        // List mode: everyone who has an ACTIVATED membership (current or lapsed).
        ? { membership: { is: { pendingActivation: false } } }
        : {
            OR: [
              { name:     { contains: q, mode: "insensitive" } },
              { nickname: { contains: q, mode: "insensitive" } },
              { phone:    { contains: q.replace(/[\s-]/g, "") } },
            ],
          }),
      // Hide the synthetic placeholder customers created by desk walk-ins/POS.
      NOT: [
        { phone: { startsWith: "walkin-" } },
        { phone: { startsWith: "pos-" } },
      ],
    },
    orderBy: { name: "asc" },
    take: listMode ? 500 : 6,
    select: {
      id: true, name: true, nickname: true, phone: true,
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
  if (!listMode && customers.length === 0) {
    return NextResponse.json({ error: "ไม่พบลูกค้า — ลองสะกดชื่อหรือเบอร์อีกครั้ง" }, { status: 404 });
  }

  const bs = await prisma.branchService.findUnique({
    where:  { branchId_serviceId: { branchId: branch.id, serviceId: WALKIN_SERVICE } },
    select: { price: true, isActive: true, service: { select: { memberPrice: true, memberDiscountPercent: true } } },
  });
  if (!bs || !bs.isActive) {
    return NextResponse.json({ error: "ไม่พบบริการสระไดร์ในสาขา" }, { status: 404 });
  }

  const results = customers.map((c) => {
    const mem = c.membership;
    const usablePackages = c.packages.filter(p =>
      p.usageLimit === 0 || p.usagesUsed < p.usageLimit
    );
    // Three states for the counter: active member / used to be a member
    // (expired or used up) / never a member. A pending (not yet activated)
    // signup counts as "none" — no member price until it's activated at POS.
    let memberStatus: "active" | "expired" | "none" = "none";
    if (mem && !mem.pendingActivation) {
      const lapsed = (mem.expiresAt != null && mem.expiresAt < todayUTC)
        || (mem.usagesAllowed > 0 && mem.usagesUsed >= mem.usagesAllowed);
      memberStatus = lapsed ? "expired" : "active";
    }
    // An active package also grants member pricing, even without a separate
    // ฿990 membership record.
    if (usablePackages.length > 0) memberStatus = "active";

    let price = bs.price;
    if (memberStatus === "active") {
      let memberPrice = bs.price;
      if (bs.service.memberPrice != null) {
        memberPrice = bs.service.memberPrice;
      } else if (bs.service.memberDiscountPercent > 0) {
        memberPrice = Math.round(bs.price * (1 - bs.service.memberDiscountPercent / 100));
      }
      price = Math.min(bs.price, memberPrice);
    }

    return {
      customer:     { id: c.id, name: c.name, nickname: c.nickname, phone: c.phone },
      memberStatus,
      // Active: valid-through date. Expired: when it lapsed (for the card text).
      memberUntil:  memberStatus !== "none"
        ? (mem?.expiresAt?.toISOString() ?? usablePackages[0]?.expiresAt.toISOString() ?? null)
        : null,
      packages:     usablePackages.map(p => ({
        sku:        p.packageSku,
        expiresAt:  p.expiresAt.toISOString(),
        usagesLeft: p.usageLimit > 0 ? Math.max(0, p.usageLimit - p.usagesUsed) : null,
      })),
      price,
    };
  });

  // The walk-in dropdown lists CURRENT members only — expired/lapsed ones are
  // dropped (already name-sorted by the query). The q= search path is untouched,
  // so staff can still look up a lapsed member by name to renew.
  if (listMode) {
    return NextResponse.json({ results: results.filter(r => r.memberStatus === "active") });
  }

  return NextResponse.json({ results });
}
