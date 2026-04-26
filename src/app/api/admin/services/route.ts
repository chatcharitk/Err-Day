import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/admin/services — all services (incl. inactive) with branch pricing
export async function GET() {
  const services = await prisma.service.findMany({
    orderBy: [{ category: "asc" }, { nameTh: "asc" }],
    include: {
      branches: {
        include: { branch: true },
        orderBy: { branch: { name: "asc" } },
      },
    },
  });
  return NextResponse.json(services);
}

// POST /api/admin/services — create a new service + optional per-branch pricing
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      name, nameTh, category, description, descriptionTh,
      advanceBookingRequired, memberPrice,
      branchPricing, // [{ branchId, price, duration, isActive }]
    } = body;

    if (!name || !category) {
      return NextResponse.json({ error: "name and category are required" }, { status: 400 });
    }

    const service = await prisma.service.create({
      data: {
        name,
        nameTh: nameTh ?? "",
        category,
        description: description || null,
        descriptionTh: descriptionTh || null,
        advanceBookingRequired: advanceBookingRequired ?? false,
        memberPrice: memberPrice ? Math.round(Number(memberPrice) * 100) : null,
        isActive: true,
        ...(Array.isArray(branchPricing) && branchPricing.length > 0
          ? {
              branches: {
                create: branchPricing
                  .filter((bp: { branchId: string; price: number; duration: number }) => bp.branchId)
                  .map((bp: { branchId: string; price: number; duration: number; isActive?: boolean }) => ({
                    branchId: bp.branchId,
                    price: Math.round(Number(bp.price) * 100),
                    duration: Number(bp.duration),
                    isActive: bp.isActive ?? true,
                  })),
              },
            }
          : {}),
      },
      include: {
        branches: { include: { branch: true } },
      },
    });

    return NextResponse.json(service, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create service" }, { status: 500 });
  }
}
