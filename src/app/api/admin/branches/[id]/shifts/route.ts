import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/admin/branches/[id]/shifts?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Returns all shifts for every active staff at the branch in the date range,
 * grouped by staff. Used by the weekly shifts admin grid.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: branchId } = await params;
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to   = searchParams.get("to");
  if (!from || !to) {
    return NextResponse.json({ error: "Missing from/to" }, { status: 400 });
  }

  const fromDate = new Date(from); fromDate.setHours(0, 0, 0, 0);
  const toDate   = new Date(to);   toDate.setHours(23, 59, 59, 999);

  const staff = await prisma.staff.findMany({
    where: { branchId, isActive: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      shifts: {
        where: { date: { gte: fromDate, lte: toDate } },
        orderBy: { date: "asc" },
        select: { id: true, date: true, startTime: true, endTime: true },
      },
    },
  });

  return NextResponse.json({ staff });
}
