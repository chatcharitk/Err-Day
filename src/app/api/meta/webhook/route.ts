/**
 * Meta webhook — Facebook Page messages and Instagram DMs for the AI inbox.
 * Nothing is ever sent from here: messages are saved, a reply is drafted for
 * the owner, and the owner's own replies typed in Meta Business Suite (echoes)
 * are recorded so the inbox stays complete.
 */
import { after, NextResponse } from "next/server";
import { verifyMetaSignature, type MetaChannel } from "@/lib/meta";
import { recordMetaEcho, recordMetaInbound, saveRemoteImage } from "@/lib/inbox";
import { draftReply } from "@/lib/inbox-ai";

export const maxDuration = 60;

interface MetaMessagingEvent {
  sender?: { id: string };
  recipient?: { id: string };
  timestamp?: number;
  message?: {
    mid?: string; text?: string; is_echo?: boolean; is_deleted?: boolean;
    attachments?: { type?: string; payload?: { url?: string; sticker_id?: number } }[];
  };
}
interface MetaWebhookBody { object?: string; entry?: { id: string; messaging?: MetaMessagingEvent[] }[] }

/** Webhook verification handshake (Meta app dashboard → Webhooks → Verify and save). */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const token = process.env.META_VERIFY_TOKEN?.trim();
  if (q.get("hub.mode") === "subscribe" && token && q.get("hub.verify_token") === token) {
    return new Response(q.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("forbidden", { status: 403 });
}

export async function POST(request: Request) {
  const raw = await request.text();
  if (!verifyMetaSignature(raw, request.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }
  let body: MetaWebhookBody;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ ok: true }); }
  const channel: MetaChannel | null = body.object === "page" ? "FACEBOOK" : body.object === "instagram" ? "INSTAGRAM" : null;
  if (!channel) return NextResponse.json({ ok: true });

  for (const entry of body.entry ?? []) {
    for (const ev of entry.messaging ?? []) {
      const m = ev.message;
      if (!m || m.is_deleted || !ev.sender?.id || !ev.recipient?.id) continue;
      const att = m.attachments?.[0];
      const kind = m.text ? "text" : att?.type === "image" ? (att.payload?.sticker_id ? "sticker" : "image") : att ? "other" : "text";
      const at = new Date(ev.timestamp ?? Date.now());
      try {
        if (m.is_echo) {
          // Sent from the Page/IG account. Wait a moment so our own sends are saved first.
          const echo = { channel, userId: ev.recipient.id, mid: m.mid ?? null, text: m.text ?? null, kind, at };
          after(async () => {
            await new Promise(r => setTimeout(r, 5_000));
            await recordMetaEcho(echo).catch(e => console.error("[meta] echo record failed", e));
          });
          continue;
        }
        const saved = await recordMetaInbound({
          channel, userId: ev.sender.id, mid: m.mid ?? null, text: m.text ?? null,
          imageUrl: kind === "image" ? att?.payload?.url ?? null : null,
          kind: kind as "text" | "image" | "sticker" | "other", at,
        });
        if (saved) {
          after(async () => {
            if (saved.imageUrl) await saveRemoteImage(saved.messageId, saved.imageUrl).catch(e => console.error("[meta] image save failed", e));
            await draftReply(saved.threadId, saved.messageId, { debounce: true, notify: true })
              .catch(e => console.error("[meta] inbox draft failed", e));
          });
        }
      } catch (e) {
        console.error("[meta] inbound failed", e);
      }
    }
  }
  return NextResponse.json({ ok: true });
}
