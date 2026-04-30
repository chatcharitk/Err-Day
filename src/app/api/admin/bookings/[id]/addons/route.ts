import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/bookings/[id]/addons
 * Body: { addonId }
 *
 * Adds a ServiceAddon to an existing booking and bumps the booking's
 * totalPrice by the addon's current price (price snapshot at this moment).
 */
export async function POST(request: Request, { params }: Params) {
  try {
    await requireAdmin();
    const { id: bookingId } = await params;
    const { addonId } = await request.json();
    if (!addonId) return NextResponse.json({ error: "Missing addonId" }, { status: 400 });

    const [booking, addon] = await Promise.all([
      prisma.booking.findUnique({ where: { id: bookingId } }),
      prisma.serviceAddon.findUnique({ where: { id: addonId } }),
    ]);
    if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    if (!addon)   return NextResponse.json({ error: "Addon not found" },   { status: 404 });

    const [, updated] = await prisma.$transaction([
      prisma.bookingAddon.create({
        data: { bookingId, addonId, price: addon.price },
      }),
      prisma.booking.update({
        where: { id: bookingId },
        data:  { totalPrice: { increment: addon.price } },
        include: { addons: { include: { addon: true } } },
      }),
    ]);

    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof Response) return e;
    console.error(e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
