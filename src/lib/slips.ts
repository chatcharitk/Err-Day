/**
 * Payment-slip pipeline.
 *
 * Staff post bank-transfer slips into the branch LINE group. The webhook calls
 * captureSlipFromLine() for every image in a known branch group:
 *
 *   1. dedupe-create the PaymentSlip row (unique lineMessageId)
 *   2. download the image from LINE → upload to Vercel Blob
 *   3. OCR amount / time / bank with Claude vision (best-effort)
 *   4. suggest a matching booking: same branch, today, open status,
 *      exact totalPrice, no receipt yet — only when the match is UNIQUE
 *
 * The admin reviews and confirms at /admin/slips — confirmation (not capture)
 * is what completes the booking, so a bad OCR or wrong match can never check
 * out the wrong appointment on its own.
 */

import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { getLineMessageContent } from "@/lib/line-messaging";
import { parseSlipImage } from "@/lib/slip-ocr";

const OCR_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type OcrMediaType = (typeof OCR_MEDIA_TYPES)[number];

export interface CaptureResult {
  status: "captured" | "duplicate" | "download_failed";
  slipId?: string;
  /** Satang, when OCR could read the amount. */
  amount?: number | null;
  /** Set when exactly one open booking matched the amount. */
  matchedBooking?: { id: string; startTime: string; customerName: string } | null;
}

/** Bangkok "today" as the UTC-noon Date range used by Booking.date. */
function bangkokTodayRange(): { start: Date; end: Date } {
  const bkk = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const y = bkk.getUTCFullYear(), m = bkk.getUTCMonth(), d = bkk.getUTCDate();
  return {
    start: new Date(Date.UTC(y, m, d, 0, 0, 0)),
    end:   new Date(Date.UTC(y, m, d, 23, 59, 59, 999)),
  };
}

/**
 * Find the booking a slip most likely pays for. Returns the booking only when
 * the match is unique — two same-priced open bookings means the admin decides.
 */
export async function suggestBookingForSlip(
  branchId: string,
  amountSatang: number,
): Promise<{ id: string; startTime: string; customerName: string } | null> {
  const { start, end } = bangkokTodayRange();
  const candidates = await prisma.booking.findMany({
    where: {
      branchId,
      date:       { gte: start, lte: end },
      status:     { in: ["PENDING", "CONFIRMED"] },
      totalPrice: amountSatang,
      receiptUrl: null,
    },
    select: { id: true, startTime: true, customer: { select: { name: true, nickname: true } } },
    take: 2,
  });
  if (candidates.length !== 1) return null;
  const b = candidates[0];
  return { id: b.id, startTime: b.startTime, customerName: b.customer.nickname || b.customer.name };
}

/**
 * Full capture pipeline for one LINE image message posted in a branch group.
 * Never throws — the webhook treats slip capture as best-effort.
 */
export async function captureSlipFromLine(args: {
  messageId: string;
  groupId:   string;
  branchId:  string;
}): Promise<CaptureResult> {
  const { messageId, groupId, branchId } = args;

  // 1. Dedupe-create first (unique lineMessageId): LINE may redeliver events,
  //    and creating before the slow download/OCR work makes re-entry safe.
  try {
    await prisma.paymentSlip.create({
      data: { branchId, groupId, lineMessageId: messageId, imageUrl: "" },
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return { status: "duplicate" };
    throw e;
  }

  // 2. Download from LINE → upload to Blob.
  const content = await getLineMessageContent(messageId);
  if (!content) {
    await prisma.paymentSlip.update({
      where: { lineMessageId: messageId },
      data:  { ocrStatus: "FAILED" },
    });
    return { status: "download_failed" };
  }

  const ext  = content.contentType.includes("png") ? "png" : "jpg";
  const blob = await put(`slips/${branchId}/${messageId}.${ext}`, content.buffer, {
    access:          "public",
    contentType:     content.contentType,
    addRandomSuffix: false,
    allowOverwrite:  true,
  });

  // 3. OCR (best-effort — an unreadable slip still lands in the review queue).
  let amount: number | null = null;
  let transferAt: string | null = null;
  let bankName: string | null = null;
  let senderName: string | null = null;
  let ocrStatus = "FAILED";
  try {
    const mediaType: OcrMediaType = (OCR_MEDIA_TYPES as readonly string[]).includes(content.contentType)
      ? (content.contentType as OcrMediaType)
      : "image/jpeg";
    const parsed = await parseSlipImage(content.buffer.toString("base64"), mediaType);
    amount     = parsed.amount != null ? Math.round(parsed.amount * 100) : null; // baht → satang
    transferAt = parsed.time;
    bankName   = parsed.bank;
    senderName = parsed.senderName;
    ocrStatus  = "OK";
  } catch (e) {
    console.error("[slips] OCR failed:", e);
  }

  // 4. Suggest a booking when the amount matched exactly one open booking today.
  const matched = amount != null ? await suggestBookingForSlip(branchId, amount) : null;

  const slip = await prisma.paymentSlip.update({
    where: { lineMessageId: messageId },
    data: {
      imageUrl:  blob.url,
      amount,
      transferAt,
      bankName,
      senderName,
      ocrStatus,
      bookingId: matched?.id ?? null,
    },
    select: { id: true },
  });

  return { status: "captured", slipId: slip.id, amount, matchedBooking: matched };
}
