/**
 * ค่าเชียร์ prompts: who is due a nudge to come back for a repeat service.
 * Treatments are due 1 week after the visit, colouring 8 weeks after (roots
 * are showing by then). Pure helpers — the digest sender is in notifications.ts.
 */

export type CheerKind = "treatment" | "color";

/** Days after a COMPLETED visit when the staff should cheer the customer. */
export const CHEER_AFTER_DAYS: Record<CheerKind, number> = { treatment: 7, color: 56 };

export const CHEER_LABEL: Record<CheerKind, string> = { treatment: "ทรีตเมนต์", color: "ย้อมสี" };

/** Retail / packages / memberships are never a treatment or colour visit. */
const NOT_A_VISIT = /^(สินค้า|แพ็กเกจ|membership)$/i;

export function cheerKind(service: { name: string; nameTh?: string | null; category: string }): CheerKind | null {
  if (NOT_A_VISIT.test(service.category.trim())) return null;
  const text = `${service.category} ${service.name} ${service.nameTh ?? ""}`;
  if (/colou?r|ย้อม|ทำสี|nigao/i.test(text)) return "color";
  if (/treatment|ทรีท|keratin|spa|สปา/i.test(text)) return "treatment";
  return null;
}
