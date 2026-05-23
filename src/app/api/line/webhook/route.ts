/**
 * PRODUCTION LINE webhook — connected to the live @err.day Messaging API
 * channel. Customers see whatever this returns.
 *
 * Phase 1: stub reply pointing to /book + /membership.
 * Phase 2+: routed to the Claude AI agent (lookup_branches, availability, …).
 *
 * The TEST channel uses /api/line/webhook-test which can run experimental
 * agent code without affecting live customers.
 */
import { createLineWebhookHandler } from "@/lib/line-webhook";

const STUB_REPLY =
  "สวัสดีค่ะ 🌸 ขอบคุณที่ติดต่อ err.day\n\n" +
  "ขณะนี้ระบบ AI ผู้ช่วยกำลังเตรียมพร้อม\n" +
  "📅 จองคิวออนไลน์: https://err-day.vercel.app/book\n" +
  "👥 สมาชิก: https://err-day.vercel.app/membership\n\n" +
  "หรือพิมพ์ข้อความรอแอดมินตอบกลับได้เลยค่ะ";

export const POST = createLineWebhookHandler({
  label:         "prod",
  channelSecret: process.env.LINE_CHANNEL_SECRET,
  accessToken:   process.env.LINE_CHANNEL_ACCESS_TOKEN,
  buildReply:    async () => STUB_REPLY,
});
