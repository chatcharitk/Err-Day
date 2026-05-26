/**
 * Build a LINE Flex Message from an err.day tarot card.
 *
 * Used for the daily fortune message — push to customers with
 * `pushLine(lineUserId, [buildTarotFlex(card)])` from line-messaging.ts.
 */
import type { LineMessage } from "@/lib/line-messaging";
import type { TarotCard } from "./tarot-cards";

const PRIMARY  = "#8B1D24";
const TEXT     = "#3B2A24";
const MUTED    = "#A08070";
const BG_BEIGE = "#FDF8F3";

const APP_HOST = process.env.NEXT_PUBLIC_APP_URL ?? "https://err-day.vercel.app";


export function buildTarotFlex(card: TarotCard): LineMessage {
  // URL-encode the filename so spaces ("Wheel of Fortune.png") and other
  // characters work in LINE — which fetches the URL strictly.
  const imageUrl = `${APP_HOST}/tarot/${encodeURIComponent(card.image)}`;
  const bookUrl  = `${APP_HOST}/book`;

  return {
    type: "flex",
    altText: `ดวงวันนี้ — ${card.name} ${card.emoji}`,
    contents: {
      type: "bubble",
      size: "kilo",
      // ── Hero image ────────────────────────────────────────────────────────
      hero: {
        type:        "image",
        url:         imageUrl,
        size:        "full",
        aspectRatio: "3:4",     // matches the tall tarot-card aspect
        aspectMode:  "cover",
        backgroundColor: BG_BEIGE,
      },
      // ── Body ──────────────────────────────────────────────────────────────
      body: {
        type:       "box",
        layout:     "vertical",
        spacing:    "sm",
        paddingAll: "16px",
        backgroundColor: BG_BEIGE,
        contents: [
          {
            type:   "text",
            text:   "ดวงวันนี้ของคุณ",
            size:   "xs",
            color:  MUTED,
            weight: "regular",
          },
          {
            type:    "text",
            text:    `${card.numeral ? card.numeral + " · " : ""}${card.name} ${card.emoji}`,
            size:    "xl",
            weight:  "bold",
            color:   PRIMARY,
            wrap:    true,
          },
          {
            type:    "text",
            text:    card.affirmation,
            size:    "sm",
            color:   TEXT,
            wrap:    true,
            margin:  "md",
          },
        ],
      },
      // ── Footer (CTA button) ──────────────────────────────────────────────
      footer: {
        type:       "box",
        layout:     "vertical",
        spacing:    "sm",
        paddingAll: "16px",
        backgroundColor: BG_BEIGE,
        contents: [
          {
            type:  "button",
            style: "primary",
            color: PRIMARY,
            height: "sm",
            action: {
              type:  "uri",
              label: "📅 จองคิวที่ err.day",
              uri:   bookUrl,
            },
          },
          {
            type:  "text",
            text:  "err.day · สาขาสุขุมวิท · สาขาบางนา",
            size:  "xxs",
            color: MUTED,
            align: "center",
          },
        ],
      },
    },
  };
}


/**
 * "Thanks — please review us on Google" Flex card with TWO buttons (one
 * per branch). The QR text doesn't tell us which branch the customer
 * came from, so we offer both and let the customer pick.
 *
 * Configure URLs via env vars:
 *   GOOGLE_REVIEW_URL_SUKHUMVIT
 *   GOOGLE_REVIEW_URL_BANGNA
 *
 * Get them from Google Maps → your salon listing → "Write a review" link.
 */
export function buildReviewFlex(): LineMessage {
  // Defaults are the real review URLs Google Maps provided when we shared the
  // listings (g.page short-link format). Override per environment via the
  // GOOGLE_REVIEW_URL_* env vars if the listings ever move/rename.
  const sukhumvitUrl = process.env.GOOGLE_REVIEW_URL_SUKHUMVIT
    ?? "https://g.page/r/CQaI2r3lJUNJEAI/review";
  const bangnaUrl    = process.env.GOOGLE_REVIEW_URL_BANGNA
    ?? "https://g.page/r/Cf6Hn2PnBH5XEAI/review";

  return {
    type: "flex",
    altText: "ขอบคุณที่ใช้บริการ — รีวิว err.day 5 ดาวด้วยนะคะ ⭐",
    contents: {
      type: "bubble",
      size: "kilo",
      body: {
        type:       "box",
        layout:     "vertical",
        spacing:    "sm",
        paddingAll: "20px",
        backgroundColor: BG_BEIGE,
        contents: [
          {
            type:   "text",
            text:   "ขอบคุณที่ใช้บริการค่ะ 🙏",
            size:   "lg",
            weight: "bold",
            color:  TEXT,
            align:  "center",
          },
          {
            type:   "text",
            text:   "★★★★★",
            size:   "xxl",
            color:  "#FFB400",
            align:  "center",
            margin: "md",
          },
          {
            type:   "text",
            text:   "หากชอบ ช่วยรีวิวร้านเรา 5 ดาว เป็นกำลังใจเล็กๆ ให้ทีมงานด้วยนะคะ 🌟",
            size:   "sm",
            color:  TEXT,
            wrap:   true,
            align:  "center",
            margin: "md",
          },
          {
            type:   "text",
            text:   "เลือกสาขาที่คุณเพิ่งใช้บริการ",
            size:   "xs",
            color:  MUTED,
            align:  "center",
            margin: "md",
          },
        ],
      },
      footer: {
        type:       "box",
        layout:     "vertical",
        spacing:    "sm",
        paddingAll: "16px",
        backgroundColor: BG_BEIGE,
        contents: [
          {
            type:   "button",
            style:  "primary",
            color:  PRIMARY,
            height: "sm",
            action: {
              type:  "uri",
              label: "⭐ รีวิว · สาขาสุขุมวิท",
              uri:   sukhumvitUrl,
            },
          },
          {
            type:   "button",
            style:  "primary",
            color:  PRIMARY,
            height: "sm",
            action: {
              type:  "uri",
              label: "⭐ รีวิว · สาขาบางนา",
              uri:   bangnaUrl,
            },
          },
        ],
      },
    },
  };
}


/**
 * Carousel: all 5 cards side-by-side, swipeable.
 * Use for a "pick a card" or "deck preview" message.
 */
export function buildTarotCarousel(cards: TarotCard[]): LineMessage {
  return {
    type:    "flex",
    altText: "ทาโร่ ของ err.day — เลือกการ์ดที่ใช่ของคุณ",
    contents: {
      type: "carousel",
      contents: cards.map(card => {
        // Each card builder returns a flex message whose contents IS a bubble.
        const flex = buildTarotFlex(card);
        return (flex as { contents: unknown }).contents;
      }),
    },
  };
}
