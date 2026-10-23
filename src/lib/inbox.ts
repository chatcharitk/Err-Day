import { prisma } from "@/lib/prisma";
import { pushLine, replyLine, type LineMessage } from "@/lib/line-messaging";

/**
 * AI reply inbox — storage and sending. Customer chat messages are saved here as
 * they arrive; `inbox-ai.ts` drafts a reply for the owner to review. A message
 * reaches the customer only through `sendInboxReply`, when an admin presses Send.
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

// ── Sending (only ever from an admin pressing Send) ──────────────────────────

/** LINE reply tokens expire about a minute after the message — stay well inside. */
const REPLY_TOKEN_MAX_AGE_MS = 50_000;

export class InboxSendError extends Error {}

/**
 * Send the owner's reply. Uses the free LINE reply token when the customer's
 * message is still fresh, otherwise a push (counts against the monthly quota).
 */
export async function sendInboxReply(threadId: string, rawBubbles: string[], opts: { draftId?: string | null; sentBy: string }) {
  const thread = await prisma.inboxThread.findUnique({ where: { id: threadId } });
  if (!thread) throw new InboxSendError("ไม่พบแชทนี้");
  if (thread.channel !== "LINE") throw new InboxSendError("ยังส่งได้เฉพาะ LINE");
  const bubbles = rawBubbles.map(b => b.trim()).filter(Boolean);
  if (bubbles.length === 0) throw new InboxSendError("ไม่มีข้อความ");
  if (bubbles.length > 5) throw new InboxSendError("ส่งได้ครั้งละไม่เกิน 5 ข้อความ");
  if (bubbles.some(b => b.length > 4800)) throw new InboxSendError("ข้อความยาวเกินไป");

  // Double-tap guard: the same last bubble already went out a moment ago.
  const recent = await prisma.inboxMessage.findFirst({
    where: { threadId, direction: "OUT", createdAt: { gte: new Date(Date.now() - 20_000) } },
    orderBy: { createdAt: "desc" }, select: { text: true },
  });
  if (recent?.text === bubbles[bubbles.length - 1]) throw new InboxSendError("เพิ่งส่งข้อความนี้ไปแล้ว");

  const messages: LineMessage[] = bubbles.map(text => ({ type: "text", text }));
  let via: "reply" | "push" = "push";
  let result: { ok: boolean; error?: string } | null = null;
  if (thread.replyToken && thread.replyTokenAt && Date.now() - thread.replyTokenAt.getTime() < REPLY_TOKEN_MAX_AGE_MS) {
    // Claim the one-shot token so two sends can't both use it.
    const claimed = await prisma.inboxThread.updateMany({ where: { id: threadId, replyToken: thread.replyToken }, data: { replyToken: null, replyTokenAt: null } });
    if (claimed.count === 1) {
      result = await replyLine(thread.replyToken, messages);
      if (result.ok) via = "reply";
    }
  }
  if (!result?.ok) result = await pushLine(thread.externalUserId, messages);
  if (!result.ok) throw new InboxSendError(`LINE ไม่รับข้อความ: ${result.error ?? "unknown"}`);

  const now = Date.now();
  await prisma.$transaction([
    ...bubbles.map((text, i) => prisma.inboxMessage.create({
      data: { threadId, direction: "OUT", kind: "text", text, sentBy: opts.sentBy, draftId: opts.draftId ?? null, createdAt: new Date(now + i) },
    })),
    prisma.inboxThread.update({ where: { id: threadId }, data: { lastMessageAt: new Date(now), unread: 0, replyToken: null, replyTokenAt: null } }),
    prisma.inboxDraft.updateMany({ where: { threadId, status: { in: ["PENDING", "FAILED"] } }, data: { status: "STALE" } }),
  ]);
  if (opts.draftId) {
    const draft = await prisma.inboxDraft.findUnique({ where: { id: opts.draftId }, select: { bubbles: true, threadId: true } });
    if (draft?.threadId === threadId) {
      const same = JSON.stringify(draft.bubbles) === JSON.stringify(bubbles);
      await prisma.inboxDraft.update({ where: { id: opts.draftId }, data: { status: same ? "USED" : "EDITED" } });
    }
  }
  return { via, count: bubbles.length };
}

// ── LINE quota (for the inbox header) ────────────────────────────────────────

let quotaCache: { at: number; value: { used: number; limit: number | null } | null } | null = null;

/** This month's LINE message usage; cached 5 minutes. */
export async function lineQuota(): Promise<{ used: number; limit: number | null } | null> {
  if (quotaCache && Date.now() - quotaCache.at < 5 * 60_000) return quotaCache.value;
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN?.trim();
  if (!token) return null;
  const get = (path: string) => fetch(`https://api.line.me/v2/bot/message/${path}`, {
    headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5_000),
  }).then(r => r.ok ? r.json() : null).catch(() => null);
  const [quota, usage] = await Promise.all([get("quota"), get("quota/consumption")]);
  const value = usage ? { used: Number(usage.totalUsage ?? 0), limit: quota?.type === "limited" ? Number(quota.value) : null } : null;
  quotaCache = { at: Date.now(), value };
  return value;
}
