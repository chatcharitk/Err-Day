import { prisma } from "@/lib/prisma";
import { requireAdmin, requireOwner } from "@/lib/admin-auth";
import { expenseData, attachmentData } from "@/lib/expense-write";
import { jsonSnapshot } from "@/lib/finance-audit";
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, { params }: Context) {
  const gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (gate instanceof Response) return gate;
  const { id } = await params;
  const expense = await prisma.expense.findUnique({
    where: { id },
    include: {
      items: true,
      attachments: true,
      branch: { select: { id: true, name: true } },
    },
  });
  if (!expense) return Response.json({ error: "ไม่พบรายการ" }, { status: 404 });
  return Response.json({ expense: { ...expense, payeeSnapshot: gate.role === "OWNER" ? expense.payeeSnapshot : undefined } });
}
export async function PATCH(request: Request, { params }: Context) {
  const gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (gate instanceof Response) return gate;
  try {
    const { id } = await params,
      b = await request.json();
    const expense = await prisma.$transaction(async (tx) => {
      const old = await tx.expense.findUniqueOrThrow({
        where: { id },
        include: { items: true, attachments: true },
      });
      if (old.status === "VOIDED")
        throw new Error("รายการยกเลิกแล้ว แก้ไขไม่ได้");
      const linked = await tx.staffDailyPayout.findFirst({
        where: { expenseId: id },
      });
      const locked = !!(
        linked ||
        old.sourceKey?.startsWith("PAYROLL:") ||
        old.notes?.includes("[PAYROLL:")
      );
      let data;
      if (locked) {
        if (
          Object.keys(b).some(
            (k) =>
              ![
                "attachments",
                "notes",
                "invoiceNumber",
                "refreshPayeeSnapshot",
              ].includes(k),
          )
        )
          throw new Error(
            "ยอดนี้เชื่อมค่าตอบแทน กรุณาเปิดแก้จากหน้าค่าตอบแทนเพื่อให้ยอดตรงกัน",
          );
        data = {
          ...(b.notes !== undefined ? { notes: String(b.notes) } : {}),
          ...(b.invoiceNumber !== undefined
            ? { invoiceNumber: String(b.invoiceNumber) }
            : {}),
        };
      } else {
        const normalized = await expenseData(tx, b, old.vatMode === "LEGACY");
        data = normalized.data;
        // Preserve the historical payee identity when the selected recipient is unchanged.
        if (
          old.vendorId === data.vendorId &&
          old.payeeSnapshot &&
          !b.refreshPayeeSnapshot
        )
          data.payeeSnapshot = jsonSnapshot(old.payeeSnapshot);
        await tx.expenseItem.deleteMany({ where: { expenseId: id } });
        if (normalized.items.length)
          await tx.expenseItem.createMany({
            data: normalized.items.map((it) => ({ ...it, expenseId: id })),
          });
      }
      if (b.refreshPayeeSnapshot) {
        if (gate.role !== "OWNER")
          throw new Error(
            "เฉพาะเจ้าของเท่านั้นที่แก้ข้อมูลผู้รับเงินบนเอกสารเดิมได้",
          );
        const vendorId = "vendorId" in data ? data.vendorId : old.vendorId;
        if (vendorId) {
          const payee = await tx.vendor.findUniqueOrThrow({
            where: { id: String(vendorId) },
          });
          data = {
            ...data,
            payeeSnapshot: jsonSnapshot(payee),
            vendor: payee.legalName || payee.name,
          };
        }
      }
      if (b.attachments !== undefined) {
        const files = attachmentData(b.attachments);
        await tx.expenseAttachment.deleteMany({ where: { expenseId: id } });
        if (files.length)
          await tx.expenseAttachment.createMany({
            data: files.map((a) => ({ ...a, expenseId: id })),
          });
      }
      const updated = await tx.expense.update({
        where: { id },
        data,
        include: { items: true, attachments: true },
      });
      await tx.financeAudit.create({
        data: {
          entity: "EXPENSE",
          recordId: id,
          action: "UPDATE",
          actor: gate.username,
          before: jsonSnapshot(old),
          after: jsonSnapshot(updated),
        },
      });
      return updated;
    });
    return Response.json({ expense: { ...expense, payeeSnapshot: gate.role === "OWNER" ? expense.payeeSnapshot : undefined } });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "บันทึกไม่สำเร็จ" },
      { status: 400 },
    );
  }
}
// Preserve issued records for accounting; deletion is a traced void.
export async function DELETE(request: Request, { params }: Context) {
  const gate = await requireOwner().catch((e: unknown) => e as Response);
  if (gate instanceof Response) return gate;
  try {
    const { id } = await params,
      b = await request.json().catch(() => ({}));
    if (!b.reason?.trim()) throw new Error("กรุณาระบุเหตุผลยกเลิก");
    await prisma.$transaction(async (tx) => {
      const old = await tx.expense.findUniqueOrThrow({ where: { id } });
      const linked = await tx.staffDailyPayout.findFirst({
        where: { expenseId: id },
      });
      if (linked) throw new Error("กรุณาเปิดแก้จากหน้าค่าตอบแทน");
      await tx.expense.update({ where: { id }, data: { status: "VOIDED" } });
      await tx.financeAudit.create({
        data: {
          entity: "EXPENSE",
          recordId: id,
          action: "VOID",
          actor: gate.username,
          before: jsonSnapshot(old),
          after: jsonSnapshot({ reason: b.reason }),
        },
      });
    });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "ยกเลิกไม่สำเร็จ" },
      { status: 400 },
    );
  }
}
