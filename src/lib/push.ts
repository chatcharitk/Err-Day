/**
 * Web Push sender (VAPID). Pushes to admin devices that have installed the PWA
 * and subscribed. Configured lazily from env so dev/preview without VAPID keys
 * simply no-ops instead of throwing.
 *
 * Env: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:…).
 */

import webpush from "web-push";
import { prisma } from "@/lib/prisma";

let configured = false;
function ensureVapid(): boolean {
  if (configured) return true;
  const pub  = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@err-daysalon.com", pub, priv);
  configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body:  string;
  url?:  string;   // deep link opened on click
  tag?:  string;   // collapse key
}

export interface PushSub { id: string; endpoint: string; p256dh: string; auth: string }

/**
 * Send a web push to each subscription. Dead subscriptions (HTTP 404/410) are
 * pruned. No-op (with a warning) when VAPID isn't configured.
 */
export async function sendWebPush(subs: PushSub[], payload: PushPayload): Promise<void> {
  if (subs.length === 0) return;
  if (!ensureVapid()) { console.warn("[push] VAPID not configured — skipping web push"); return; }

  const data = JSON.stringify(payload);
  const dead: string[] = [];

  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        data,
      );
    } catch (e) {
      const code = (e as { statusCode?: number })?.statusCode;
      if (code === 404 || code === 410) dead.push(s.id);
      else console.error("[push] send failed", code, (e as { body?: string })?.body);
    }
  }));

  if (dead.length) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: dead } } }).catch(() => {});
  }
}
