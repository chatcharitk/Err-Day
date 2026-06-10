import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { signLinkToken } from "@/lib/customer-link";

// POST /api/admin/customers/[id]/link-token
// Mint a one-tap "link your LINE" URL for this customer. Staff send it to the
// customer; opening it in LINE links their account and pushes their membership.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const customer = await prisma.customer.findUnique({
    where:  { id },
    select: { id: true, lineUserId: true },
  });
  if (!customer) return NextResponse.json({ error: "ไม่พบลูกค้า" }, { status: 404 });
  if (customer.lineUserId) {
    return NextResponse.json({ error: "ลูกค้ารายนี้เชื่อมต่อ LINE แล้ว", alreadyLinked: true }, { status: 409 });
  }

  const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
  if (!liffId) return NextResponse.json({ error: "LIFF is not configured" }, { status: 500 });

  const token = signLinkToken(customer.id);
  const url   = `https://liff.line.me/${liffId}/liff/link?ct=${encodeURIComponent(token)}`;

  return NextResponse.json({ url });
}
