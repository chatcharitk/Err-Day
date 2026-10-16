import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { parseCampaignInput } from "@/lib/coupon-admin";
import type { Prisma } from "@/generated/prisma/client";

/** POST /api/admin/coupons — create a campaign. */
export async function POST(request: Request) {
  const gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (gate instanceof Response) return gate;
  const b = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!b) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const parsed = parseCampaignInput(b);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const exists = await prisma.couponCampaign.findUnique({ where: { code: parsed.data.code as string }, select: { id: true } });
  if (exists) return NextResponse.json({ error: "โค้ดนี้ถูกใช้แล้ว" }, { status: 409 });
  const campaign = await prisma.couponCampaign.create({ data: parsed.data as Prisma.CouponCampaignCreateInput });
  return NextResponse.json({ campaign }, { status: 201 });
}
