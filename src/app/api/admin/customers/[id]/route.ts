import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PATCH /api/admin/customers/[id] — update customer info
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { name, phone, email } = await request.json();

    // If phone is changing, check it isn't taken by someone else
    if (phone) {
      const conflict = await prisma.customer.findFirst({
        where: { phone: phone.trim(), NOT: { id } },
      });
      if (conflict) {
        return NextResponse.json({ error: "เบอร์โทรนี้มีในระบบแล้ว" }, { status: 409 });
      }
    }

    const customer = await prisma.customer.update({
      where: { id },
      data: {
        ...(name  !== undefined ? { name:  name.trim()          } : {}),
        ...(phone !== undefined ? { phone: phone.trim()         } : {}),
        ...(email !== undefined ? { email: email?.trim() || null } : {}),
      },
      include: {
        _count:     { select: { bookings: true } },
        membership: { include: { tier: true } },
      },
    });

    return NextResponse.json(customer);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "แก้ไขข้อมูลไม่สำเร็จ" }, { status: 500 });
  }
}
