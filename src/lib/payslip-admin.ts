import { prisma } from "@/lib/prisma";
import { buildPayslipDraft, payslipTotals, type PayslipLine } from "@/lib/payslip";
import type { StaffPerson } from "@/lib/staff-person";
import { jsonSnapshot } from "@/lib/finance-audit";

/** Name / legal name / tax id printed on a slip, from the person's payee record. */
export async function payslipIdentity(person: StaffPerson) {
  const payees = await prisma.vendor.findMany({
    where: { staffId: { in: person.staffIds } },
    select: { legalName: true, taxId: true },
  });
  return {
    name: person.name,
    legalName: payees.find(p => p.legalName)?.legalName ?? null,
    taxId: payees.find(p => p.taxId)?.taxId ?? null,
  };
}

/** Create the month's DRAFT for a person if none exists yet. Never touches an existing slip. */
export async function createDraftIfMissing(person: StaffPerson, month: string): Promise<"created" | "exists"> {
  const existing = await prisma.payslip.findUnique({ where: { personKey_month: { personKey: person.key, month } }, select: { id: true } });
  if (existing) return "exists";
  const draft = await buildPayslipDraft(person.staffIds, month);
  const t = payslipTotals(draft.lines);
  await prisma.payslip.create({
    data: {
      personKey: person.key, staffIds: person.staffIds, month,
      ...(await payslipIdentity(person)),
      lines: jsonSnapshot(draft.lines),
      grossSatang: t.gross, deductionSatang: t.deduction, netSatang: t.net,
      paidDailySatang: draft.paidDailySatang,
    },
  });
  return "created";
}

export function totalsData(lines: PayslipLine[]) {
  const t = payslipTotals(lines);
  return { lines: jsonSnapshot(lines), grossSatang: t.gross, deductionSatang: t.deduction, netSatang: t.net };
}
