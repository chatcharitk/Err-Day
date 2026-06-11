/**
 * Customer-facing booking page only.
 *
 * Appends a short location hint to the branch name so customers can tell the
 * two branches apart when choosing where to book. The stored Branch.name is
 * left unchanged — admin panels, LINE notification cards, etc. all keep the
 * original name. Use this ONLY in the /book customer flow.
 */
export function bookingBranchLabel(name: string): string {
  if (name.includes("สุขุมวิท")) return `${name} (ใกล้ BTS แบริ่ง)`;
  if (name.includes("บางนา"))   return `${name} (ตรงข้ามเมกาบางนา)`;
  return name;
}

/**
 * Short branch codes for compact notations (BI summary, customer cards):
 *   branch-sukhumvit → "S1",  branch-bangna → "S2".
 * Returns null for an unknown / unmapped / missing branch.
 */
const BRANCH_CODES: Record<string, string> = {
  "branch-sukhumvit": "S1",
  "branch-bangna":    "S2",
};

export function branchCode(branchId: string | null | undefined): string | null {
  if (!branchId) return null;
  return BRANCH_CODES[branchId] ?? null;
}
