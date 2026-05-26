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
  const imageUrl = `${APP_HOST}/tarot/${card.image}`;
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
