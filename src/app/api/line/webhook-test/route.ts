/**
 * TEST LINE webhook — connected to a sandbox @err.day-test Messaging API
 * channel that only the salon owner has added as a friend.
 *
 * This is where experimental agent code lands first. When something works
 * well here, promote it to the production webhook at /api/line/webhook.
 *
 * Env vars required:
 *   LINE_CHANNEL_SECRET_TEST       — signing secret of the TEST channel
 *   LINE_CHANNEL_ACCESS_TOKEN_TEST — access token of the TEST channel
 *
 * Configure the TEST channel's webhook URL in LINE Console to:
 *   https://err-day.vercel.app/api/line/webhook-test
 */
import { createLineWebhookHandler, type TextMessageEvent } from "@/lib/line-webhook";

// Phase 1 stub — same as production but labelled so you can see during
// testing that messages are hitting the right webhook. Replaced with the
// Claude AI agent in Phase 2.
const STUB_REPLY =
  "🧪 [TEST CHANNEL] สวัสดีค่ะ\n" +
  "นี่คือช่องทดสอบของ err.day — กำลังเตรียม AI ผู้ช่วย\n\n" +
  "📅 จองคิว: https://err-day.vercel.app/book\n" +
  "👥 สมาชิก: https://err-day.vercel.app/membership";

async function buildReply(event: TextMessageEvent): Promise<string> {
  // For now: echo back the user's message so you can confirm round-trip works.
  const userText = event.message.text.trim();
  return `${STUB_REPLY}\n\n— ข้อความที่ได้รับ —\n"${userText}"`;
}

export const POST = createLineWebhookHandler({
  label:         "test",
  channelSecret: process.env.LINE_CHANNEL_SECRET_TEST,
  accessToken:   process.env.LINE_CHANNEL_ACCESS_TOKEN_TEST,
  buildReply,
});
