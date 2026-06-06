/**
 * Customer-facing booking page only.
 *
 * Appends a short location hint to the branch name so customers can tell the
 * two branches apart when choosing where to book. The stored Branch.name is
 * left unchanged — admin panels, LINE notification cards, etc. all keep the
 * original name. Use this ONLY in the /book customer flow.
 */
export function bookingBranchLabel(name: string): string {
  if (name.includes("สุขุมวิท")) return `${name} (สุขุมวิท 70/3)`;
  if (name.includes("บางนา"))   return `${name} (ทางเข้าซอย ม. รามคำแหง2)`;
  return name;
}
