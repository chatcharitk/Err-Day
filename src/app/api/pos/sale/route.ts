import { after, NextResponse } from "next/server";
import { RETAIL_CATEGORY, RETAIL_SKU } from "@/lib/capacity";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { MEMBERSHIP_SKU, activateOrRenewMembership, holdMembershipPrepaid } from "@/lib/membership";
import { isPackageSku, activatePackage, redeemPackage } from "@/lib/packages";
import { sendMembershipActivated, sendPackageActivated, sendStaffMembershipAlert } from "@/lib/notifications";
import { issueReceiptForBooking, receiptUrl, type ReceiptLineInput } from "@/lib/receipts";
import { couponStatus } from "@/lib/coupons";
import { quoteCoupon, couponValueLabel, APP_USE_WINDOW_MS } from "@/lib/coupon-rules";

/**
 * Issue the receipt for a completed sale.
 *
 * Deliberately non-fatal: the money has already changed hands and the booking
 * is saved, so a receipt problem must never surface to the cashier as a failed
 * sale. Staff can re-issue from sales history if this ever returns null.
 */
async function attachReceipt(
  bookingId: string,
  opts: { items: ReceiptLineInput[]; paymentMethod: string; issuedByAdminId: string; issuedByName: string },
) {
  try {
    // POS holds the real, final sale — correct a stale receipt left over from
    // an earlier non-POS payment event (e.g. an admin "mark paid" toggle with
    // no item/discount detail) rather than silently keeping the wrong total.
    const receipt = await issueReceiptForBooking(bookingId, { ...opts, correctStaleTotal: true });
    if (!receipt) return null;
    return {
      id:          receipt.id,
      number:      receipt.number,
      publicToken: receipt.publicToken,
      url:         receiptUrl(receipt.publicToken),
    };
  } catch (e) {
    console.error("[pos/sale] receipt issue failed", e);
    return null;
  }
}

interface SaleItem {
  name:             string;
  /** Unit price in satang (already discounted). Negative for discount lines. */
  price:            number;
  /** Units sold on this line. Optional — older clients repeat the line instead. */
  qty?:             number;
  branchServiceId?: string; // for service items, the BranchService row id
  /** When set, this item was redeemed against an active package and was free. */
  redeemPackageId?: string;
  /** Coupon discount line. Its price is recomputed here, never trusted. */
  couponId?:        string;
}

/**
 * Validate the cart's coupon line, recompute its discount from the other lines
 * and claim one use. Returns null when the cart has no coupon. The claim is a
 * compare-and-set on usesUsed, so two tills can't spend the last use twice.
 */
