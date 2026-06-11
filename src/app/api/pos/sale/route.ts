import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { MEMBERSHIP_SKU, activateOrRenewMembership } from "@/lib/membership";
import { isPackageSku, activatePackage, redeemPackage } from "@/lib/packages";
import { sendMembershipActivated, sendPackageActivated, sendStaffMembershipAlert } from "@/lib/notifications";

interface SaleItem {
  name:             string;
  price:            number;
  branchServiceId?: string; // for service items, the BranchService row id
  /** When set, this item was redeemed against an active package and was free. */
  redeemPackageId?: string;
}

export async function POST(request: Request) {
  const _gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (_gate instanceof Response) return _gate;

  try {
    const body = await request.json();
    const { branchId, customerName, customerPhone, items, notes, fromBookingId } = body as {
      branchId:       string;
      customerName:   string;
      customerPhone?: string;
      items:          SaleItem[];
      notes?:         string;
      fromBookingId?: string;
    };

    if (!branchId || !customerName || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");

    // Server runs in UTC — shift to Asia/Bangkok (UTC+7) for correct local time
    const bangkokNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    const bkHr  = bangkokNow.getUTCHours();
    const bkMin = bangkokNow.getUTCMinutes();

    // Store date as UTC noon of the Bangkok calendar day
    const localDateStr = `${bangkokNow.getUTCFullYear()}-${pad(bangkokNow.getUTCMonth() + 1)}-${pad(bangkokNow.getUTCDate())}`;
    const date = new Date(localDateStr + "T12:00:00Z");

    const startTime = `${pad(bkHr)}:${pad(bkMin)}`;
    const endTime   = `${pad((bkHr + 1) % 24)}:${pad(bkMin)}`;

    const totalPrice = items.reduce((s, i) => s + i.price, 0);

    // Encode the actual items in notes
    const itemSummary = items
      .map(i => `${i.name}: ฿${(i.price / 100).toLocaleString()}`)
      .join("\n");
    const fullNotes = [itemSummary, notes].filter(Boolean).join("\n---\n");

    // ── Detect membership / package SKUs in cart ───────────────────────
    // We resolve serviceIds from the BranchService rows referenced in items.
    let membershipItem: { branchServiceId: string; price: number } | null = null;
    const packageItems: { branchServiceId: string; serviceId: string; price: number }[] = [];
    const branchServiceIds = items
      .map(i => i.branchServiceId)
      .filter((x): x is string => !!x);

    if (branchServiceIds.length > 0) {
      const bsRows = await prisma.branchService.findMany({
        where:  { id: { in: branchServiceIds } },
        select: { id: true, serviceId: true },
      });
      const bsMap = new Map(bsRows.map(r => [r.id, r.serviceId]));
      for (const it of items) {
        if (!it.branchServiceId) continue;
        const svcId = bsMap.get(it.branchServiceId);
        if (!svcId) continue;
        if (svcId === MEMBERSHIP_SKU) {
          if (!membershipItem) membershipItem = { branchServiceId: it.branchServiceId, price: it.price };
        } else if (isPackageSku(svcId)) {
          packageItems.push({ branchServiceId: it.branchServiceId, serviceId: svcId, price: it.price });
        }
      }
    }

    // Collect package redemptions to apply (one per item line that flagged itself)
    const redemptionIds = items
      .map(i => i.redeemPackageId)
      .filter((x): x is string => !!x);

    // ── If continuing from a booking ───────────────────────────────────
    if (fromBookingId) {
      const existing = await prisma.booking.findUnique({ where: { id: fromBookingId } });
      if (!existing) {
        return NextResponse.json({ error: "Booking not found" }, { status: 404 });
      }
      const booking = await prisma.booking.update({
        where: { id: fromBookingId },
        data: {
          status:     "COMPLETED",
          totalPrice,
          notes:      fullNotes || existing.notes,
          completedAt: now,
        },
        include: { branch: true, customer: true },
      });

      // If the cart contains a membership SKU, activate / renew
      if (membershipItem) {
        const m = await activateOrRenewMembership({
          customerId:    booking.customerId,
          paidAmount:    membershipItem.price,
          paymentMethod: "POS",
          bookingId:     booking.id,
        });
        // Fire & forget LINE confirmation — never block the sale on LINE failure
        if (m?.membership?.id) {
          sendMembershipActivated(m.membership.id, { cycleId: m.cycle?.id, renewed: m.renewed }).catch((e) => console.error("[notify] membership activated failed", e));
          sendStaffMembershipAlert(m.membership.id).catch((e) => console.error("[notify] staff membership alert failed", e));
        }
      }

      // Activate any package SKUs in the cart
      for (const p of packageItems) {
        const cp = await activatePackage({
          customerId:    booking.customerId,
          packageSku:    p.serviceId,
          paidAmount:    p.price,
          paymentMethod: "POS",
          bookingId:     booking.id,
        });
        if (cp?.id) {
          sendPackageActivated(cp.id).catch((e) => console.error("[notify] package activated failed", e));
        }
      }

      // Apply any package redemptions flagged by the cart
      for (const rid of redemptionIds) {
        await redeemPackage(rid);
      }

      return NextResponse.json(booking, { status: 200 });
    }

    // ── New walk-in sale ────────────────────────────────────────────────
    const walkinBs = await prisma.branchService.findFirst({
      where: { branchId, serviceId: "svc-walkin", isActive: true },
    });
    if (!walkinBs) {
      return NextResponse.json({ error: "Branch not configured" }, { status: 400 });
    }

    const phone = customerPhone?.trim() || `pos-${Date.now()}`;
    const customer = await prisma.customer.upsert({
      where:  { phone },
      update: { name: customerName },
      create: { name: customerName, phone },
    });

    // Detect "sale-only" carts: only membership/package items, no real services.
    // These are recorded as bookings (so they show in sales history) BUT their
    // serviceId points to the membership/package SKU itself — booking lists
    // filter these out so the mobile/desktop calendar doesn't get cluttered.
    const SALE_ONLY_SKUS = new Set([MEMBERSHIP_SKU, "svc-buffet", "svc-pkg5"]);
    const hasMembershipOrPackage = !!membershipItem || packageItems.length > 0;
    const allItemsAreSaleOnly = hasMembershipOrPackage
      && items.every(it => {
        if (!it.branchServiceId) return false;
        // Find the serviceId behind this branchServiceId
        // (already resolved earlier; checking via the maps used above)
        return false;
      });
    // Recompute by walking items more carefully:
    let nonSaleOnlyCount = 0;
    if (branchServiceIds.length > 0) {
      const bsRows2 = await prisma.branchService.findMany({
        where:  { id: { in: branchServiceIds } },
        select: { id: true, serviceId: true },
      });
      const bsMap2 = new Map(bsRows2.map(r => [r.id, r.serviceId]));
      for (const it of items) {
        const svcId = it.branchServiceId ? bsMap2.get(it.branchServiceId) : null;
        if (!svcId || !SALE_ONLY_SKUS.has(svcId)) nonSaleOnlyCount++;
      }
    } else {
      nonSaleOnlyCount = items.length;
    }
    const saleOnly = hasMembershipOrPackage && nonSaleOnlyCount === 0;
    void allItemsAreSaleOnly;

    // Pick serviceId: use the membership/package SKU for sale-only carts,
    // otherwise use walkin.
    let saleServiceId = walkinBs.serviceId;
    if (saleOnly) {
      if (membershipItem) saleServiceId = MEMBERSHIP_SKU;
      else if (packageItems.length > 0) saleServiceId = packageItems[0].serviceId;
    }

    const booking = await prisma.booking.create({
      data: {
        branchId,
        serviceId:   saleServiceId,
        staffId:     null,
        customerId:  customer.id,
        date,
        startTime,
        endTime,
        totalPrice,
        notes:       fullNotes || null,
        status:      "COMPLETED",
        completedAt: now,
      },
      include: { branch: true, customer: true },
    });

    if (membershipItem) {
      const m = await activateOrRenewMembership({
        customerId:    customer.id,
        paidAmount:    membershipItem.price,
        paymentMethod: "POS",
        bookingId:     booking.id,
      });
      if (m?.membership?.id) {
        sendMembershipActivated(m.membership.id, { cycleId: m.cycle?.id, renewed: m.renewed }).catch((e) => console.error("[notify] membership activated failed", e));
      }
    }

    for (const p of packageItems) {
      const cp = await activatePackage({
        customerId:    customer.id,
        packageSku:    p.serviceId,
        paidAmount:    p.price,
        paymentMethod: "POS",
        bookingId:     booking.id,
      });
      if (cp?.id) {
        sendPackageActivated(cp.id).catch((e) => console.error("[notify] package activated failed", e));
      }
    }

    for (const rid of redemptionIds) {
      await redeemPackage(rid);
    }

    return NextResponse.json(booking, { status: 201 });
  } catch (error) {
    console.error("POS sale error:", error);
    return NextResponse.json({ error: "Failed to create sale" }, { status: 500 });
  }
}
