import { prisma } from "@/lib/prisma";

/**
 * AI reply inbox — storage side. Customer chat messages are saved here as they
 * arrive; `inbox-ai.ts` drafts a reply for the owner to review. Nothing is ever
 * sent to the customer from this file.
 */

export type InboxChannel = "LINE" | "FACEBOOK" | "INSTAGRAM";

interface LineMessageEvent {
  type: string;
  timestamp?: number;
  replyToken?: string;
  source?: { type: string; userId?: string };
  message?: { type: string; id?: string; text?: string };
}

const KIND: Record<string, string> = { text: "text", image: "image", sticker: "sticker" };

/**
 * Save a one-to-one LINE message from a customer. Returns the stored message,
 * or null when the event isn't a customer chat message or was already saved
 * (LINE retries deliveries).
 */
export async function recordLineInbound(event: LineMessageEvent): Promise<{ threadId: string; messageId: string } | null> {
  const userId = event.source?.userId;
  if (event.type !== "message" || event.source?.type !== "user" || !userId || !event.message) return null;
  const externalId = event.message.id ? `line:${event.message.id}` : null;
  if (externalId && await prisma.inboxMessage.findUnique({ where: { externalId }, select: { id: true } })) return null;

  const at = event.timestamp ? new Date(event.timestamp) : new Date();
  const customer = await prisma.customer.findUnique({ where: { lineUserId: userId }, select: { id: true, lineDisplayName: true, pictureUrl: true } });
  let thread = await prisma.inboxThread.findUnique({ where: { channel_externalUserId: { channel: "LINE", externalUserId: userId } } });
  if (!thread) {
    const profile = customer?.lineDisplayName ? null : await fetchLineProfile(userId);
    thread = await prisma.inboxThread.upsert({
      where: { channel_externalUserId: { channel: "LINE", externalUserId: userId } },
      create: {
        channel: "LINE", externalUserId: userId, customerId: customer?.id ?? null,
        displayName: customer?.lineDisplayName ?? profile?.displayName ?? null,
        pictureUrl: customer?.pictureUrl ?? profile?.pictureUrl ?? null,
      },
      update: {},
    });
  }

  const kind = KIND[event.message.type] ?? "other";
  try {
    const msg = await prisma.inboxMessage.create({
      data: { threadId: thread.id, direction: "IN", kind, text: event.message.type === "text" ? event.message.text ?? "" : null, externalId, createdAt: at },
    });
    await prisma.inboxThread.update({
      where: { id: thread.id },
      data: {
        lastMessageAt: at, lastInboundAt: at, unread: { increment: 1 },
        // A customer who links LINE later gets attached on their next message.
        ...(customer && !thread.customerId ? { customerId: customer.id } : {}),
        ...(event.replyToken ? { replyToken: event.replyToken, replyTokenAt: new Date() } : {}),
      },
    });
    return { threadId: thread.id, messageId: msg.id };
  } catch (e) {
    // Unique externalId: a parallel retry stored it first.
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") return null;
    throw e;
  }
}

async function fetchLineProfile(userId: string): Promise<{ displayName?: string; pictureUrl?: string } | null> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN?.trim();
  if (!token) return null;
  const res = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
    headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5_000),
  }).catch(() => null);
  return res?.ok ? res.json() : null;
}
