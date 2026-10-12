import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";

/** PATCH /api/admin/votes/candidates/[id] — { name?, photoUrl?, isActive?, sortOrder? } */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (gate instanceof Response) return gate;
  const { id } = await params;
  const b = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!b) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const data: { name?: string; photoUrl?: string | null; isActive?: boolean; sortOrder?: number } = {};
  if (typeof b.name === "string") {
    const name = b.name.trim().slice(0, 60);
    if (!name) return NextResponse.json({ error: "ชื่อห้ามว่าง" }, { status: 400 });
    data.name = name;
  }
  if (b.photoUrl !== undefined) data.photoUrl = typeof b.photoUrl === "string" && b.photoUrl ? b.photoUrl : null;
  if (typeof b.isActive === "boolean") data.isActive = b.isActive;
  if (typeof b.sortOrder === "number" && Number.isFinite(b.sortOrder)) data.sortOrder = Math.round(b.sortOrder);

  try {
    const candidate = await prisma.voteCandidate.update({ where: { id }, data });
    return NextResponse.json({ candidate });
  } catch {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
}
