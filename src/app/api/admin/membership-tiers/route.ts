import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET  /api/admin/membership-tiers  — list all tiers
export async function GET() {
  const tiers = await prisma.membershipTier.findMany({
    orderBy: { minPoints: "asc" },
  });
  return NextResponse.json(tiers);
}

// POST /api/admin/membership-tiers  — create a tier
export async function POST(request: Request) {
  try {
    const { name, nameTh, minPoints, discountPercent, color, validityDays, maxUsages } =
      await request.json();

    if (!name?.trim() || !nameTh?.trim()) {
      return NextResponse.json({ error: "name and nameTh are required" }, { status: 400 });
    }

    const tier = await prisma.membershipTier.create({
      data: {
        name:            name.trim(),
        nameTh:          nameTh.trim(),
        minPoints:       minPoints       ?? 0,
        discountPercent: discountPercent ?? 0,
        color:           color           ?? "#6b7280",
        validityDays:    validityDays    ?? 30,
        maxUsages:       maxUsages       ?? 0,
      },
    });
    return NextResponse.json(tier, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create tier" }, { status: 500 });
  }
}
