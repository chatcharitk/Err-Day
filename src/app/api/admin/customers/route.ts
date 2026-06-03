import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/admin/customers?q=search&limit=N — search customers by name, nickname, or phone
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q     = searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(50, parseInt(searchParams.get("limit") ?? "10", 10) || 10);

  if (q.length < 1) {
    return NextResponse.json([]);
  }

  const now = new Date();

  const customers = await prisma.customer.findMany({
    where: {
      OR: [
        { name:     { contains: q, mode: "insensitive" } },
        { nickname: { contains: q, mode: "insensitive" } },
        { phone:    { contains: q } },
      ],
    },
    orderBy: { name: "asc" },
    take: limit,
    select: {
      id:       true,
      name:     true,
      nickname: true,
      phone:    true,
      email:    true,
      membership: {
        select: { pendingActivation: true, expiresAt: true },
      },
      // Fetch open packages — both active and still-pending (self-registered,
      // not yet paid) — so we can drive both the "แพ็กเกจ" and "รอเปิดใช้" badges.
      packages: {
        where:  { closedAt: null, OR: [{ pendingActivation: true }, { expiresAt: { gte: now } }] },
        select: { id: true, pendingActivation: true },
      },
    },
  });

  return NextResponse.json(customers.map(c => {
    const pendingPkg = c.packages.some(p => p.pendingActivation);
    const activePkg  = c.packages.some(p => !p.pendingActivation);
    return {
      id:         c.id,
      name:       c.name,
      nickname:   c.nickname,
      phone:      c.phone,
      email:      c.email,
      isMember:   !!c.membership && !c.membership.pendingActivation && (!c.membership.expiresAt || c.membership.expiresAt >= now),
      isPending:  !!c.membership?.pendingActivation || pendingPkg,
      hasPackage: activePkg,
    };
  }));
}

// POST /api/admin/customers — register a new customer
export async function POST(request: Request) {
  try {
    const { name, nickname, phone, email, gender, pictureUrl } = await request.json();

    if (!name?.trim() || !phone?.trim()) {
      return NextResponse.json({ error: "ชื่อและเบอร์โทรจำเป็น" }, { status: 400 });
    }

    const existing = await prisma.customer.findUnique({ where: { phone: phone.trim() } });
    if (existing) {
      return NextResponse.json({ error: "เบอร์โทรนี้มีในระบบแล้ว" }, { status: 409 });
    }

    const customer = await prisma.customer.create({
      data: {
        name:       name.trim(),
        nickname:   nickname?.trim() || null,
        phone:      phone.trim(),
        email:      email?.trim() || null,
        gender:     gender || null,
        pictureUrl: pictureUrl?.trim() || null,
      },
      include: {
        _count:      { select: { bookings: true } },
        membership:  { include: { tier: true } },
      },
    });

    return NextResponse.json(customer, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "สร้างลูกค้าไม่สำเร็จ" }, { status: 500 });
  }
}