async function claimCoupon(items: SaleItem[], customer: { id?: string; phone?: string }):
  Promise<{ couponId: string; discount: number; appRedemptionId?: string } | { error: string } | null> {
  const line = items.find(i => typeof i.couponId === "string" && i.couponId);
  if (!line) return null;
  const coupon = await prisma.coupon.findUnique({
    where: { id: line.couponId! }, include: { campaign: true, customer: { select: { id: true, phone: true } } },
  });
  if (!coupon) return { error: "ไม่พบคูปอง" };
  const owner = customer.id ? coupon.customerId === customer.id : !!customer.phone && coupon.customer.phone === customer.phone;
  if (!owner) return { error: "คูปองนี้ไม่ใช่ของลูกค้าคนนี้" };
  const status = couponStatus(coupon, coupon.campaign);
  // Torn in the customer's app a moment ago and not yet on a bill: this sale may take it.
  const appUse = status === "used" && !coupon.voidedAt
    ? await prisma.couponRedemption.findFirst({
        where: { couponId: coupon.id, source: "APP", bookingId: null, reversedAt: null, createdAt: { gte: new Date(Date.now() - APP_USE_WINDOW_MS) } },
        orderBy: { createdAt: "desc" },
      })
    : null;
  if (status !== "usable" && !appUse) {
    return { error: status === "used" ? "คูปองนี้ใช้ไปแล้ว" : status === "expired" ? "คูปองหมดอายุแล้ว" : status === "upcoming" ? "คูปองยังไม่เริ่มใช้" : "คูปองนี้ใช้ไม่ได้" };
  }

  const others = items.filter(i => i !== line);
  const bsIds = others.map(i => i.branchServiceId).filter((x): x is string => !!x);
  const bsRows = bsIds.length ? await prisma.branchService.findMany({
    where: { id: { in: bsIds } }, select: { id: true, serviceId: true, service: { select: { category: true } } },
  }) : [];
  const bsById = new Map(bsRows.map(r => [r.id, r]));
  const quote = quoteCoupon(coupon.campaign, others.map(i => {
    const bs = i.branchServiceId ? bsById.get(i.branchServiceId) : undefined;
    return { serviceId: bs?.serviceId ?? null, category: bs?.service.category ?? null, amountSatang: i.price * unitsOf(i) };
  }));
  // Never push the bill below zero alongside manual discounts.
  const billBefore = others.reduce((sum, i) => sum + i.price * unitsOf(i), 0);
  const discountSatang = Math.min(quote.discountSatang, Math.max(0, billBefore));
  if (discountSatang <= 0) return { error: `ใช้คูปองไม่ได้: ${quote.problem ?? "ไม่มีส่วนลด"}` };

  if (!appUse) {
    const claimed = await prisma.coupon.updateMany({
      where: { id: coupon.id, usesUsed: coupon.usesUsed, voidedAt: null },
      data:  { usesUsed: { increment: 1 } },
    });
    if (claimed.count !== 1) return { error: "คูปองนี้เพิ่งถูกใช้ไป กรุณาลองใหม่" };
  } else {
    // Reserve the torn redemption for this sale (a parallel till can't take it too).
    const taken = await prisma.couponRedemption.updateMany({ where: { id: appUse.id, bookingId: null }, data: { source: "APP-CLAIMED" } });
    if (taken.count !== 1) return { error: "คูปองนี้เพิ่งถูกใช้ไป กรุณาลองใหม่" };
  }

  // The authoritative amount and label replace whatever the till sent.
  line.price = -discountSatang;
  line.qty = 1;
  line.name = `คูปอง ${coupon.campaign.name} (${couponValueLabel(coupon.campaign)})`;
  return { couponId: coupon.id, discount: discountSatang, appRedemptionId: appUse?.id };
}

/** Units on a line, tolerating older clients that omit `qty` entirely. */
function unitsOf(item: SaleItem): number {
  const q = Number(item.qty);
  return Number.isFinite(q) && q > 0 ? q : 1;
}

/**
 * Record ค่าเชียร์ for this sale: which staff member talked the customer into a
 * cheer-eligible service. Amount comes from the service's configured rate (never
 * the client), × quantity, and is snapshotted on BookingCheer.
 */
async function recordCheers(bookingId: string, cheers: unknown) {
  const list = Array.isArray(cheers) ? cheers as { branchServiceId?: unknown; staffId?: unknown; qty?: unknown }[] : [];
  const valid = list.filter(c => typeof c.branchServiceId === "string" && typeof c.staffId === "string" && c.staffId);
  // No picks at the till keeps whatever the front desk already recorded.
  if (valid.length === 0) return;
  const [bsRows, staffRows] = await Promise.all([
    prisma.branchService.findMany({
      where: { id: { in: valid.map(c => c.branchServiceId as string) } },
      select: { id: true, serviceId: true, service: { select: { cheerSatang: true } } },
    }),
    prisma.staff.findMany({ where: { id: { in: valid.map(c => c.staffId as string) }, isActive: true }, select: { id: true, branchId: true } }),
  ]);
  const data = valid.flatMap(c => {
    const bs = bsRows.find(b => b.id === c.branchServiceId);
    const staff = staffRows.find(s => s.id === c.staffId);
    const qty = Math.max(1, Math.min(20, Math.round(Number(c.qty) || 1)));
    if (!bs || !staff || bs.service.cheerSatang <= 0) return [];
    return [{ bookingId, staffId: staff.id, serviceId: bs.serviceId, quantity: qty, amountSatang: bs.service.cheerSatang * qty }];
  });
  if (data.length === 0) return;
  // A till pick replaces any desk pick for the same treatment (no double pay).
  await prisma.bookingCheer.deleteMany({ where: { bookingId, serviceId: { in: data.map(d => d.serviceId) } } });
  await prisma.bookingCheer.createMany({ data });
}

