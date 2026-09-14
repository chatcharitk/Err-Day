/**
 * GET  /api/admin/expenses?branchId=&category=&from=&to=&limit=
 *   List expenses with optional filters. Sorted newest first.
 * POST /api/admin/expenses
 *   Create a new expense.
 */
import { requireAdmin } from "@/lib/admin-auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { expenseData } from "@/lib/expense-write";
import { jsonSnapshot } from "@/lib/finance-audit";

export async function GET(request: Request) {
  const _gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (_gate instanceof Response) return _gate;

  const { searchParams } = new URL(request.url);
  const branchId = searchParams.get("branchId"); // "all" | "shared" | "<id>" | null
  const category = searchParams.get("category");
  const from = searchParams.get("from"); // YYYY-MM-DD
  const to = searchParams.get("to");
  const limit = Math.min(
    500,
    parseInt(searchParams.get("limit") ?? "100", 10) || 100,
  );

  const where: Record<string, unknown> = { status: { not: "VOIDED" } };
  if (branchId === "shared") where.branchId = null;
  else if (branchId && branchId !== "all") where.branchId = branchId;

  if (category && category !== "all") where.category = category;

  if (from || to) {
    where.date = {
      ...(from ? { gte: new Date(from + "T00:00:00.000Z") } : {}),
      ...(to ? { lte: new Date(to + "T23:59:59.999Z") } : {}),
    };
  }

  const expenses = await prisma.expense.findMany({
    where,
    select: {
      id: true,
      branchId: true,
      category: true,
      vendor: true,
      vendorId: true,
      date: true,
      totalAmount: true,
      vatAmount: true,
      paymentMethod: true,
      receiptUrl: true,
      notes: true,
      status: true,
      createdAt: true,
      branch: { select: { id: true, name: true } },
      _count: { select: { items: true, attachments: true } },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: limit,
  });

  return NextResponse.json({ expenses });
}

export async function POST(request: Request) {
  const gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (gate instanceof Response) return gate;
  try {
    const b = await request.json();
    const expense = await prisma.$transaction(async (tx) => {
      const { data, items, attachments } = await expenseData(tx, b);
      const e = await tx.expense.create({
        data: {
          ...data,
          items: { create: items },
          attachments: { create: attachments },
        },
        include: { items: true, attachments: true },
      });
      await tx.financeAudit.create({
        data: {
          entity: "EXPENSE",
          recordId: e.id,
          action: "CREATE",
          actor: gate.username,
          after: jsonSnapshot(e),
        },
      });
      return e;
    });
    return NextResponse.json({ expense: { ...expense, payeeSnapshot: gate.role === "OWNER" ? expense.payeeSnapshot : undefined } }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "บันทึกไม่สำเร็จ" },
      { status: 400 },
    );
  }
}
