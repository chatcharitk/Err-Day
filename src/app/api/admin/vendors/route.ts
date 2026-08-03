/**
 * GET /api/admin/vendors?q=...&limit=8
 *   Fuzzy search for the expense-form vendor autocomplete. `q` uses the
 *   pg_trgm index (same pattern as customer search) so it matches anywhere
 *   in the name, not just a prefix.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(request: Request) {
  const _gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (_gate instanceof Response) return _gate;

  const { searchParams } = new URL(request.url);
  const q     = searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(20, parseInt(searchParams.get("limit") ?? "8", 10) || 8);

  const vendors = await prisma.vendor.findMany({
    where: {
      isActive: true,
      ...(q.length > 0 ? { name: { contains: q, mode: "insensitive" } } : {}),
    },
    orderBy: { name: "asc" },
    take: limit,
    select: { id: true, name: true, phone: true, category: true },
  });

  return NextResponse.json({ vendors });
}
