import { prisma } from "@/lib/prisma";
import { randomUUID } from "node:crypto";
import { getLineMessageContent, pushLine, replyLine, type LineMessage } from "@/lib/line-messaging";
import { storeImage } from "@/lib/upload";
import { fetchMetaProfile, sendMetaMessage, type MetaChannel } from "@/lib/meta";
import { MENU_IMAGES, menuImageUrls } from "@/lib/inbox-media";

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
export async function recordLineInbound(event: LineMessageEvent): Promise<{ threadId: string; messageId: string; kind: string; lineMessageId: string | null } | null> {
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
    return { threadId: thread.id, messageId: msg.id, kind, lineMessageId: event.message.id ?? null };
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
export async function sendInboxReply(threadId: string, rawBubbles: string[], opts: { draftId?: string | null; sentBy: string; images?: string[] }) {
  const thread = await prisma.inboxThread.findUnique({ where: { id: threadId } });
  if (!thread) throw new InboxSendError("ไม่พบแชทนี้");
  const bubbles = rawBubbles.map(b => b.trim()).filter(Boolean);
  const images = [...new Set(opts.images ?? [])].map(k => MENU_IMAGES.find(m => m.key === k)).filter(m => !!m);
  if (bubbles.length + images.length === 0) throw new InboxSendError("ไม่มีข้อความ");
  if (bubbles.length + images.length > 5) throw new InboxSendError("ส่งได้ครั้งละไม่เกิน 5 ข้อความ (รวมรูป)");
  if (bubbles.some(b => b.length > 4800)) throw new InboxSendError("ข้อความยาวเกินไป");

  // Double-tap guard: the same last bubble already went out a moment ago.
  const recent = await prisma.inboxMessage.findFirst({
    where: { threadId, direction: "OUT", createdAt: { gte: new Date(Date.now() - 20_000) } },
    orderBy: { createdAt: "desc" }, select: { text: true },
  });
  const lastOut = bubbles[bubbles.length - 1] ?? images[images.length - 1]?.title;
  if (recent?.text === lastOut) throw new InboxSendError("เพิ่งส่งข้อความนี้ไปแล้ว");

  if (thread.channel === "FACEBOOK" || thread.channel === "INSTAGRAM") {
    return sendMetaReply(thread, bubbles, images, opts);
  }

  const messages: LineMessage[] = [
    ...bubbles.map(text => ({ type: "text" as const, text })),
    // LINE image message (line-messaging's LineMessage type lists only text/flex).
    ...images.map(m => {
      const u = menuImageUrls(m.key);
      return { type: "image", originalContentUrl: u.original, previewImageUrl: u.preview } as unknown as LineMessage;
    }),
  ];
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
    ...[...bubbles.map(text => ({ kind: "text", text })), ...images.map(m => ({ kind: "image", text: m.title }))].map((m, i) => prisma.inboxMessage.create({
      data: { threadId, direction: "OUT", kind: m.kind, text: m.text, sentBy: opts.sentBy, draftId: opts.draftId ?? null, createdAt: new Date(now + i) },
    })),
    prisma.inboxThread.update({ where: { id: threadId }, data: { lastMessageAt: new Date(now), unread: 0, replyToken: null, replyTokenAt: null } }),
    prisma.inboxDraft.updateMany({ where: { threadId, status: { in: ["PENDING", "FAILED"] } }, data: { status: "STALE" } }),
  ]);
  if (opts.draftId) {
    const draft = await prisma.inboxDraft.findUnique({ where: { id: opts.draftId }, select: { bubbles: true, images: true, threadId: true } });
    if (draft?.threadId === threadId) {
      const same = JSON.stringify(draft.bubbles) === JSON.stringify(bubbles)
        && JSON.stringify(draft.images ?? []) === JSON.stringify(images.map(m => m.key));
      await prisma.inboxDraft.update({ where: { id: opts.draftId }, data: { status: same ? "USED" : "EDITED" } });
    }
  }
  return { via, count: messages.length };
}

