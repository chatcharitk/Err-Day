/**
 * TEST LINE webhook — sandbox @err.day [TEST] channel.
 *
 * Phase 4: full AI agent with memory, rate-limiting, reset, and handoff.
 *
 * Special commands (case-insensitive, work for anyone, no allowlist needed):
 *   "myid"                                — returns sender's LINE userId
 *   "reset" / "เริ่มใหม่" / "ล้าง"          — clears conversation history
 *   "ติดต่อแอดมิน" / "พูดกับคน" / "human"  — handoff: pause agent, log request
 *
 * Env vars:
 *   LINE_CHANNEL_SECRET_TEST       — test channel signing secret
 *   LINE_CHANNEL_ACCESS_TOKEN_TEST — test channel access token
 *   LINE_USER_ID_TEST              — comma-separated allowlist
 *   ANTHROPIC_API_KEY              — Claude API key
 */
import { createLineWebhookHandler, type TextMessageEvent } from "@/lib/line-webhook";
import { runAgent } from "@/lib/agent";
import { recordReset, recordHandoffRequest } from "@/lib/agent/memory";
import { checkRateLimit, rateLimitMessage } from "@/lib/agent/rate-limit";

const STUB_REPLY =
  "🧪 [TEST CHANNEL] สวัสดีค่ะ\n" +
  "ขณะนี้ AI ผู้ช่วยกำลังทดสอบเฉพาะกลุ่มผู้ทดสอบ\n\n" +
  "📅 จองคิว: https://err-day.vercel.app/book\n" +
  "👥 สมาชิก: https://err-day.vercel.app/membership";

const RESET_KEYWORDS   = ["reset", "เริ่มใหม่", "ล้าง", "ล้างประวัติ"];
const HANDOFF_PATTERNS = [
  /ติดต่อ.*(แอดมิน|คน|พนักงาน|ทีมงาน)/i,
  /พูด(กับ)?(คน|แอดมิน|ทีมงาน)/i,
  /\b(human|admin|staff|operator)\b/i,
];

const HANDOFF_REPLY =
  "🤝 รับเรื่องแล้วค่ะ — ระบบจะหยุดตอบอัตโนมัติ\n" +
  "ทีมงานจะติดต่อกลับเร็วๆ นี้ค่ะ 🌸\n\n" +
  "หรือโทรหาสาขาโดยตรง:\n" +
  "• สุขุมวิท 0996061465\n" +
  "• บางนา 0962121465\n\n" +
  "(พิมพ์ \"reset\" เพื่อกลับมาคุยกับ AI ใหม่)";


function getAllowedUserIds(): Set<string> {
  const raw = process.env.LINE_USER_ID_TEST ?? "";
  return new Set(raw.split(",").map(s => s.trim()).filter(Boolean));
}

function isResetCommand(text: string): boolean {
  return RESET_KEYWORDS.includes(text.trim().toLowerCase());
}
function isHandoffCommand(text: string): boolean {
  return HANDOFF_PATTERNS.some(re => re.test(text));
}


async function buildReply(event: TextMessageEvent): Promise<string> {
  const userId   = event.source?.userId;
  const userText = event.message.text.trim();
  const allowed  = getAllowedUserIds();

  // ── Magic command: myid — works for anyone, no allowlist required ─────────
  if (userText.toLowerCase() === "myid") {
    return userId
      ? `LINE userId ของคุณคือ:\n${userId}\n\nคัดลอกไปวางใน LINE_USER_ID_TEST บน Vercel เพื่อรับการตอบจาก AI`
      : "ไม่พบ LINE userId ของคุณ — ลองส่งข้อความใหม่อีกครั้งค่ะ";
  }

  // ── Allowlist gate (only testers reach the agent) ─────────────────────────
  if (!userId || allowed.size === 0 || !allowed.has(userId)) {
    return STUB_REPLY;
  }

  // ── Reset command — clear conversation history ────────────────────────────
  if (isResetCommand(userText)) {
    await recordReset(userId);
    return "เริ่มต้นการสนทนาใหม่แล้วค่ะ 🌸\nมีอะไรให้ช่วยมั้ยคะ?";
  }

  // ── Handoff command — pause agent, log request ────────────────────────────
  if (isHandoffCommand(userText)) {
    await recordHandoffRequest(userId, userText);
    return HANDOFF_REPLY;
  }

  // ── Rate limit ────────────────────────────────────────────────────────────
  const limit = await checkRateLimit(userId);
  if (!limit.ok) {
    console.warn(`[agent] rate limit hit for ${userId}: reason=${limit.reason} per_minute=${limit.per_minute} per_day=${limit.per_day}`);
    return rateLimitMessage(limit.reason!);
  }

  // ── Run the AI agent ──────────────────────────────────────────────────────
  try {
    const { text, toolsUsed, iterations } = await runAgent({
      userMessage: userText,
      lineUserId:  userId,
    });
    console.log(`[agent] iterations=${iterations} tools=${toolsUsed.join(",") || "none"}`);
    return text;
  } catch (e) {
    console.error("[agent] error:", e);
    return "🧪 [TEST] ขออภัยค่ะ AI ขัดข้องชั่วคราว — กรุณาลองอีกครั้ง\n(หากเร่งด่วน พิมพ์ \"ติดต่อแอดมิน\" ค่ะ)";
  }
}

export const POST = createLineWebhookHandler({
  label:         "test",
  channelSecret: process.env.LINE_CHANNEL_SECRET_TEST,
  accessToken:   process.env.LINE_CHANNEL_ACCESS_TOKEN_TEST,
  buildReply,
});
