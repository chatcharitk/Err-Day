/**
 * TEST LINE webhook — sandbox @err.day [TEST] channel.
 *
 * Phase 2: routes inbound text messages through the Claude AI agent — BUT
 * only for LINE user IDs in the LINE_USER_ID_TEST allowlist (comma-separated).
 * Anyone else who happens to message the test OA gets a safe stub.
 *
 * Env vars:
 *   LINE_CHANNEL_SECRET_TEST       — test channel signing secret
 *   LINE_CHANNEL_ACCESS_TOKEN_TEST — test channel access token
 *   LINE_USER_ID_TEST              — comma-separated allowlist of LINE userIds
 *                                    (Uxxxxx,Uyyyyy). If unset, falls back
 *                                    to "stub for all" behavior.
 *   ANTHROPIC_API_KEY              — Claude API key (console.anthropic.com)
 *   ANTHROPIC_MODEL                — optional override (default sonnet-4.5)
 */
import { createLineWebhookHandler, type TextMessageEvent } from "@/lib/line-webhook";
import { runAgent } from "@/lib/agent";

const STUB_REPLY =
  "🧪 [TEST CHANNEL] สวัสดีค่ะ\n" +
  "ขณะนี้ AI ผู้ช่วยกำลังทดสอบเฉพาะกลุ่มผู้ทดสอบ\n\n" +
  "📅 จองคิว: https://err-day.vercel.app/book\n" +
  "👥 สมาชิก: https://err-day.vercel.app/membership";


/** Parse the LINE_USER_ID_TEST env var into a Set for O(1) lookup. */
function getAllowedUserIds(): Set<string> {
  const raw = process.env.LINE_USER_ID_TEST ?? "";
  return new Set(
    raw.split(",").map(s => s.trim()).filter(Boolean),
  );
}

async function buildReply(event: TextMessageEvent): Promise<string> {
  const userId   = event.source?.userId;
  const userText = event.message.text.trim();
  const allowed  = getAllowedUserIds();

  // myid: utility for getting one's own LINE userId so it can be added to the
  // allowlist. Works for anyone — not gated by the allowlist itself.
  if (userText.toLowerCase() === "myid") {
    return userId
      ? `LINE userId ของคุณคือ:\n${userId}\n\nคัดลอกไปวางใน LINE_USER_ID_TEST บน Vercel เพื่อรับการตอบจาก AI`
      : "ไม่พบ LINE userId ของคุณ — ลองส่งข้อความใหม่อีกครั้งค่ะ";
  }

  // Allowlist gate: only specific testers get the AI agent.
  if (!userId || allowed.size === 0 || !allowed.has(userId)) {
    return STUB_REPLY;
  }

  // Tester is allowed → call the Claude agent.
  try {
    const { text, toolsUsed, iterations } = await runAgent(userText);
    console.log(`[agent] iterations=${iterations} tools=${toolsUsed.join(",") || "none"}`);
    return text;
  } catch (e) {
    console.error("[agent] error:", e);
    return "🧪 [TEST] ขออภัยค่ะ AI ขัดข้องชั่วคราว — กรุณาลองอีกครั้ง";
  }
}

export const POST = createLineWebhookHandler({
  label:         "test",
  channelSecret: process.env.LINE_CHANNEL_SECRET_TEST,
  accessToken:   process.env.LINE_CHANNEL_ACCESS_TOKEN_TEST,
  buildReply,
});
