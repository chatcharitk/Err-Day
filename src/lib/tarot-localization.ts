import { TAROT_CARDS } from "@/lib/flex/tarot-cards";

const API_TO_LOCAL_CARD: Record<number, string> = {
  58: "magician",
  63: "lovers",
  67: "wheel-of-fortune",
  74: "star",
  75: "moon",
  76: "sun",
};

type ReadingArea = "love" | "career" | "finance";

const SECTION_MARKERS: Record<ReadingArea, string> = {
  love: "❤️ ความรัก",
  career: "✨ การงาน",
  finance: "💰 การเงิน",
};

const NEXT_MARKERS: Record<ReadingArea, string[]> = {
  career: ["💰 การเงิน"],
  finance: ["❤️ ความรัก"],
  love: ["🌿 สุขภาพ", "🌈 สุขภาพ"],
};

function thaiCardSection(apiCardId: number, area: ReadingArea): string | null {
  const localId = API_TO_LOCAL_CARD[apiCardId];
  const card = TAROT_CARDS.find(item => item.id === localId);
  if (!card) return null;

  const marker = SECTION_MARKERS[area];
  const start = card.affirmation.indexOf(marker);
  if (start === -1) return null;

  const contentStart = start + marker.length;
  const possibleEnds = NEXT_MARKERS[area]
    .map(next => card.affirmation.indexOf(next, contentStart))
    .filter(index => index >= 0);
  const end = possibleEnds.length ? Math.min(...possibleEnds) : card.affirmation.length;
  const body = card.affirmation.slice(contentStart, end).trim();

  return body ? `${card.emoji} ${card.nameTh}\n${body}` : null;
}

export function localizeTarotReading(args: {
  loveId: number;
  careerId: number;
  financeId: number;
  provider: { love: string; career: string; finance: string };
}) {
  return {
    love: thaiCardSection(args.loveId, "love") ?? args.provider.love,
    career: thaiCardSection(args.careerId, "career") ?? args.provider.career,
    finance: thaiCardSection(args.financeId, "finance") ?? args.provider.finance,
  };
}
