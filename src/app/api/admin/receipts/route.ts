/**
 * POST /api/admin/receipts  { bookingId }
 *
 * Issue the receipt for a booking that doesn't have one yet — the recovery path
 * for sales made before receipts existed, or where issuing failed at checkout.
 * Idempotent: a booking that already has a receipt returns that same document.
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { issueReceiptForBooking, receiptUrl } from "@/lib/receipts";

export async function POST(request: Request) {
  const gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (gate instanceof Response) return gate;
  const admin = gate;

  try {
    const { bookingId } = await request.json().catch(() => ({} as { bookingId?: string }));
    if (!bookingId) return NextResponse.json({ error: "bookingId required" }, { status: 400 });

    const receipt = await issueReceiptForBooking(bookingId, {
      issuedByAdminId: admin.id,
      issuedByName:    admin.name,
    });
    if (!receipt) {
      // Zero-value sale (e.g. fully redeemed against a package) — no money
      // received, so there is nothing to receipt.
      return NextResponse.json({ error: "ไม่มียอดชำระสำหรับออกใบเสร็จ" }, { status: 400 });
    }

    return NextResponse.json({
      id:          receipt.id,
      number:      receipt.number,
      publicToken: receipt.publicToken,
      url:         receiptUrl(receipt.publicToken),
    });
  } catch (e) {
    console.error("[receipts POST]", e);
    return NextResponse.json({ error: "ออกใบเสร็จไม่สำเร็จ" }, { status: 500 });
  }
}
