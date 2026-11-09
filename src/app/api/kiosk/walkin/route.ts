import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getKioskBranch } from "@/lib/kiosk-auth";
import { createWalkin, WalkinError } from "@/lib/walkin";

/**
 * Walk-in from the desk iPad: a customer arrives without a booking. Creates an
 * appointment at the current time (สระไดร์ by default), optionally already
 * checked in to the serving staff. Anonymous by default; body.customerId for a
 * member walk-in (looked up via /api/kiosk/member). See lib/walkin.ts.
 * Branch-scoped via the kiosk cookie.
 */
export async function POST(request: Request) {
  const branch = await getKioskBranch();
  if (!branch) return NextResponse.json({ error: "Kiosk not armed" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const staffId = body.staffId;
  const customerId = typeof body.customerId === "string" && body.customerId ? body.customerId : null;
  const serviceId = typeof body.serviceId === "string" && body.serviceId ? body.serviceId : null;

  // Validate the serving staff (if one was chosen) belongs to this branch.
  if (staffId) {
    if (typeof staffId !== "string") {
      return NextResponse.json({ error: "Invalid staffId" }, { status: 400 });
    }
    const staff = await prisma.staff.findUnique({
      where: { id: staffId }, select: { branchId: true, isActive: true },
    });
    if (!staff || staff.branchId !== branch.id || !staff.isActive) {
      return NextResponse.json({ error: "Staff not found at this branch" }, { status: 400 });
    }
  }

  try {
    const booking = await createWalkin({ branchId: branch.id, staffId: staffId || null, customerId, serviceId });
    return NextResponse.json({ ok: true, id: booking.id }, { status: 201 });
  } catch (e) {
    if (e instanceof WalkinError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
