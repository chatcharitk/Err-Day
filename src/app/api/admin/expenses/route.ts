/**
 * GET  /api/admin/expenses?branchId=&category=&from=&to=&limit=
 *   List expenses with optional filters. Sorted newest first.
 * POST /api/admin/expenses
 *   Create a new expense.
 */
import { requireAdmin } from "@/lib/admin-auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const _gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (_gate instanceof Response) return _gate;

  const { searchParams } = new URL(request.url);
  const branchId = searchParams.get("branchId");      // "all" | "shared" | "<id>" | null
  const category = searchParams.get("category");
  const from     = searchParams.get("from");          // YYYY-MM-DD
  const to       = searchParams.get("to");
  const limit    = Math.min(500, parseInt(searchParams.get("limit") ?? "100", 10) || 100);

  const where: Record<string, unknown> = {};
  if (branchId === "shared")             where.branchId = null;
  else if (branchId && branchId !== "all") where.branchId = branchId;

  if (category && category !== "all") where.category = category;

  if (from || to) {
    where.date = {
      ...(from ? { gte: new Date(from + "T00:00:00.000Z") } : {}),
      ...(to   ? { lte: new Date(to   + "T23:59:59.999Z") } : {}),
    };
  }

  const expenses = await prisma.expense.findMany({
    where,
    select: {
      id: true, branchId: true, category: true, vendor: true,
      date: true, totalAmount: true, vatAmount: true, paymentMethod: true,
      receiptUrl: true, notes: true, status: true, createdAt: true,
      branch: { select: { id: true, name: true } },
      _count: { select: { items: true } },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: limit,
  });

  return NextResponse.json({ expenses });
}


export async function POST(request: Request) {
  const _gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (_gate instanceof Response) return _gate;

  const body = await request.json();
  const {
    branchId, category, vendor, date, totalAmount, vatAmount,
    paymentMethod, receiptUrl, notes, status, items,
  } = body;

  if (!category || !date || typeof totalAmount !== "number") {
    return NextResponse.json({ error: "Missing required fields (category, date, totalAmount)" }, { status: 400 });
  }

  try {
    const expense = await prisma.expense.create({
      data: {
        branchId:      branchId || null,
        category,
        vendor:        vendor || null,
        // Noon local to avoid UTC-midnight drift (same convention as Booking).
        date:          new Date(date + "T12:00:00"),
        totalAmount:   Math.round(totalAmount),
        vatAmount:     vatAmount != null ? Math.round(vatAmount) : null,
        paymentMethod: paymentMethod || null,
        receiptUrl:    receiptUrl || null,
        notes:         notes || null,
        status:        status === "DRAFT" ? "DRAFT" : "CONFIRMED",
        ...(Array.isArray(items) && items.length > 0 ? {
          items: {
            create: items.map((it: { description: string; quantity: number; unitPrice: number; totalPrice: number }) => ({
              description: String(it.description),
              quantity:    Number(it.quantity)   || 1,
              unitPrice:   Math.round(Number(it.unitPrice)  || 0),
              totalPrice:  Math.round(Number(it.totalPrice) || 0),
            })),
          },
        } : {}),
      },
      include: { items: true, branch: { select: { id: true, name: true } } },
    });
    return NextResponse.json({ expense }, { status: 201 });
  } catch (e) {
    console.error("[expenses POST]", e);
    return NextResponse.json({ error: "Failed to create expense" }, { status: 500 });
  }
}
