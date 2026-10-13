import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/admin-auth";
import { buildPayslipDraft, parseLines } from "@/lib/payslip";
import { totalsData } from "@/lib/payslip-admin";
import { jsonSnapshot } from "@/lib/finance-audit";

/**
 * PATCH /api/admin/payslips/[id] { action, lines?, notes? }
 *   save    — DRAFT only: replace lines/notes
 *   rebuild — DRAFT only: rebuild lines from current payroll data
 *   issue   — DRAFT → ISSUED (employee can now see it; snapshot frozen)
 *   reopen  — ISSUED → DRAFT, revision + 1 (hidden from the employee until reissued)
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireOwner().catch((e: unknown) => e as Response);
  if (gate instanceof Response) return gate;
  const { id } = await params;
  const body = await request.json().catch(() => ({})) as { action?: string; lines?: unknown; notes?: unknown };
  const slip = await prisma.payslip.findUnique({ where: { id } });
  if (!slip) return NextResponse.json({ error: "ไม่พบสลิป" }, { status: 404 });

  try {
    let data: Parameters<typeof prisma.payslip.update>[0]["data"];
    switch (body.action) {
      case "save": {
        if (slip.status !== "DRAFT") throw new Error("สลิปออกแล้ว ต้องเปิดแก้ก่อน");
        data = { ...totalsData(parseLines(body.lines)), notes: typeof body.notes === "string" ? body.notes.trim().slice(0, 500) || null : slip.notes };
        break;
      }
      case "rebuild": {
        if (slip.status !== "DRAFT") throw new Error("สลิปออกแล้ว ต้องเปิดแก้ก่อน");
        const draft = await buildPayslipDraft(slip.staffIds, slip.month);
        data = { ...totalsData(draft.lines), paidDailySatang: draft.paidDailySatang };
        break;
      }
      case "issue": {
        if (slip.status !== "DRAFT") throw new Error("สลิปนี้ออกไปแล้ว");
        data = { status: "ISSUED", issuedAt: new Date(), issuedBy: gate.username };
        break;
      }
      case "reopen": {
        if (slip.status !== "ISSUED") throw new Error("สลิปนี้ยังเป็นฉบับร่าง");
        data = { status: "DRAFT", revision: { increment: 1 }, issuedAt: null, issuedBy: null };
        break;
      }
      default:
        throw new Error("คำสั่งไม่ถูกต้อง");
    }
    const after = await prisma.$transaction(async (tx) => {
      const updated = await tx.payslip.update({ where: { id }, data });
      await tx.financeAudit.create({
        data: { entity: "PAYSLIP", recordId: id, action: body.action!.toUpperCase(), actor: gate.username, before: jsonSnapshot(slip), after: jsonSnapshot(updated) },
      });
      return updated;
    });
    return NextResponse.json({ payslip: after });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "บันทึกไม่สำเร็จ" }, { status: 400 });
  }
}
