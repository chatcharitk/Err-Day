/**
 * The err.day tarot deck — bunny + salon themed Major Arcana cards used
 * for the "ดวงวันนี้" (daily fortune) LINE message.
 *
 * Each card has:
 *   - A title (English + Roman numeral)
 *   - A short Thai affirmation tied to salon / beauty themes
 *   - The PNG filename in public/tarot/ (case-sensitive — must match exactly)
 *
 * To add/remove cards, just edit this file. The Flex builder reads from here.
 *
 * Image hosting: the PNGs in public/tarot/ are served at
 *   https://err-day.vercel.app/tarot/<filename>
 * by Vercel automatically.
 */

export interface TarotCard {
  id:          string;
  numeral:     string;
  name:        string;
  nameTh:      string;
  affirmation: string;
  emoji:       string;
  image:       string;   // PNG filename in public/tarot/
  /**
   * Exact text the printed QR code sends when scanned (LINE OA Manager
   * matches this for the auto-reply rule, and the webhook routes on it).
   * Format: "คำทำนาย <English Name>" — matches your printed cards.
   */
  keyword:     string;
}

export const TAROT_CARDS: TarotCard[] = [
  {
    id:          "fool",
    numeral:     "0",
    name:        "THE FOOL",
    nameTh:      "เดอะ ฟูล",
    affirmation: "วันใหม่ ลุคใหม่! กล้าลองทรงผมที่ไม่เคยทำมาก่อน โอกาสรอคุณอยู่ ✨",
    emoji:       "🐰",
    image:       "The-Fool.png",
    keyword:     "คำทำนาย The Fool",
  },
  {
    id:          "magician",
    numeral:     "I",
    name:        "THE MAGICIAN",
    nameTh:      "เดอะ เมจิเชียน",
    affirmation: "คุณมีพลังในตัว วันนี้ลองสไตล์ใหม่ที่กล้าและโดดเด่นกว่าเดิม 💫",
    emoji:       "✂️",
    image:       "The-Magician.png",
    keyword:     "คำทำนาย The Magician",
  },
  {
    id:          "high-priestess",
    numeral:     "II",
    name:        "THE HIGH PRIESTESS",
    nameTh:      "เดอะ ไฮ พรีสเตส",
    affirmation: "ช่วงเวลาฟื้นฟู ทรีตเมนต์ผมคืนความเปล่งปลั่งให้กับคุณ 🌙",
    emoji:       "🌙",
    image:       "The-High-Priestess.png",
    keyword:     "คำทำนาย The High Priestess",
  },
  {
    id:          "hierophant",
    numeral:     "V",
    name:        "THE HIEROPHANT",
    nameTh:      "เดอะ ไฮโรแฟนต์",
    affirmation: "กลับสู่พื้นฐาน — ทรงคลาสสิคที่ไม่มีวันตกยุค พร้อมเสริมความมั่นใจ 🎓",
    emoji:       "📜",
    image:       "The-Hierophan.png",
    keyword:     "คำทำนาย The Hierophant",
  },
  {
    id:          "lovers",
    numeral:     "VI",
    name:        "THE LOVERS",
    nameTh:      "เดอะ เลิฟเวอร์ส",
    affirmation: "พาคนรู้ใจมาทำผมพร้อมกัน — โมเมนต์พิเศษที่ err.day รอคุณอยู่ 💕",
    emoji:       "💞",
    image:       "The-Lovers.png",
    keyword:     "คำทำนาย The Lovers",
  },
  {
    id:          "chariot",
    numeral:     "VII",
    name:        "THE CHARIOT",
    nameTh:      "เดอะ แชริออท",
    affirmation: "มุ่งมั่นและพร้อมลุย! ทรงผมใหม่ที่บูสต์พลังให้คุณก้าวต่อไป 🏆",
    emoji:       "🏇",
    image:       "The-Chariot.png",
    keyword:     "คำทำนาย The Chariot",
  },
  {
    id:          "strength",
    numeral:     "VIII",
    name:        "STRENGTH",
    nameTh:      "สเตรงท์",
    affirmation: "ความแข็งแกร่งของคุณอยู่ในตัว เริ่มจากผมสวยและสุขภาพดี 💪",
    emoji:       "🦁",
    image:       "The-Strength.png",
    keyword:     "คำทำนาย Strength",
  },
  {
    id:          "hermit",
    numeral:     "IX",
    name:        "THE HERMIT",
    nameTh:      "เดอะ เฮอร์มิท",
    affirmation: "เวลาส่วนตัวของคุณ มาผ่อนคลายเงียบๆ ที่ err.day 🕯️",
    emoji:       "🔦",
    image:       "The-Hermit.png",
    keyword:     "คำทำนาย The Hermit",
  },
  {
    id:          "wheel-of-fortune",
    numeral:     "X",
    name:        "WHEEL OF FORTUNE",
    nameTh:      "วีล ออฟ ฟอร์จูน",
    affirmation: "โชคดีกำลังจะมา! เปิดรับสิ่งใหม่ด้วยลุคใหม่ที่สดใส 🍀",
    emoji:       "🎡",
    image:       "Wheel of Fortune.png",
    keyword:     "คำทำนาย Wheel of Fortune",
  },
  {
    id:          "justice",
    numeral:     "XI",
    name:        "JUSTICE",
    nameTh:      "จัสติส",
    affirmation: "สมดุลและลงตัว — ทรงผมที่เข้ากับชีวิตของคุณ ⚖️",
    emoji:       "⚖️",
    image:       "Justice.png",
    keyword:     "คำทำนาย Justice",
  },
  {
    id:          "star",
    numeral:     "XVII",
    name:        "THE STAR",
    nameTh:      "เดอะ สตาร์",
    affirmation: "แสงดาวส่องทาง ทรีตเมนต์ที่ทำให้ผมเปล่งประกายเหมือนดาว ⭐",
    emoji:       "⭐",
    image:       "The-Star.png",
    keyword:     "คำทำนาย The Star",
  },
  {
    id:          "moon",
    numeral:     "XVIII",
    name:        "THE MOON",
    nameTh:      "เดอะ มูน",
    affirmation: "ฟังเสียงในใจ ลองทรงที่บ่งบอกความเป็นคุณจริงๆ 🌕",
    emoji:       "🌕",
    image:       "The-Moon.png",
    keyword:     "คำทำนาย The Moon",
  },
  {
    id:          "sun",
    numeral:     "XIX",
    name:        "THE SUN",
    nameTh:      "เดอะ ซัน",
    affirmation: "วันนี้คุณจะเปล่งประกาย ☀️ ผมสวย หน้าใส ทุกคนต้องชม!",
    emoji:       "☀️",
    image:       "The-Sun.png",
    keyword:     "คำทำนาย The Sun",
  },
  {
    id:          "world",
    numeral:     "XXI",
    name:        "THE WORLD",
    nameTh:      "เดอะ เวิลด์",
    affirmation: "สำเร็จและสมหวัง! เฉลิมฉลองด้วยทรงผมที่คุณภูมิใจ 👑",
    emoji:       "🌍",
    image:       "The-World.png",
    keyword:     "คำทำนาย The World",
  },
];


/** Find a card by its QR-text keyword (case-insensitive, exact match after trim). */
export function findCardByKeyword(text: string): TarotCard | null {
  const norm = text.trim().toLowerCase();
  return TAROT_CARDS.find(c => c.keyword.toLowerCase() === norm) ?? null;
}

/** Pick a deterministic "today's card" so the same customer sees the same
 * card all day — and the deck rotates predictably across days. */
export function todaysCard(seed?: string): TarotCard {
  const today = new Date().toISOString().slice(0, 10);
  const key   = (seed ?? "") + today;
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
  return TAROT_CARDS[Math.abs(hash) % TAROT_CARDS.length];
}
