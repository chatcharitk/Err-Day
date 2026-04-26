import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const branchId = searchParams.get("branchId");

  if (!branchId) {
    return NextResponse.json({ error: "branchId is required" }, { status: 400 });
  }

  const branchServices = await prisma.branchService.findMany({
    where: { branchId, isActive: true },
    include: { service: true },
    orderBy: { service: { category: "asc" } },
  });

  return NextResponse.json(branchServices);
}
