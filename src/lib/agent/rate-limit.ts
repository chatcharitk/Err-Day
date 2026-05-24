/**
 * Per-user rate limiting for the LINE chat agent.
 *
 * Uses the ChatMessage table as the counter source (rather than in-memory)
 * so limits survive Vercel cold starts and apply consistently across all
 * function invocations.
 *
 * Limits are conservative — designed to stop runaway costs from a single
 * abusive sender, not to throttle normal customer conversations.
 */
import { prisma } from "@/lib/prisma";

const PER_MINUTE = 5;     // max 5 messages from one user in 60 seconds
const PER_DAY    = 100;   // max 100 messages from one user in 24 hours

export type RateLimitReason = "minute" | "day";
export interface RateLimitResult {
  ok:           boolean;
  reason?:      RateLimitReason;
  per_minute:   number;
  per_day:      number;
}

export async function checkRateLimit(lineUserId: string): Promise<RateLimitResult> {
  const now        = new Date();
  const oneMinAgo  = new Date(now.getTime() - 60_000);
  const oneDayAgo  = new Date(now.getTime() - 86_400_000);

  const [perMinute, perDay] = await Promise.all([
    prisma.chatMessage.count({
      where: { lineUserId, role: "user", createdAt: { gte: oneMinAgo } },
    }),
    prisma.chatMessage.count({
      where: { lineUserId, role: "user", createdAt: { gte: oneDayAgo } },
    }),
  ]);

  if (perMinute >= PER_MINUTE) return { ok: false, reason: "minute", per_minute: perMinute, per_day: perDay };
  if (perDay    >= PER_DAY)    return { ok: false, reason: "day",    per_minute: perMinute, per_day: perDay };
  return { ok: true, per_minute: perMinute, per_day: perDay };
}

export function rateLimitMessage(reason: RateLimitReason): string {
  if (reason === "minute") {
    return "🌸 ขออภัยค่ะ คุณส่งข้อความถี่เกินไป\nกรุณาพักสักครู่ (~1 นาที) แล้วลองใหม่นะคะ";
  }
  return "🌸 วันนี้คุณใช้งานครบโควต้าแล้วค่ะ\nกรุณาลองใหม่พรุ่งนี้ หรือทักแชทแอดมินได้เลยค่ะ";
}
