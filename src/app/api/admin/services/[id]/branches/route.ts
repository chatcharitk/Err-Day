import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { revalidateReferenceData } from "@/lib/revalidate";

// PUT /api/admin/services/[id]/branches
// Body: [{ branchId, price (baht), duration (mins), isActive }]
// Upserts all branch-service rows for this service.
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const _gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (_gate instanceof Response) return _gate;

  try {
    const { id: serviceId } = await params;
    const rows: { branchId: string; price: number; duration: number; isActive: boolean }[] =
      await request.json();

    const ops = rows.map((row) =>
      prisma.branchService.upsert({
        where: { branchId_serviceId: { branchId: row.branchId, serviceId } },
        update: {
          price: Math.round(Number(row.price) * 100),
          duration: Number(row.duration),
          isActive: row.isActive,
        },
        create: {
          branchId: row.branchId,
          serviceId,
          price: Math.round(Number(row.price) * 100),
          duration: Number(row.duration),
          isActive: row.isActive,
        },
      }),
    );

    const results = await prisma.$transaction(ops);
    revalidateReferenceData();
    return NextResponse.json(results);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update branch pricing" }, { status: 500 });
  }
}
