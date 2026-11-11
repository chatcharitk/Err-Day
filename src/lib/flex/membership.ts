/**
 * LINE Flex cards for the membership / package lifecycle:
 *   - buildEntitlementReceivedFlex  → "ได้รับใบสมัครแล้ว — รอชำระที่เคาน์เตอร์"
 *     (sent right after the customer self-registers via LIFF, before payment)
 *   - buildEntitlementActivatedFlex → "เปิดใช้งานแล้ว" with start / expiry / usages
 *     (sent when staff complete the sale at POS)
 *
 * Style mirrors src/lib/flex/booking.ts. The booking CTA uses the LIFF deep
 * link so it opens with a LINE session (a plain URL has no LIFF context).
 */
import type { LineMessage } from "@/lib/line-messaging";

const PRIMARY  = "#8B1D24";
const TEXT     = "#3B2A24";
const MUTED    = "#A08070";
const BG_BEIGE = "#FDF8F3";

const LIFF_ID  = process.env.NEXT_PUBLIC_LIFF_ID;
const APP_HOST = process.env.NEXT_PUBLIC_APP_URL ?? "https://book.err-daysalon.com";
const BOOK_URL = LIFF_ID ? `https://liff.line.me/${LIFF_ID}` : `${APP_HOST}/book`;

// Promo hero images served from public/membership/. Keyed by both the LIFF
// product key ("membership"|"5pack"|"buffet") and the package SKU so either
// caller can resolve it. Returns undefined when there's no image (→ no hero).
const PROMO_HERO: Record<string, string> = {
  membership:   `${APP_HOST}/membership/membership.jpg`,
  "5pack":      `${APP_HOST}/membership/pack5.jpg`,
  "svc-pkg5":   `${APP_HOST}/membership/pack5.jpg`,
};
export function promoHeroUrl(key: string | null | undefined): string | undefined {
  return key ? PROMO_HERO[key] : undefined;
}

/** A bubble `hero` image block, or {} when there's no image for this product. */
function heroBlock(heroUrl?: string) {
  if (!heroUrl) return {};
  return {
    hero: {
      type:        "image",
      url:         heroUrl,
      size:        "full",
      aspectRatio: "4:3",
      aspectMode:  "fit",          // show the whole promo card, don't crop the price
      backgroundColor: "#F1E9DC",  // cream — matches the artwork's border
    },
  };
}

/** Format a Date as "พ. 30 เม.ย. 2569" in Thai local time. */
function formatDateTh(d: Date): string {
  return d.toLocaleDateString("th-TH", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });
}

/** One "label · value" body row. */
function row(label: string, value: string, strong = false) {
  return {
    type: "box", layout: "horizontal", spacing: "sm",
    contents: [
      { type: "text", text: label, size: "sm", color: MUTED, flex: 4 },
      { type: "text", text: value, size: "sm", color: strong ? PRIMARY : TEXT, weight: strong ? "bold" : "regular", align: "end", wrap: true, flex: 6 },
    ],
  };
}

/** "Application received — please pay at the counter" card. */
export function buildEntitlementReceivedFlex(args: {
  greetName:   string;
  productName: string;
  priceTh:     string;
  heroUrl?:    string;
}): LineMessage {
  return {
    type: "flex",
    altText: `ได้รับใบสมัคร ${args.productName} แล้ว — กำลังตรวจสอบการชำระเงิน`,
    contents: {
      type: "bubble",
      size: "kilo",
      ...heroBlock(args.heroUrl),
      header: {
        type: "box", layout: "vertical", paddingAll: "16px", backgroundColor: "#9A3412",
        contents: [
          { type: "text", text: "📋 ได้รับใบสมัครแล้ว", color: "#FFFFFF", weight: "bold", size: "md", wrap: true },
          { type: "text", text: "err·day", color: "#FFFFFF", size: "xs", margin: "xs" },
        ],
      },
      body: {
        type: "box", layout: "vertical", spacing: "sm", paddingAll: "16px", backgroundColor: BG_BEIGE,
        contents: [
          { type: "text", text: `สวัสดีค่ะ คุณ${args.greetName}`, weight: "bold", size: "sm", color: TEXT, wrap: true },
          { type: "text", text: "เราได้รับใบสมัครของคุณแล้วนะคะ 🙏 ทางทีมงานกำลังตรวจสอบการชำระเงินเพื่อเปิดใช้งานสมาชิกค่ะ", size: "xs", color: MUTED, wrap: true, margin: "sm" },
          { type: "separator", margin: "md", color: "#EADBCF" },
          { type: "box", layout: "vertical", spacing: "sm", margin: "md", contents: [
            row("แพ็กเกจ", args.productName, true),
            row("ราคา", args.priceTh),
            row("สถานะ", "⏳ กำลังตรวจสอบ"),
          ] },
        ],
      },
    },
  };
}

