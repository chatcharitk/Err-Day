import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const phone = searchParams.get("phone");

  if (!phone) return NextResponse.json({ error: "phone required" }, { status: 400 });

  const customer = await prisma.customer.findUnique({
    where: { phone },
    include: {
      membership: { include: { tier: true } },
      bookings: {
        where: { status: "COMPLETED" },
        orderBy: { date: "desc" },
        take: 5,
        include: { service: true, branch: true },
      },
    },
  });

  if (!customer) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(customer);
}

export async function POST(request: Request) {
  const { phone, name } = await request.json();
  if (!phone || !name) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const bronzeTier = await prisma.membershipTier.findFirst({ where: { id: "tier-bronze" } });
  if (!bronzeTier) return NextResponse.json({ error: "Tiers not set up" }, { status: 500 });

  const customer = await prisma.customer.upsert({
    where: { phone },
    update: {},
    create: { name, phone },
  });

  const membership = await prisma.membership.upsert({
    where: { customerId: customer.id },
    update: {},
    create: { customerId: customer.id, tierId: bronzeTier.id, points: 0 },
    include: { tier: true },
  });

  return NextResponse.json({ customer, membership }, { status: 201 });
}
