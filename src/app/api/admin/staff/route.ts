import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
