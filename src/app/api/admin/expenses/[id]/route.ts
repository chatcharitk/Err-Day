import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const expense = await prisma.expense.findUnique({
    where:  { id },
    include: {
      items: { orderBy: { id: "asc" } },
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
  const { id } = await params;
  const body = await request.json();
  const {
    branchId, category, vendor, date, totalAmount, vatAmount,
    paymentMethod, receiptUrl, notes, status, items,
  } = body;

  try {
    // If items provided, replace them entirely (simpler than diffing).
    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.expense.update({
        where: { id },
        data: {
          ...(branchId !== undefined      ? { branchId: branchId || null }                : {}),
          ...(category !== undefined      ? { category }                                  : {}),
          ...(vendor !== undefined        ? { vendor: vendor || null }                    : {}),
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
  const { id } = await params;
  try {
    await prisma.expense.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
