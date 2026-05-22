import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** GET /api/admin/staff?branchId=... — list active staff for a branch */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const branchId = searchParams.get("branchId");
  const staff = await prisma.staff.findMany({
    where: { isActive: true, ...(branchId ? { branchId } : {}) },
    select: { id: true, name: true, branchId: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ staff });
}

export async function POST(request: Request) {
  try {
    const { name, phone, branchId, commissionRate } = await request.json();
    if (!name?.trim() || !branchId) {
      return NextResponse.json({ error: "Name and branch are required" }, { status: 400 });
    }
    const staff = await prisma.staff.create({
      data: {
        name: name.trim(),
        phone: phone?.trim() || null,
        branchId,
        commissionRate: commissionRate ?? 0,
      },
      include: { branch: true },
    });
    return NextResponse.json(staff, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create staff" }, { status: 500 });
  }
}