/** Messenger / Instagram: one API call per bubble or image; 24 h window, then the human-agent tag (7 days). */
async function sendMetaReply(
  thread: { id: string; externalUserId: string; lastInboundAt: Date | null },
  bubbles: string[], images: { key: string; title: string }[],
  opts: { draftId?: string | null; sentBy: string },
) {
  const since = thread.lastInboundAt ? Date.now() - thread.lastInboundAt.getTime() : Infinity;
  if (since > 7 * 86_400_000) throw new InboxSendError("ลูกค้าทักมาเกิน 7 วันแล้ว — ตามกฎของ Meta ส่งข้อความหาไม่ได้จนกว่าลูกค้าจะทักมาใหม่");
  const humanAgent = since > 24 * 3_600_000;
  const items = [
    ...bubbles.map(text => ({ kind: "text", text, out: { type: "text" as const, text } })),
    ...images.map(m => ({ kind: "image", text: m.title, out: { type: "image" as const, url: menuImageUrls(m.key).original } })),
  ];
  const sent: { kind: string; text: string; mid?: string }[] = [];
  let failure: string | null = null;
  for (const it of items) {
    const r = await sendMetaMessage(thread.externalUserId, it.out, { humanAgent });
    if (!r.ok) { failure = r.error ?? "unknown"; break; }
    sent.push({ kind: it.kind, text: it.text, mid: r.messageId });
  }
  const now = Date.now();
  if (sent.length) {
    await prisma.$transaction([
      // externalId = Meta's message id, so the echo Meta sends back isn't recorded twice.
      ...sent.map((m, i) => prisma.inboxMessage.create({
        data: { threadId: thread.id, direction: "OUT", kind: m.kind, text: m.text, externalId: m.mid ? `meta:${m.mid}` : null, sentBy: opts.sentBy, draftId: opts.draftId ?? null, createdAt: new Date(now + i) },
      })),
      prisma.inboxThread.update({ where: { id: thread.id }, data: { lastMessageAt: new Date(now), unread: 0 } }),
      prisma.inboxDraft.updateMany({ where: { threadId: thread.id, status: { in: ["PENDING", "FAILED"] } }, data: { status: "STALE" } }),
    ]);
  }
  if (failure) {
    const hint = humanAgent ? " (เกิน 24 ชม. ต้องใช้สิทธิ์ Human Agent จาก Meta)" : "";
    throw new InboxSendError(`${sent.length ? `ส่งไปแล้ว ${sent.length} ข้อความ แล้ว` : ""}Meta ไม่รับข้อความ: ${failure}${hint}`);
  }
  if (opts.draftId) {
    const draft = await prisma.inboxDraft.findUnique({ where: { id: opts.draftId }, select: { bubbles: true, images: true, threadId: true } });
    if (draft?.threadId === thread.id) {
      const same = JSON.stringify(draft.bubbles) === JSON.stringify(bubbles)
        && JSON.stringify(draft.images ?? []) === JSON.stringify(images.map(m => m.key));
      await prisma.inboxDraft.update({ where: { id: opts.draftId }, data: { status: same ? "USED" : "EDITED" } });
    }
  }
  return { via: humanAgent ? "human_agent" : "reply", count: sent.length };
}

// ── Facebook / Instagram inbound ─────────────────────────────────────────────

export interface MetaInbound {
  channel: MetaChannel;
  userId: string;
  mid: string | null;
  text: string | null;
  imageUrl: string | null;
  kind: "text" | "image" | "sticker" | "other";
  at: Date;
}

/** Save a customer's Messenger / Instagram message. Null when already saved (Meta retries). */
export async function recordMetaInbound(m: MetaInbound): Promise<{ threadId: string; messageId: string; kind: string; imageUrl: string | null } | null> {
  const externalId = m.mid ? `meta:${m.mid}` : null;
  if (externalId && await prisma.inboxMessage.findUnique({ where: { externalId }, select: { id: true } })) return null;
  let thread = await prisma.inboxThread.findUnique({ where: { channel_externalUserId: { channel: m.channel, externalUserId: m.userId } } });
  if (!thread) {
    const profile = await fetchMetaProfile(m.channel, m.userId);
    thread = await prisma.inboxThread.upsert({
      where: { channel_externalUserId: { channel: m.channel, externalUserId: m.userId } },
      create: { channel: m.channel, externalUserId: m.userId, displayName: profile.name, pictureUrl: profile.pictureUrl },
      update: {},
    });
  }
  try {
    const msg = await prisma.inboxMessage.create({
      data: { threadId: thread.id, direction: "IN", kind: m.kind, text: m.text, externalId, createdAt: m.at },
    });
    await prisma.inboxThread.update({ where: { id: thread.id }, data: { lastMessageAt: m.at, lastInboundAt: m.at, unread: { increment: 1 } } });
    return { threadId: thread.id, messageId: msg.id, kind: m.kind, imageUrl: m.imageUrl };
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") return null;
    throw e;
  }
}

