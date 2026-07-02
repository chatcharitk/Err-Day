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

import { storeImage } from "@/lib/upload";
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

/** Bangkok "today" as "YYYY-MM-DD". */
function bangkokTodayStr(): string {
  const bkk = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${bkk.getUTCFullYear()}-${p(bkk.getUTCMonth() + 1)}-${p(bkk.getUTCDate())}`;
}

/** UTC Date range covering one "YYYY-MM-DD" Bangkok day as stored on Booking.date. */
function dayRange(dateStr: string): { start: Date; end: Date } {
  const [y, m, d] = dateStr.split("-").map(Number);
  return {
    start: new Date(Date.UTC(y, m - 1, d, 0, 0, 0)),
    end:   new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999)),
  };
}

/**
 * Sender-name tokens for fuzzy comparison against customer names. Strips Thai
 * and English title prefixes; keeps tokens of 3+ chars (drops abbreviated
 * surnames like the "อ" in "น.ส. อรุณวรางค์ อ").
 */
function senderTokens(raw: string): string[] {
  return raw
    .replace(/น\.ส\.|นางสาว|นาง|นาย|ด\.ญ\.|ด\.ช\.|คุณ|mr\.?|mrs\.?|ms\.?/gi, " ")
    .toLowerCase()
    .split(/\s+/)
    .filter(t => t.length >= 3);
}

interface BookingCandidate {
  id:        string;
  startTime: string;
  customer:  { name: string; nickname: string | null };
}

/**
 * Find the booking a slip most likely pays for.
 *
 * Signals, in order:
 *   1. branch + slip DATE (from OCR; falls back to Bangkok today) + exact amount,
 *      over bookings that don't have a receipt yet (incl. COMPLETED ones that
 *      were checked out without a slip attached)
 *   2. when several bookings share the amount — common for the ฿100 member
 *      price — narrow by the slip's SENDER NAME vs customer name/nickname
 *
 * Returns a booking only when the final match is unique; ambiguity is always
 * left for the admin to resolve in the review queue.
 */
export async function suggestBookingForSlip(
  branchId: string,
  amountSatang: number,
  opts?: { dateStr?: string | null; senderName?: string | null },
): Promise<{ id: string; startTime: string; customerName: string } | null> {
  const { start, end } = dayRange(opts?.dateStr || bangkokTodayStr());
  const candidates: BookingCandidate[] = await prisma.booking.findMany({
    where: {
      branchId,
      date:       { gte: start, lte: end },
      status:     { in: ["PENDING", "CONFIRMED", "COMPLETED"] },
      totalPrice: amountSatang,
      receiptUrl: null,
    },
    select: { id: true, startTime: true, customer: { select: { name: true, nickname: true } } },
    take: 25,
  });

  let pool = candidates;
  const tokens = opts?.senderName ? senderTokens(opts.senderName) : [];
  if (pool.length > 0 && tokens.length > 0) {
    const byName = pool.filter(b => {
      const hay = `${b.customer.name} ${b.customer.nickname ?? ""}`.toLowerCase();
      return tokens.some(t => hay.includes(t));
    });
    // Name agreement narrows the pool. Name CONTRADICTION vetoes the match
    // entirely — a readable Thai sender name that matches none of the
    // candidates means "probably a different customer" (e.g. the slip belongs
    // to a booking that was already receipted), and a wrong preselection is
    // worse than none because admins tend to rubber-stamp suggestions.
    // The cost: Thai-script sender vs Latin-script customer record falls back
    // to manual pick — same as before this pipeline existed.
    pool = byName;
  }

  if (pool.length !== 1) return null;
  const b = pool[0];
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

  const ext = content.contentType.includes("png") ? "png" : "jpg";
  const imageUrl = await storeImage(`slips/${branchId}/${messageId}.${ext}`, content.buffer, content.contentType);

  // 3. OCR (best-effort — an unreadable slip still lands in the review queue).
  let amount: number | null = null;
  let slipDate: string | null = null;
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
    slipDate   = parsed.date;
    // transferAt is a display hint — "YYYY-MM-DD HH:mm" when the date is known
    // (slips are often reviewed the next day), bare "HH:mm" otherwise.
    transferAt = [parsed.date, parsed.time].filter(Boolean).join(" ") || null;
    bankName   = parsed.bank;
    senderName = parsed.senderName;
    ocrStatus  = "OK";
  } catch (e) {
    console.error("[slips] OCR failed:", e);
  }

  // 4. Suggest a booking: branch + slip date + amount, disambiguated by the
  //    sender's name when several bookings share the amount.
  const matched = amount != null
    ? await suggestBookingForSlip(branchId, amount, { dateStr: slipDate, senderName })
    : null;

  const slip = await prisma.paymentSlip.update({
    where: { lineMessageId: messageId },
    data: {
      imageUrl,
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
