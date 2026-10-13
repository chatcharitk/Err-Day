/**
 * Branch options for the expense screens. Branches that aren't open yet
 * (isActive=false — hidden from customers, staff, booking and POS) are still
 * listed so set-up costs can be recorded against them, marked "(ยังไม่เปิด)".
 */
export function expenseBranchOptions(branches: { id: string; name: string; isActive: boolean }[]) {
  return [...branches]
    .sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name, "th"))
    .map(b => ({ id: b.id, name: b.isActive ? b.name : `${b.name} (ยังไม่เปิด)` }));
}