export async function POST(request: Request) {
  const gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (gate instanceof Response) return gate;
  const admin = gate;
  // A coupon use claimed below; handed back if the sale then fails.
  let claimedCoupon: { couponId: string; discount: number; appRedemptionId?: string } | null = null;
  const recordCoupon = async (bookingId: string) => {
    if (!claimedCoupon) return;
    if (claimedCoupon.appRedemptionId) {
      // The coupon was torn in the app: attach that redemption to this bill.
      await prisma.couponRedemption.update({
        where: { id: claimedCoupon.appRedemptionId },
        data: { bookingId, discountSatang: claimedCoupon.discount, adminId: admin.id, source: "APP" },
      });
    } else {
      await prisma.couponRedemption.create({
        data: { couponId: claimedCoupon.couponId, bookingId, discountSatang: claimedCoupon.discount, adminId: admin.id },
      });
    }
    claimedCoupon = null;
  };
  const releaseCoupon = async () => {
    const c = claimedCoupon;
    claimedCoupon = null;
    if (!c) return;
    if (c.appRedemptionId) {
      // Sale failed: the torn coupon goes back to waiting for a bill.
      await prisma.couponRedemption.update({ where: { id: c.appRedemptionId }, data: { source: "APP" } }).catch(() => {});
    } else {
      await prisma.coupon.update({ where: { id: c.couponId }, data: { usesUsed: { decrement: 1 } } }).catch(() => {});
    }
  };

  try {
    const body = await request.json();
    const { branchId, customerName, customerPhone, items, notes, fromBookingId, holdMembership, paymentMethod, cheers } = body as {
      /** ค่าเชียร์ picks: [{ branchServiceId, staffId, qty }]. */
      cheers?: unknown;
      branchId:       string;
      customerName:   string;
      customerPhone?: string;
      items:          SaleItem[];
      notes?:         string;
      fromBookingId?: string;
      /** "Pay now, activate later": record the ฿990 but park the membership as
       *  pending (30-day clock starts when staff activate on the return visit). */
      holdMembership?: boolean;
      /** How the customer paid — printed on the receipt. Defaults to cash. */
      paymentMethod?: string;
    };

    if (!branchId || !customerName || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Coupon first: it rewrites its own line, which the totals below read.
    let couponOwnerId: string | undefined;
    if (fromBookingId) {
      couponOwnerId = (await prisma.booking.findUnique({ where: { id: fromBookingId }, select: { customerId: true } }))?.customerId;
    }
    const couponClaim = await claimCoupon(items, { id: couponOwnerId, phone: customerPhone?.trim() || undefined });
    if (couponClaim && "error" in couponClaim) {
      return NextResponse.json({ error: couponClaim.error }, { status: 400 });
    }
    claimedCoupon = couponClaim;

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

    const totalPrice = items.reduce((s, i) => s + i.price * unitsOf(i), 0);
    // Cash is the counter default; older clients send nothing at all.
    const payMethod = paymentMethod?.trim() || "เงินสด";

    // Encode the actual items in notes (unchanged format for qty 1 so existing
    // sales-history rows and the CSV export keep reading the same).
    const itemSummary = items
      .map(i => {
        const units = unitsOf(i);
        const label = units > 1 ? `${i.name} x${units}` : i.name;
        return `${label}: ฿${((i.price * units) / 100).toLocaleString()}`;
      })
      .join("\n");
    const fullNotes = [itemSummary, notes].filter(Boolean).join("\n---\n");

    // Structured lines for the receipt — the whole reason the cart now sends
    // qty instead of repeating a line N times.
    const receiptLines = items.map(i => {
      const units = unitsOf(i);
      return {
        description:     i.name,
        quantity:        units,
        unitPriceSatang: i.price,
        totalSatang:     i.price * units,
      };
    });

    // ── Detect membership / package SKUs in cart ───────────────────────
    // We resolve serviceIds from the BranchService rows referenced in items.
    let membershipItem: { branchServiceId: string; price: number } | null = null;
    const packageItems: { branchServiceId: string; serviceId: string; price: number }[] = [];
    const branchServiceIds = items
      .map(i => i.branchServiceId)
      .filter((x): x is string => !!x);

    // branchServiceId → serviceId, resolved once and reused below for the
    // sale-only-cart detection (avoids a second identical query).
    const bsMap = new Map<string, string>();
    // Services in the retail-products category (sold over the counter, not appointments).
    const retailServiceIds = new Set<string>();
    if (branchServiceIds.length > 0) {
      const bsRows = await prisma.branchService.findMany({
        where:  { id: { in: branchServiceIds } },
        select: { id: true, serviceId: true, service: { select: { category: true } } },
      });
      for (const r of bsRows) {
        bsMap.set(r.id, r.serviceId);
        if (r.service.category === RETAIL_CATEGORY) retailServiceIds.add(r.serviceId);
      }
      for (const it of items) {
        if (!it.branchServiceId) continue;
        const svcId = bsMap.get(it.branchServiceId);
        if (!svcId) continue;
        if (svcId === MEMBERSHIP_SKU) {
          if (!membershipItem) membershipItem = { branchServiceId: it.branchServiceId, price: it.price };
        } else if (isPackageSku(svcId)) {
          // One activation per unit — the cart now sends qty instead of
          // repeating the line, so expand it back out here.
          for (let n = 0; n < unitsOf(it); n++) {
            packageItems.push({ branchServiceId: it.branchServiceId, serviceId: svcId, price: it.price });
          }
        }
      }
    }

    // Collect package redemptions to apply — one per UNIT sold, so a qty-2 line
    // still burns two uses exactly as the old repeated-line format did.
    const redemptionIds = items.flatMap(i =>
      i.redeemPackageId ? Array<string>(unitsOf(i)).fill(i.redeemPackageId) : [],
    );

    // ── If continuing from a booking ───────────────────────────────────
    if (fromBookingId) {
      const existing = await prisma.booking.findUnique({ where: { id: fromBookingId } });
      if (!existing) {
        await releaseCoupon();
        return NextResponse.json({ error: "Booking not found" }, { status: 404 });
      }
      const booking = await prisma.booking.update({
        where: { id: fromBookingId },
        data: {
          status:     "COMPLETED",
          totalPrice,
          // Checkout details are operational and must not overwrite the note
          // that the customer sees.
          internalNotes: fullNotes || existing.internalNotes,
          completedAt: now,
          // POS checkout = money received. Keep an earlier payment time if a
          // transfer slip was already confirmed for this booking.
          paidAt:      existing.paidAt ?? now,
        },
        include: { branch: true, customer: true },
      });

      // If the cart contains a membership SKU: hold (pay-now-activate-later) or
      // activate/renew immediately.
      if (membershipItem) {
        if (holdMembership) {
          // Payment recorded; membership parked pending. No "activated" LINE —
          // it isn't active until staff open the customer and tap เปิดใช้งาน.
          await holdMembershipPrepaid({
            customerId:    booking.customerId,
            paidAmount:    membershipItem.price,
            paymentMethod: "POS",
            bookingId:     booking.id,
          });
        } else {
          const m = await activateOrRenewMembership({
            customerId:    booking.customerId,
            paidAmount:    membershipItem.price,
            paymentMethod: "POS",
            bookingId:     booking.id,
          });
          // Fire & forget LINE confirmation — never block the sale on LINE failure
          if (m?.membership?.id) {
            after(() => sendMembershipActivated(m.membership.id, { cycleId: m.cycle?.id, renewed: m.renewed }).catch((e) => console.error("[notify] membership activated failed", e)));
            after(() => sendStaffMembershipAlert(m.membership.id).catch((e) => console.error("[notify] staff membership alert failed", e)));
          }
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
          countFirstUse: true, // 5-pack: count the first visit on purchase
        });
        if (cp?.id) {
          after(() => sendPackageActivated(cp.id).catch((e) => console.error("[notify] package activated failed", e)));
        }
      }

      // Apply any package redemptions flagged by the cart
      for (const rid of redemptionIds) {
        await redeemPackage(rid);
      }

      await recordCoupon(booking.id);
      await recordCheers(booking.id, cheers);
      const receipt = await attachReceipt(booking.id, {
        items:           receiptLines,
        paymentMethod:   payMethod,
        issuedByAdminId: admin.id,
        issuedByName:    admin.name,
      });
      return NextResponse.json({ ...booking, receipt }, { status: 200 });
    }

    // ── New walk-in sale ────────────────────────────────────────────────
    const walkinBs = await prisma.branchService.findFirst({
      where: { branchId, serviceId: "svc-walkin", isActive: true },
    });
    if (!walkinBs) {
      await releaseCoupon();
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
    const hasRetail = items.some(it => {
      const svcId = it.branchServiceId ? bsMap.get(it.branchServiceId) : null;
      return !!svcId && retailServiceIds.has(svcId);
    });
    // Count cart lines that are NOT membership/package SKUs, reusing the bsMap
    // resolved above (no second branchService query).
    let nonSaleOnlyCount = 0;
    if (branchServiceIds.length > 0) {
      for (const it of items) {
        const svcId = it.branchServiceId ? bsMap.get(it.branchServiceId) : null;
        if (!svcId || (!SALE_ONLY_SKUS.has(svcId) && !retailServiceIds.has(svcId))) nonSaleOnlyCount++;
      }
    } else {
      nonSaleOnlyCount = items.length;
    }
    const saleOnly = (hasMembershipOrPackage || hasRetail) && nonSaleOnlyCount === 0;

    // Pick serviceId: use the membership/package SKU for sale-only carts,
    // otherwise use walkin.
    let saleServiceId = walkinBs.serviceId;
    if (saleOnly) {
      if (membershipItem) saleServiceId = MEMBERSHIP_SKU;
      else if (packageItems.length > 0) saleServiceId = packageItems[0].serviceId;
      else saleServiceId = RETAIL_SKU; // products only — a counter sale, not a visit
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
        internalNotes: fullNotes || null,
        status:      "COMPLETED",
        completedAt: now,
        paidAt:      now, // walk-in POS sale is paid on the spot
      },
      include: { branch: true, customer: true },
    });

    if (membershipItem) {
      if (holdMembership) {
        await holdMembershipPrepaid({
          customerId:    customer.id,
          paidAmount:    membershipItem.price,
          paymentMethod: "POS",
          bookingId:     booking.id,
        });
      } else {
        const m = await activateOrRenewMembership({
          customerId:    customer.id,
          paidAmount:    membershipItem.price,
          paymentMethod: "POS",
          bookingId:     booking.id,
        });
        if (m?.membership?.id) {
          after(() => sendMembershipActivated(m.membership.id, { cycleId: m.cycle?.id, renewed: m.renewed }).catch((e) => console.error("[notify] membership activated failed", e)));
        }
      }
    }

    for (const p of packageItems) {
      const cp = await activatePackage({
        customerId:    customer.id,
        packageSku:    p.serviceId,
        paidAmount:    p.price,
        paymentMethod: "POS",
        bookingId:     booking.id,
        countFirstUse: true, // 5-pack: count the first visit on purchase
      });
      if (cp?.id) {
        after(() => sendPackageActivated(cp.id).catch((e) => console.error("[notify] package activated failed", e)));
      }
    }

    for (const rid of redemptionIds) {
      await redeemPackage(rid);
    }

    await recordCoupon(booking.id);
    await recordCheers(booking.id, cheers);
    const receipt = await attachReceipt(booking.id, {
      items:           receiptLines,
      paymentMethod:   payMethod,
      issuedByAdminId: admin.id,
      issuedByName:    admin.name,
    });
    return NextResponse.json({ ...booking, receipt }, { status: 201 });
  } catch (error) {
    console.error("POS sale error:", error);
    await releaseCoupon();
    return NextResponse.json({ error: "Failed to create sale" }, { status: 500 });
  }
}