/**
 * A reply the owner typed in Meta Business Suite / the Instagram app (Meta echoes
 * it to the webhook — unlike LINE). Our own sends are already saved under the
 * same message id, so they are skipped.
 */
export async function recordMetaEcho(m: { channel: MetaChannel; userId: string; mid: string | null; text: string | null; kind: string; at: Date }) {
  const externalId = m.mid ? `meta:${m.mid}` : null;
  if (!externalId || await prisma.inboxMessage.findUnique({ where: { externalId }, select: { id: true } })) return;
  const thread = await prisma.inboxThread.findUnique({ where: { channel_externalUserId: { channel: m.channel, externalUserId: m.userId } } });
  if (!thread) return;
  try {
    await prisma.$transaction([
      prisma.inboxMessage.create({ data: { threadId: thread.id, direction: "OUT", kind: m.kind, text: m.text, externalId, sentBy: "Meta Business Suite", createdAt: m.at } }),
      prisma.inboxThread.update({ where: { id: thread.id }, data: { lastMessageAt: m.at, unread: 0 } }),
      prisma.inboxDraft.updateMany({ where: { threadId: thread.id, status: { in: ["PENDING", "READY", "FAILED"] } }, data: { status: "STALE" } }),
    ]);
  } catch (e) {
    // Our own send may land between the check and the insert — same message, already saved.
    if (!(e && typeof e === "object" && "code" in e && e.code === "P2002")) throw e;
  }
}

/** Keep our copy of a photo from Messenger / Instagram (Meta's attachment URLs expire). */
export async function saveRemoteImage(messageId: string, url: string): Promise<string | null> {
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) }).catch(() => null);
  if (!res?.ok) return null;
  const type = (res.headers.get("content-type") ?? "").split(";")[0].trim();
  const ext = IMAGE_EXT[type];
  if (!ext) return null;
  const stored = await storeImage(`inbox/${randomUUID()}.${ext}`, Buffer.from(await res.arrayBuffer()), type);
  await prisma.inboxMessage.update({ where: { id: messageId }, data: { mediaUrl: stored } });
  return stored;
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

/**
 * The owner already answered in LINE OA Manager (LINE never tells us about those
 * replies). Record it — with the text when pasted — so the inbox and the next
 * AI draft know the customer has been answered.
 */
export async function markAnsweredInLineOa(threadId: string, text: string | null, by: string) {
  const thread = await prisma.inboxThread.findUnique({ where: { id: threadId }, select: { id: true } });
  if (!thread) throw new InboxSendError("ไม่พบแชทนี้");
  const body = text?.trim().slice(0, 4800) || null;
  await prisma.$transaction([
    prisma.inboxMessage.create({
      data: { threadId, direction: "OUT", kind: body ? "text" : "note", text: body ?? "แอดมินตอบใน LINE OA แล้ว", sentBy: `${by} (LINE OA)` },
    }),
    prisma.inboxThread.update({ where: { id: threadId }, data: { lastMessageAt: new Date(), unread: 0 } }),
    prisma.inboxDraft.updateMany({ where: { threadId, status: { in: ["PENDING", "READY", "FAILED"] } }, data: { status: "STALE" } }),
  ]);
}

const IMAGE_EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };

/**
 * Keep our own copy of a customer's photo (LINE serves message content only
 * for a limited time) so the owner and the AI can see it in the inbox.
 */
export async function saveInboundImage(messageId: string, lineMessageId: string): Promise<string | null> {
  const content = await getLineMessageContent(lineMessageId);
  if (!content) return null;
  const type = content.contentType.split(";")[0].trim();
  const ext = IMAGE_EXT[type];
  if (!ext) return null;
  const url = await storeImage(`inbox/${randomUUID()}.${ext}`, content.buffer, type);
  await prisma.inboxMessage.update({ where: { id: messageId }, data: { mediaUrl: url } });
  return url;
}
