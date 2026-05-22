import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const branchId = searchParams.get("branchId");

  if (!branchId) {
    return NextResponse.json({ error: "branchId is required" }, { status: 400 });
  }

  // Lean projection — list views need name/category/price/duration and the
  // membership fields. Skips description, descriptionTh, imageUrl,
  // availableFrom/To which are unused by the booking flow.
  const branchServices = await prisma.branchService.findMany({
    where:   { branchId, isActive: true },
    select: {
      id: true,
      price: true,
      duration: true,
      service: {
        select: {
          id: true,
          name: true,
          nameTh: true,
          category: true,
          memberPrice: true,
          memberDiscountPercent: true,
          advanceBookingRequired: true,
        },
      },
    },
    orderBy: { service: { category: "asc" } },
  });

  return NextResponse.json(branchServices);
}
