import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const branchId = searchParams.get("branchId");

  if (!branchId) {
    return NextResponse.json({ error: "branchId is required" }, { status: 400 });
  }

  const staff = await prisma.staff.findMany({
    where: { branchId, isActive: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(staff);
}
