/**
 * GET  /api/admin/flex/tarot?card=<id>
 *   Returns the Flex JSON pair (tarot card + Google review) for a given card.
 *   Paste each `contents` object into LINE OA Manager's "Flex Message" JSON
 *   editor, then attach both to the auto-reply rule for the QR keyword.
 *
 * POST /api/admin/flex/tarot
 *   body: { lineUserId, card?: <id>, withReview?: boolean }
 *   Pushes the tarot Flex (and optionally the review Flex) to a LINE userId
 *   for live testing.
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { pushLine } from "@/lib/line-messaging";
import { buildTarotFlex, buildReviewFlex } from "@/lib/flex/tarot";
import { TAROT_CARDS, todaysCard } from "@/lib/flex/tarot-cards";

function getCard(id: string | null | undefined) {
  if (!id) return todaysCard();
  return TAROT_CARDS.find(c => c.id === id) ?? todaysCard();
}


export async function GET(request: Request) {
  await requireAdmin();
  const { searchParams } = new URL(request.url);
  const card = getCard(searchParams.get("card"));

  const tarotMessage  = buildTarotFlex(card);
  const reviewMessage = buildReviewFlex();

  const payload = {
    card: {
      id:      card.id,
      name:    card.name,
      keyword: card.keyword,        // exact text from the QR
    },
    tarotMessage,                   // copy this into LINE OA Manager (Flex #1)
    reviewMessage,                  // copy this into LINE OA Manager (Flex #2)
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}


export async function POST(request: Request) {
  await requireAdmin();
  const body = await request.json();
  const { lineUserId, card: cardId, withReview = true } = body;
  if (!lineUserId) {
    return NextResponse.json({ error: "lineUserId required" }, { status: 400 });
  }
  const card = getCard(cardId);
  const messages = [
    buildTarotFlex(card),
    ...(withReview ? [buildReviewFlex()] : []),
  ];
  const result = await pushLine(lineUserId, messages);
  return NextResponse.json({
    card:    card.id,
    sent:    messages.length,
    ...result,
  });
}
