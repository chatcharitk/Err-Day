/**
 * Build a LINE Flex Message for a booking notification.
 *
 * Used by the customer-facing senders in src/lib/notifications.ts to replace
 * plain-text booking messages with a rich card that shows the booking details +
 * branch location and offers two action buttons:
 *   1. 📍 แผนที่ร้าน      → opens the branch on Google Maps
 *   2. 📅 เปลี่ยน/จัดการนัด → opens the customer's /my-bookings page (reschedule/cancel)
 *
 * Only the message *format* changes vs the old text version — recipient resolution
 * (customer.lineUserId) and dedup logging stay in notifications.ts.
 */
import type { LineMessage } from "@/lib/line-messaging";

const PRIMARY  = "#8B1D24";
const TEXT     = "#3B2A24";
const MUTED    = "#A08070";
const BG_BEIGE = "#FDF8F3";

// Must be the registered LIFF endpoint domain so /my-bookings can run LINE
// login — the vercel.app alias is NOT registered with LIFF and login fails there.
const APP_HOST = process.env.NEXT_PUBLIC_APP_URL ?? "https://book.err-daysalon.com";

export type BookingFlexVariant = "created" | "confirmed" | "reminder" | "rescheduled";

/** Minimal shape needed to render the card — matches the senders' Prisma includes. */
export interface BookingFlexData {
  id:        string;
  date:      Date;
  startTime: string;
  endTime:   string;
  customer:  { name: string; nickname?: string | null };
  branch:    { name: string; address: string; mapUrl?: string | null; mapLat?: number | null; mapLng?: number | null };
  service:   { nameTh: string };
  staff:     { name: string } | null;
}

/** Short human-readable booking reference from the cuid, e.g. "#A1B2C3". */
export function bookingRef(id: string): string {
  return `#${id.slice(-6).toUpperCase()}`;
}

interface VariantStyle { banner: string; color: string; bg: string; intro: string; }

const VARIANTS: Record<BookingFlexVariant, VariantStyle> = {
  created:     { banner: "✨ ได้รับการจองแล้ว",   color: PRIMARY,   bg: "#FFF8F4", intro: "ทางร้านได้รับการจองของคุณเรียบร้อยแล้วนะคะ 🙏 ทีมงานจะยืนยันให้อีกครั้งค่ะ" },
  confirmed:   { banner: "✅ ยืนยันการจองแล้ว",   color: "#166534", bg: "#F0FDF4", intro: "ทีมงานยืนยันการจองของคุณเรียบร้อยแล้วนะคะ 🎉 แล้วพบกันค่ะ" },
  reminder:    { banner: "🌸 ใกล้ถึงเวลานัดแล้ว", color: PRIMARY,   bg: "#FFF8F4", intro: "นัดของคุณกำลังจะมาถึงในอีกประมาณ 4 ชั่วโมงนะคะ" },
  rescheduled: { banner: "⏰ เปลี่ยนเวลานัดแล้ว", color: "#9A3412", bg: "#FFF7ED", intro: "ทีมงานได้ปรับเวลานัดของคุณใหม่แล้วนะคะ" },
};

/** Format a Date as "พ. 30 เม.ย. 2569" in Thai local time. */
function formatDateTh(d: Date): string {
  return d.toLocaleDateString("th-TH", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });
}

/** Best-effort Google Maps URL for a branch: prefer saved link → lat/lng → address search. */
export function branchMapUrl(branch: BookingFlexData["branch"]): string {
  if (branch.mapUrl) return branch.mapUrl;
  if (branch.mapLat != null && branch.mapLng != null) {
    return `https://www.google.com/maps/search/?api=1&query=${branch.mapLat},${branch.mapLng}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${branch.name} ${branch.address}`)}`;
}

/** One "icon · value" body row. */
function row(icon: string, value: string) {
  return {
    type: "box", layout: "baseline", spacing: "sm",
    contents: [
      { type: "text", text: icon, size: "sm", flex: 0, color: MUTED },
      { type: "text", text: value, size: "sm", color: TEXT, wrap: true, flex: 1 },
    ],
  };
}

export function buildBookingFlex(
  b: BookingFlexData,
  variant: BookingFlexVariant,
  opts?: { oldStart?: string; oldEnd?: string },
): LineMessage {
  const v          = VARIANTS[variant];
  const greetName  = b.customer.nickname || b.customer.name;
  const staffName  = b.staff?.name ?? "ที่ว่างให้บริการ";
  const timeStr    = `${b.startTime} – ${b.endTime}`;

  const bodyRows: unknown[] = [
    row("📅", formatDateTh(b.date)),
  ];

  // For reschedule, show old → new time explicitly; otherwise a single time row.
  if (variant === "rescheduled" && opts?.oldStart && opts?.oldEnd) {
    bodyRows.push(row("⏰", `${opts.oldStart}–${opts.oldEnd} → ${timeStr}`));
  } else {
    bodyRows.push(row("⏰", timeStr));
  }

  bodyRows.push(row("💆", b.service.nameTh));
  bodyRows.push(row("👤", `ช่าง: ${staffName}`));
  bodyRows.push(row("📍", b.branch.name));

  return {
    type: "flex",
    altText: `${v.banner} — ${formatDateTh(b.date)} ${timeStr} ${b.service.nameTh}`,
    contents: {
      type: "bubble",
      size: "kilo",
      // ── Header banner ──────────────────────────────────────────────────────
      header: {
        type: "box", layout: "vertical", paddingAll: "16px", backgroundColor: v.color,
        contents: [
          { type: "text", text: v.banner, color: "#FFFFFF", weight: "bold", size: "md", wrap: true },
          {
            type: "box", layout: "baseline", margin: "xs",
            contents: [
              { type: "text", text: "err·day", color: "#FFFFFF", size: "xs", flex: 0 },
              { type: "text", text: `เลขที่จอง ${bookingRef(b.id)}`, color: "#FFFFFF", size: "xs", align: "end" },
            ],
          },
        ],
      },
      // ── Body ───────────────────────────────────────────────────────────────
      body: {
        type: "box", layout: "vertical", spacing: "sm", paddingAll: "16px", backgroundColor: BG_BEIGE,
        contents: [
          { type: "text", text: `สวัสดีค่ะ คุณ${greetName}`, weight: "bold", size: "sm", color: TEXT, wrap: true },
          { type: "text", text: v.intro, size: "xs", color: MUTED, wrap: true, margin: "sm" },
          { type: "separator", margin: "md", color: "#EADBCF" },
          { type: "box", layout: "vertical", spacing: "sm", margin: "md", contents: bodyRows },
          { type: "text", text: b.branch.address, size: "xxs", color: MUTED, wrap: true, margin: "md" },
        ],
      },
      // ── Footer (2 buttons) ─────────────────────────────────────────────────
      footer: {
        type: "box", layout: "vertical", spacing: "sm", paddingAll: "16px", backgroundColor: BG_BEIGE,
        contents: [
          {
            type: "button", style: "primary", color: PRIMARY, height: "sm",
            action: { type: "uri", label: "📍 แผนที่ร้าน", uri: branchMapUrl(b.branch) },
          },
          {
            type: "button", style: "secondary", height: "sm",
            action: { type: "uri", label: "📅 เปลี่ยน/จัดการนัด", uri: `${APP_HOST}/my-bookings` },
          },
        ],
      },
    },
  };
}
