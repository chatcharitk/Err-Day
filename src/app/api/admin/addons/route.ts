/**
 * GET  /api/admin/addons          — list all add-ons (incl. inactive)
 * POST /api/admin/addons          — create
 *   body: { name, nameTh, price (baht), isActive? }
 */
import { requireAdmin } from "@/lib/admin-auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidateReferenceData } from "@/lib/revalidate";

export async function GET() {
  const _gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (_gate instanceof Response) return _gate;

  const addons = await prisma.serviceAddon.findMany({
    orderBy: [{ isActive: "desc" }, { nameTh: "asc" }],
  });
  return NextResponse.json({ addons });
}


export async function POST(request: Request) {
  const _gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (_gate instanceof Response) return _gate;

  const body = await request.json();
  const { name, nameTh, price, isActive } = body;

  if (!nameTh?.trim() || typeof price !== "number") {
    return NextResponse.json({ error: "Missing required fields (nameTh, price)" }, { status: 400 });
  }

  const addon = await prisma.serviceAddon.create({
    data: {
      // English fallback to Thai name when not given — keeps DB rows complete.
      name:     (name?.trim() || nameTh.trim()).slice(0, 100),
      nameTh:   nameTh.trim(),
      price:    Math.round(Number(price) * 100),       // baht → satang
      isActive: isActive ?? true,
    },
  });
  revalidateReferenceData();
  return NextResponse.json({ addon }, { status: 201 });
}
