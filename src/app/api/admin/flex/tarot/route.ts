/**
 * GET  /api/admin/flex/tarot?card=<id>         — returns the Flex JSON for a card
 *                                                (paste into LINE Flex Simulator to preview)
 * POST /api/admin/flex/tarot
 *      body: { card?: <id>, lineUserId: <U...> }
 *   Sends the tarot Flex Message to a specific LINE user.
 *   If `card` is omitted, uses today's deterministic pick.
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { pushLine } from "@/lib/line-messaging";
import { buildTarotFlex } from "@/lib/flex/tarot";
import { TAROT_CARDS, todaysCard } from "@/lib/flex/tarot-cards";

function getCard(id: string | null | undefined) {
  if (!id) return todaysCard();
  return TAROT_CARDS.find(c => c.id === id) ?? todaysCard();
}


export async function GET(request: Request) {
  await requireAdmin();
  const { searchParams } = new URL(request.url);
  const card = getCard(searchParams.get("card"));
  const message = buildTarotFlex(card);
  // Explicit charset so browsers / text viewers don't fall back to Latin-1
  // and mangle the Thai characters in the affirmation strings.
  return new NextResponse(JSON.stringify({ card: card.id, message }, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}


export async function POST(request: Request) {
  await requireAdmin();
  const body = await request.json();
  const { lineUserId, card: cardId } = body;
  if (!lineUserId) {
    return NextResponse.json({ error: "lineUserId required" }, { status: 400 });
  }
  const card    = getCard(cardId);
  const message = buildTarotFlex(card);
  const result  = await pushLine(lineUserId, [message]);
  return NextResponse.json({ card: card.id, ...result });
}
