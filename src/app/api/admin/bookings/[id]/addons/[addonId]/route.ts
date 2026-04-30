import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";

type Params = { params: Promise<{ id: string; addonId: string }> };

/**
 * DELETE /api/admin/bookings/[id]/addons/[addonId]
 * The addonId here is the BookingAddon.id (not the ServiceAddon.id).
 * Removes the row and decrements the booking's totalPrice by the snapshot price.
 */
export async function DELETE(_req: Request, { params }: Params) {
  try {
    await requireAdmin();
    const { id: bookingId, addonId: bookingAddonId } = await params;

    const ba = await prisma.bookingAddon.findUnique({ where: { id: bookingAddonId } });
    if (!ba || ba.bookingId !== bookingId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const [, updated] = await prisma.$transaction([
      prisma.bookingAddon.delete({ where: { id: bookingAddonId } }),
      prisma.booking.update({
        where: { id: bookingId },
        data:  { totalPrice: { decrement: ba.price } },
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
