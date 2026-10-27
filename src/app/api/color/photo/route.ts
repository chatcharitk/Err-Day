import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { storeImage } from "@/lib/upload";
import { colorActor } from "@/lib/color";

export const runtime = "nodejs";
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/heic"];

/**
 * POST /api/color/photo?customerId=… — before/after/reference photo for a colour
 * record (multipart field "file"). Stylists can use it too, unlike /api/upload.
 * Needs the customer's photo consent on their hair profile.
 */
export async function POST(request: Request) {
  const actor = await colorActor();
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const customerId = new URL(request.url).searchParams.get("customerId") ?? "";
  const profile = await prisma.hairProfile.findUnique({ where: { customerId }, select: { consentAt: true } });
  if (!profile?.consentAt) return NextResponse.json({ error: "ลูกค้ายังไม่ได้ยินยอมให้เก็บรูป — บันทึกประวัติพร้อมความยินยอมก่อน" }, { status: 400 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "no file" }, { status: 400 });
  if (file.size > 8 * 1024 * 1024) return NextResponse.json({ error: "ไฟล์ใหญ่เกิน 8MB" }, { status: 400 });
  if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: "รองรับเฉพาะรูปภาพ" }, { status: 400 });
  const key = `color/${customerId}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`;
  const url = await storeImage(key, Buffer.from(await file.arrayBuffer()), file.type);
  return NextResponse.json({ url });
}
