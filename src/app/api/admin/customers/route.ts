import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/admin/customers — register a new customer
export async function POST(request: Request) {
  try {
    const { name, phone, email, gender, pictureUrl } = await request.json();

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
