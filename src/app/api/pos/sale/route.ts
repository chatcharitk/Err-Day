import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { MEMBERSHIP_SKU, activateOrRenewMembership, holdMembershipPrepaid } from "@/lib/membership";
import { isPackageSku, activatePackage, redeemPackage } from "@/lib/packages";
import { sendMembershipActivated, sendPackageActivated, sendStaffMembershipAlert } from "@/lib/notifications";
import { issueReceiptForBooking, receiptUrl, type ReceiptLineInput } from "@/lib/receipts";

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
}

/** Units on a line, tolerating older clients that omit `qty` entirely. */
function unitsOf(item: SaleItem): number {
  const q = Number(item.qty);
  return Number.isFinite(q) && q > 0 ? q : 1;
}

export async function POST(request: Request) {
  const gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (gate instanceof Response) return gate;
  const admin = gate;

  try {
    const body = await request.json();
    const { branchId, customerName, customerPhone, items, notes, fromBookingId, holdMembership, paymentMethod } = body as {
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
    if (branchServiceIds.length > 0) {
      const bsRows = await prisma.branchService.findMany({
        where:  { id: { in: branchServiceIds } },
        select: { id: true, serviceId: true },
      });
      for (const r of bsRows) bsMap.set(r.id, r.serviceId);
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
            sendMembershipActivated(m.membership.id, { cycleId: m.cycle?.id, renewed: m.renewed }).catch((e) => console.error("[notify] membership activated failed", e));
            sendStaffMembershipAlert(m.membership.id).catch((e) => console.error("[notify] staff membership alert failed", e));
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
          sendPackageActivated(cp.id).catch((e) => console.error("[notify] package activated failed", e));
        }
      }

      // Apply any package redemptions flagged by the cart
      for (const rid of redemptionIds) {
        await redeemPackage(rid);
      }

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
    // Count cart lines that are NOT membership/package SKUs, reusing the bsMap
    // resolved above (no second branchService query).
    let nonSaleOnlyCount = 0;
    if (branchServiceIds.length > 0) {
      for (const it of items) {
        const svcId = it.branchServiceId ? bsMap.get(it.branchServiceId) : null;
        if (!svcId || !SALE_ONLY_SKUS.has(svcId)) nonSaleOnlyCount++;
      }
    } else {
      nonSaleOnlyCount = items.length;
    }
    const saleOnly = hasMembershipOrPackage && nonSaleOnlyCount === 0;

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
          sendMembershipActivated(m.membership.id, { cycleId: m.cycle?.id, renewed: m.renewed }).catch((e) => console.error("[notify] membership activated failed", e));
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
        sendPackageActivated(cp.id).catch((e) => console.error("[notify] package activated failed", e));
      }
    }

    for (const rid of redemptionIds) {
      await redeemPackage(rid);
    }

    const receipt = await attachReceipt(booking.id, {
      items:           receiptLines,
      paymentMethod:   payMethod,
      issuedByAdminId: admin.id,
      issuedByName:    admin.name,
    });
    return NextResponse.json({ ...booking, receipt }, { status: 201 });
  } catch (error) {
    console.error("POS sale error:", error);
    return NextResponse.json({ error: "Failed to create sale" }, { status: 500 });
  }
}
