/**
 * Choices and types for the hair-colour record — no server imports, so the
 * client screens and the API share one list (mirrors the paper form).
 */
export const CONSENT_VERSION = "2026-10-27";

export const OPT = {
  length:    ["สั้น", "ประบ่า", "กลางหลัง", "ยาวมาก"],
  texture:   ["เส้นเล็ก", "เส้นกลาง", "เส้นใหญ่"],
  curl:      ["ผมตรง", "ผมหยักศก"],
  density:   ["บาง", "ปานกลาง", "หนา"],
  condition: ["แข็งแรง", "แห้ง", "พรุน / ดูดสีเร็ว", "ขาดง่าย", "ปลายเสีย"],
  scalp:     ["ปกติ", "แห้ง", "มัน", "มีอาการระคายเคือง"],
  chemical:  ["ทำสี", "ฟอก / ไฮไลต์", "ยืด", "ดัด", "เคราติน", "ไม่มี"],
  lastChem:  ["น้อยกว่า 1 เดือน", "1–3 เดือน", "3–6 เดือน", "6–12 เดือน", "นานกว่า 1 ปี"],
  service:   ["ทำสีทั้งศีรษะ", "เติมโคน", "ปรับโทน / โทนเนอร์", "ฟอก", "ไฮไลต์"],
  preCheck:  ["ประวัติแพ้ / หนังศีรษะ", "ประวัติฟอก / ยืด / ดัด", "สภาพผมเสีย / พรุน", "ทดสอบช่อผมถ้าจำเป็น"],
  developer: ["1.5%", "3%", "6%", "9%", "12%"],
  ratio:     ["1:1", "1:1.5", "1:2", "1:3"],
  scalpAfter: ["ปกติ", "แห้ง", "ระคายเคือง / ต้องติดตาม"],
} as const;

export const ALLERGY_LABEL: Record<string, string> = { NONE: "ไม่เคยแพ้", YES: "เคยแพ้", UNSURE: "ไม่แน่ใจ", UNKNOWN: "ยังไม่ได้ถาม" };
export const RESULT_LABEL: Record<string, string> = { ON_TARGET: "ตรงตามเป้าหมาย", DARKER: "เข้มกว่า", LIGHTER: "อ่อนกว่า", NEEDS_FIX: "ต้องปรับแก้" };
export const ZONE_LABEL: Record<string, string> = { ROOT: "โคน", MID: "ช่วงกลาง", ENDS: "ปลายผม", TONER: "อื่นๆ / โทนเนอร์" };
export const ZONES = ["ROOT", "MID", "ENDS", "TONER"] as const;
export const RETOUCH_WEEKS = 8;

export type ColorShade = { productId: string | null; label: string; grams: number };
export type ColorZone = {
  zone: (typeof ZONES)[number];
  shades: ColorShade[];
  developerPercent: string | null;
  ratio: string | null;
  minutes: number | null;
  startedAt: string | null;
  rinsedAt: string | null;
};

/** Developer grams for a zone = colour grams × ratio (1:1.5 → ×1.5). */
export function developerGramsOf(z: Pick<ColorZone, "shades" | "ratio">): number {
  const color = z.shades.reduce((s, x) => s + (x.grams || 0), 0);
  const m = z.ratio?.match(/^1:(\d+(?:\.\d+)?)$/);
  return m ? Math.round(color * Number(m[1])) : 0;
}
