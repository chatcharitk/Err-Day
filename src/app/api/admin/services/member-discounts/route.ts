import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET — return all active services with memberDiscountPercent + branch prices
export async function GET() {
  const services = await prisma.service.findMany({
    where: { isActive: true },
    orderBy: [{ category: "asc" }, { nameTh: "asc" }],
    select: {
      id: true,
      nameTh: true,
      name: true,
      category: true,
      memberDiscountPercent: true,
      branches: {
        where:   { isActive: true },
        select:  { branchId: true, price: true, branch: { select: { name: true } } },
        orderBy: { branch: { name: "asc" } },
      },
    },
  });
  return NextResponse.json(services);
}

// PATCH — batch-update memberDiscountPercent for multiple services
// body: [{ id: string, memberDiscountPercent: number }]
export async function PATCH(request: Request) {
  try {
    const updates: { id: string; memberDiscountPercent: number }[] = await request.json();
    if (!Array.isArray(updates)) {
      return NextResponse.json({ error: "Expected an array" }, { status: 400 });
    }

    await Promise.all(
      updates.map(u =>
        prisma.service.update({
          where: { id: u.id },
          data:  { memberDiscountPercent: Math.max(0, Math.min(100, Number(u.memberDiscountPercent))) },
        }),
      ),
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update discounts" }, { status: 500 });
  }
}
