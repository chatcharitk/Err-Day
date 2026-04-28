import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const branch = await prisma.branch.findUnique({ where: { id } });
  if (!branch) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(branch);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, address, phone, openTime, closeTime, mapUrl, mapLat, mapLng } = body;

    const branch = await prisma.branch.update({
      where: { id },
      data: {
        ...(name      !== undefined ? { name }                           : {}),
        ...(address   !== undefined ? { address }                        : {}),
        ...(phone     !== undefined ? { phone }                          : {}),
        ...(openTime  !== undefined ? { openTime:  openTime  || null }   : {}),
        ...(closeTime !== undefined ? { closeTime: closeTime || null }   : {}),
        ...(mapUrl    !== undefined ? { mapUrl:    mapUrl    || null }   : {}),
        ...(mapLat    !== undefined ? { mapLat:    mapLat  != null ? Number(mapLat)  : null } : {}),
        ...(mapLng    !== undefined ? { mapLng:    mapLng  != null ? Number(mapLng)  : null } : {}),
      },
    });
    return NextResponse.json(branch);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update branch" }, { status: 500 });
  }
}
