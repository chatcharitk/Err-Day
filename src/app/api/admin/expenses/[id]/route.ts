import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { findOrCreateVendorId } from "@/lib/vendors";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const _gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (_gate instanceof Response) return _gate;

  const { id } = await params;
  const expense = await prisma.expense.findUnique({
    where:  { id },
    include: {
      items: { orderBy: { id: "asc" } },
      attachments: { orderBy: { createdAt: "asc" } },
      branch: { select: { id: true, name: true } },
    },
  });
  if (!expense) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ expense });
}


export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const _gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (_gate instanceof Response) return _gate;

  const { id } = await params;
  const body = await request.json();
  const {
    branchId, category, vendor, date, totalAmount, vatAmount,
    paymentMethod, receiptUrl, notes, status, items, attachments,
  } = body;

  try {
    // vendorId is re-resolved only when vendor is actually part of this edit —
    // find-or-create runs outside the transaction since it's a simple lookup,
    // not something that needs to roll back with the rest of the update.
    const vendorId = vendor !== undefined ? await findOrCreateVendorId(vendor, category) : undefined;

    // If items/attachments provided, replace them entirely (simpler than diffing).
    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.expense.update({
        where: { id },
        data: {
          ...(branchId !== undefined      ? { branchId: branchId || null }                : {}),
          ...(category !== undefined      ? { category }                                  : {}),
          ...(vendor !== undefined        ? { vendor: vendor || null, vendorId }          : {}),
          ...(date !== undefined          ? { date: new Date(date + "T12:00:00") }        : {}),
          ...(totalAmount !== undefined   ? { totalAmount: Math.round(totalAmount) }      : {}),
          ...(vatAmount !== undefined     ? { vatAmount: vatAmount != null ? Math.round(vatAmount) : null } : {}),
          ...(paymentMethod !== undefined ? { paymentMethod: paymentMethod || null }      : {}),
          ...(receiptUrl !== undefined    ? { receiptUrl: receiptUrl || null }            : {}),
          ...(notes !== undefined         ? { notes: notes || null }                      : {}),
          ...(status !== undefined        ? { status: status === "DRAFT" ? "DRAFT" : "CONFIRMED" } : {}),
        },
      });

      if (Array.isArray(items)) {
        await tx.expenseItem.deleteMany({ where: { expenseId: id } });
        if (items.length > 0) {
          await tx.expenseItem.createMany({
            data: items.map((it: { description: string; quantity: number; unitPrice: number; totalPrice: number }) => ({
              expenseId: id,
              description: String(it.description),
              quantity:   Number(it.quantity)   || 1,
              unitPrice:  Math.round(Number(it.unitPrice)  || 0),
              totalPrice: Math.round(Number(it.totalPrice) || 0),
            })),
          });
        }
      }

      if (Array.isArray(attachments)) {
        await tx.expenseAttachment.deleteMany({ where: { expenseId: id } });
        if (attachments.length > 0) {
          await tx.expenseAttachment.createMany({
            data: attachments.map((a: { url: string; filename?: string; fileType?: string }) => ({
              expenseId: id,
              url:      String(a.url),
              filename: a.filename ? String(a.filename) : null,
              fileType: a.fileType ? String(a.fileType) : null,
            })),
          });
        }
      }

      return updated;
    });

    return NextResponse.json({ expense: result });
  } catch (e) {
    console.error("[expenses PATCH]", e);
    return NextResponse.json({ error: "Failed to update expense" }, { status: 500 });
  }
}


export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const _gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (_gate instanceof Response) return _gate;

  const { id } = await params;
  try {
    await prisma.expense.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
