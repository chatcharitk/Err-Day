/**
 * The err.day tarot deck — bunny + salon themed cards used for the
 * "ดวงวันนี้" (daily fortune) LINE message.
 *
 * Each card has:
 *   - A title (English + Thai numeral)
 *   - A short Thai affirmation/description
 *   - A public image URL (must be HTTPS — LINE requires it)
 *
 * To swap or add cards, just edit this file. The Flex builder in
 * ./tarot.ts reads from here.
 *
 * Image hosting note: LINE Flex Messages need PUBLIC HTTPS URLs for
 * images. Recommended approach — drop the 5 PNGs into `public/tarot/`
 * in the repo. Vercel serves them at `https://err-day.vercel.app/tarot/*`.
 * Alternative: upload to Vercel Blob and use the returned URL.
 */

export interface TarotCard {
  id:          string;
  numeral:     string;   // I, II, … XXI (or empty)
  name:        string;   // English: THE SUN
  nameTh:      string;   // Thai display: เดอะ ซัน
  affirmation: string;   // Short Thai sentence to encourage the customer
  emoji:       string;
  image:       string;   // Filename in public/tarot/ (NOT full URL — builder prepends host)
}

export const TAROT_CARDS: TarotCard[] = [
  {
    id:          "fool",
    numeral:     "0",
    name:        "THE FOOL",
    nameTh:      "เดอะ ฟูล",
    affirmation: "วันนี้เป็นวันใหม่ ลองเปลี่ยนทรงผมที่ไม่เคยทำดู — โอกาสรอคุณอยู่ ✨",
    emoji:       "🐰",
    image:       "the-fool.png",
  },
  {
    id:          "magician",
    numeral:     "I",
    name:        "THE MAGICIAN",
    nameTh:      "เดอะ เมจิเชียน",
    affirmation: "คุณมีพลังในตัวเอง วันนี้ลองสไตล์ใหม่ที่กล้าและโดดเด่นกว่าเดิม 💫",
    emoji:       "✂️",
    image:       "the-magician.png",
  },
  {
    id:          "high-priestess",
    numeral:     "II",
    name:        "THE HIGH PRIESTESS",
    nameTh:      "เดอะ ไฮ พรีสเตส",
    affirmation: "ช่วงเวลาแห่งการพักผ่อนและฟื้นฟู ลองทรีตเมนต์ผมเพื่อกลับมาเปล่งปลั่งอีกครั้ง 🌙",
    emoji:       "🌙",
    image:       "the-high-priestess.png",
  },
  {
    id:          "sun",
    numeral:     "XIX",
    name:        "THE SUN",
    nameTh:      "เดอะ ซัน",
    affirmation: "วันนี้คุณจะเปล่งประกาย ☀️ ผมสวย หน้าใส ทุกคนต้องชม! แวะมาเสริมพลังกัน",
    emoji:       "☀️",
    image:       "the-sun.png",
  },
  {
    id:          "world",
    numeral:     "XXI",
    name:        "THE WORLD",
    nameTh:      "เดอะ เวิลด์",
    affirmation: "สำเร็จและสมหวัง! วันที่ทุกอย่างลงตัว เฉลิมฉลองด้วยทรงผมที่คุณภูมิใจ 👑",
    emoji:       "🌍",
    image:       "the-world.png",
  },
];

/** Pick a deterministic "today's card" so the same customer sees the same
 * card all day — and the deck rotates predictably. */
export function todaysCard(seed?: string): TarotCard {
  const today = new Date().toISOString().slice(0, 10);
  const key   = (seed ?? "") + today;
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
  return TAROT_CARDS[Math.abs(hash) % TAROT_CARDS.length];
}
