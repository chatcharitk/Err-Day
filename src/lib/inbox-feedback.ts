/**
 * Reason chips the owner taps when an AI draft needed editing. Short, fixed
 * list so the weekly numbers can be counted; "อื่นๆ" + a note covers the rest.
 */
export const DRAFT_FEEDBACK_REASONS = [
  "ข้อมูลผิด",
  "ยาวไป / พูดเกิน",
  "น้ำเสียงไม่ใช่",
  "ถามซ้ำ / ถามเกิน",
  "ไม่ได้เช็คคิว / เวลาผิด",
  "ไม่ควรจอง / ยกเลิก",
  "AI ไม่รู้เรื่องนี้",
  "อื่นๆ",
] as const;

/** Same text once spaces and emoji are ignored? (USED vs EDITED uses the server's own rule.) */
export function sameReply(a: string[], b: string[]): boolean {
  const n = (x: string[]) => x.join("").replace(/\s+/g, "").replace(/\p{Extended_Pictographic}/gu, "");
  return n(a) === n(b);
}

