import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/admin/customers/[id] — fetch single customer (for re-loading after mutations)
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const c = await prisma.customer.findUnique({
      where: { id },
      include: {
        _count:     { select: { bookings: true } },
        membership: true,
      },
    });
    if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({
      id:         c.id,
      name:       c.name,
      nickname:   c.nickname,
      phone:      c.phone,
      email:      c.email,
      gender:     c.gender,
      pictureUrl: c.pictureUrl,
      lineUserId: c.lineUserId,
      createdAt:  c.createdAt.toISOString(),
      membership: c.membership
        ? {
            label:         c.membership.label,
            points:        c.membership.points,
            activatedAt:   c.membership.activatedAt.toISOString(),
            expiresAt:     c.membership.expiresAt?.toISOString() ?? null,
            usagesUsed:    c.membership.usagesUsed,
            usagesAllowed: c.membership.usagesAllowed,
          }
        : null,
      _count: { bookings: c._count.bookings },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch customer" }, { status: 500 });
  }
}

// DELETE /api/admin/customers/[id] — remove customer (and cascade their bookings + membership)
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    await prisma.$transaction(async (tx) => {
      // Booking → BookingAddon FK requires deleting addons first
      const bookings = await tx.booking.findMany({
        where:  { customerId: id },
        select: { id: true },
      });
      const bookingIds = bookings.map(b => b.id);
      if (bookingIds.length > 0) {
        await tx.bookingAddon.deleteMany({ where: { bookingId: { in: bookingIds } } });
        await tx.booking.deleteMany({ where: { id: { in: bookingIds } } });
      }
      // MembershipCycle has FK to both membership and customer — delete before membership
      await tx.membershipCycle.deleteMany({ where: { customerId: id } });
      await tx.membership.deleteMany({ where: { customerId: id } });
      await tx.customer.delete({ where: { id } });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "ลบลูกค้าไม่สำเร็จ" }, { status: 500 });
  }
}

// PATCH /api/admin/customers/[id] — update customer info
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { name, nickname, phone, email, gender, pictureUrl } = await request.json();

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
        ...(name       !== undefined ? { name:       name.trim()                } : {}),
        ...(nickname   !== undefined ? { nickname:   nickname?.trim() || null   } : {}),
        ...(phone      !== undefined ? { phone:      phone.trim()               } : {}),
        ...(email      !== undefined ? { email:      email?.trim() || null      } : {}),
        ...(gender     !== undefined ? { gender:     gender || null             } : {}),
        ...(pictureUrl !== undefined ? { pictureUrl: pictureUrl?.trim() || null } : {}),
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
