/**
 * LINE Flex card sent when a customer is given a coupon: what they got, until
 * when, and a button that opens the customer hub (where the coupon waits in
 * "คูปองของฉัน" with the show-to-staff screen). Style mirrors flex/membership.ts.
 */
import type { LineMessage } from "@/lib/line-messaging";
import { couponDate, couponValueLabel } from "@/lib/coupon-rules";

const PRIMARY  = "#8B1D24";
const TEXT     = "#3B2A24";
const MUTED    = "#A08070";
const BG_BEIGE = "#FDF8F3";

const LIFF_ID  = process.env.NEXT_PUBLIC_LIFF_ID;
const APP_HOST = process.env.NEXT_PUBLIC_APP_URL ?? "https://book.err-daysalon.com";
/** Opens the customer hub inside LINE (LIFF), where the coupon wallet is. */
export const COUPON_HUB_URL = LIFF_ID ? `https://liff.line.me/${LIFF_ID}` : APP_HOST;

export function buildCouponReceivedFlex(args: {
  name: string;
  discountType: string; discountValue: number; maxDiscountSatang: number | null;
  validFrom: Date; validUntil: Date;
  minSpendSatang: number; categories: string[];
  terms: string | null;
}): LineMessage {
  const value = couponValueLabel(args);
  const until = couponDate(args.validUntil);
  const conds = [
    args.minSpendSatang > 0 ? `ยอดขั้นต่ำ ฿${(args.minSpendSatang / 100).toLocaleString("th-TH")}` : null,
    args.categories.length ? `เฉพาะ ${args.categories.join(", ")}` : null,
  ].filter(Boolean) as string[];
  const termsLines = (args.terms ?? "").split("\n").map(l => l.trim()).filter(Boolean).slice(0, 4);
  return {
    type: "flex",
    altText: `🎟 คุณได้รับคูปอง ${args.name} (${value}) ใช้ได้ถึง ${until}`,
    contents: {
      type: "bubble",
      size: "kilo",
      header: {
        type: "box", layout: "vertical", paddingAll: "16px", backgroundColor: "#C2410C",
        contents: [
          { type: "text", text: "🎟 คุณได้รับคูปองแล้ว!", color: "#FFFFFF", weight: "bold", size: "md", wrap: true },
          { type: "text", text: "err·day", color: "#FFFFFF", size: "xs", margin: "xs" },
        ],
      },
      body: {
        type: "box", layout: "vertical", spacing: "sm", paddingAll: "16px", backgroundColor: BG_BEIGE,
        contents: [
          { type: "text", text: args.name, weight: "bold", size: "md", color: TEXT, wrap: true },
          { type: "text", text: value, weight: "bold", size: "xxl", color: "#C2410C", wrap: true },
          { type: "text", text: `ใช้ได้ถึง ${until}`, size: "sm", color: TEXT, margin: "sm" },
          ...(conds.length ? [{ type: "text", text: conds.join(" · "), size: "xs", color: MUTED, wrap: true }] : []),
          { type: "separator", margin: "md", color: "#EADBCF" },
          { type: "text", text: "กดปุ่มด้านล่างเพื่อเปิดแอป แล้วแสดงคูปองให้พนักงานตอนชำระเงินได้เลยค่ะ", size: "xs", color: MUTED, wrap: true, margin: "md" },
          ...(termsLines.length ? [
            { type: "text", text: "เงื่อนไข", size: "xs", weight: "bold", color: TEXT, margin: "md" },
            ...termsLines.map(l => ({ type: "text", text: `• ${l}`, size: "xxs", color: MUTED, wrap: true })),
          ] : []),
        ],
      },
      footer: {
        type: "box", layout: "vertical", spacing: "sm", paddingAll: "16px", backgroundColor: BG_BEIGE,
        contents: [
          { type: "button", style: "primary", color: PRIMARY, height: "sm", action: { type: "uri", label: "เปิดแอป ดูคูปองของฉัน", uri: COUPON_HUB_URL } },
        ],
      },
    },
  };
}