/** "Activated" confirmation card with start / expiry / usages. */
export function buildEntitlementActivatedFlex(args: {
  greetName:   string;
  productName: string;
  startedAt:   Date;
  expiresAt:   Date | null;
  usageText:   string;   // e.g. "ไม่จำกัดจำนวนครั้ง" or "5 ครั้ง"
  heroUrl?:    string;
  renewed?:    boolean;  // true → renewal wording instead of first-time activation
}): LineMessage {
  const title    = args.renewed ? "✅ ต่ออายุแล้ว" : "✅ เปิดใช้งานแล้ว";
  const altText  = `${args.renewed ? "ต่ออายุ" : "เปิดใช้งาน"} ${args.productName} แล้ว 🎉`;
  const greeting = args.renewed
    ? `ต่ออายุสมาชิกเรียบร้อยแล้วค่ะ คุณ${args.greetName} 🎉`
    : `ยินดีต้อนรับค่ะ คุณ${args.greetName} 🎉`;
  return {
    type: "flex",
    altText,
    contents: {
      type: "bubble",
      size: "kilo",
      ...heroBlock(args.heroUrl),
      header: {
        type: "box", layout: "vertical", paddingAll: "16px", backgroundColor: "#166534",
        contents: [
          { type: "text", text: title, color: "#FFFFFF", weight: "bold", size: "md", wrap: true },
          { type: "text", text: "err·day membership", color: "#FFFFFF", size: "xs", margin: "xs" },
        ],
      },
      body: {
        type: "box", layout: "vertical", spacing: "sm", paddingAll: "16px", backgroundColor: BG_BEIGE,
        contents: [
          { type: "text", text: greeting, weight: "bold", size: "sm", color: TEXT, wrap: true },
          { type: "separator", margin: "md", color: "#EADBCF" },
          { type: "box", layout: "vertical", spacing: "sm", margin: "md", contents: [
            row("แพ็กเกจ", args.productName, true),
            row("เริ่มใช้", formatDateTh(args.startedAt)),
            row("หมดอายุ", args.expiresAt ? formatDateTh(args.expiresAt) : "ไม่มีวันหมดอายุ"),
            row("สิทธิ์ใช้งาน", args.usageText),
          ] },
        ],
      },
      footer: {
        type: "box", layout: "vertical", spacing: "sm", paddingAll: "16px", backgroundColor: BG_BEIGE,
        contents: [
          { type: "button", style: "primary", color: PRIMARY, height: "sm",
            action: { type: "uri", label: "📅 จองคิว", uri: BOOK_URL } },
        ],
      },
    },
  };
}

/**
 * "You've got your voucher" card for a prepaid event voucher (e.g. 11.11
 * PJOLI Treatment) — sent once per bill, right after the POS sale.
 */
export function buildVoucherPurchasedFlex(args: {
  greetName:   string;
  voucherName: string;
  serviceName: string;
  count:       number;   // vouchers bought on this bill
  expiresAt:   Date;
  heroUrl?:    string;
}): LineMessage {
  const until = args.expiresAt.toLocaleDateString("th-TH", {
    day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Bangkok",
  });
  return {
    type: "flex",
    altText: `ได้รับ${args.voucherName}แล้ว ${args.count > 1 ? `${args.count} ใบ ` : ""}ใช้ได้ถึง ${until} 🎫`,
    contents: {
      type: "bubble",
      size: "kilo",
      ...(args.heroUrl ? { hero: { type: "image", url: args.heroUrl, size: "full", aspectRatio: "4:5", aspectMode: "cover" } } : {}),
      header: {
        type: "box", layout: "vertical", paddingAll: "16px", backgroundColor: PRIMARY,
        contents: [
          { type: "text", text: "🎫 ได้รับบัตรเรียบร้อยแล้ว", color: "#FFFFFF", weight: "bold", size: "md", wrap: true },
          { type: "text", text: args.voucherName, color: "#FFFFFF", size: "xs", margin: "xs", wrap: true },
        ],
      },
      body: {
        type: "box", layout: "vertical", spacing: "sm", paddingAll: "16px", backgroundColor: BG_BEIGE,
        contents: [
          { type: "text", text: `ขอบคุณที่ซื้อโปรค่ะ คุณ${args.greetName} 💕`, weight: "bold", size: "sm", color: TEXT, wrap: true },
          { type: "separator", margin: "md", color: "#EADBCF" },
          { type: "box", layout: "vertical", spacing: "sm", margin: "md", contents: [
            row("สิทธิ์", `${args.serviceName} ${args.count} ครั้ง`, true),
            row("ใช้ได้ถึง", until, true),
          ] },
          { type: "text", wrap: true, size: "xs", color: MUTED, margin: "md",
            text: "จองคิวหรือ walk-in ได้ตามสะดวก แจ้งชื่อที่เคาน์เตอร์ ระบบจะตัดสิทธิ์ให้อัตโนมัติ ไม่ต้องจ่ายเพิ่มค่ะ" },
        ],
      },
      footer: {
        type: "box", layout: "vertical", spacing: "sm", paddingAll: "16px", backgroundColor: BG_BEIGE,
        contents: [
          { type: "button", style: "primary", color: PRIMARY, height: "sm",
            action: { type: "uri", label: "📅 จองคิวใช้สิทธิ์", uri: BOOK_URL } },
        ],
      },
    },
  };
}

/** Hero images for voucher SKUs (public/promos/). */
export const VOUCHER_HERO: Record<string, string> = {
  "svc-voucher-pjoli-1111": `${APP_HOST}/promos/pjoli-1111.jpg`,
};
