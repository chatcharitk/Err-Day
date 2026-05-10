import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PACKAGE_SPECS } from "@/lib/packages";

// PATCH /api/admin/customers/[id]/packages/[pkgId] — edit start/expiry/pending/usages
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; pkgId: string }> },
) {
  try {
    const { pkgId } = await params;
    const { startedAt, expiresAt, pendingActivation, usagesUsed, paidAmount, notes, activate } =
      await request.json();

    // "activate" shortcut: flips pending → active and recomputes dates from the package's spec
    if (activate) {
      const existing = await prisma.customerPackage.findUnique({ where: { id: pkgId } });
      if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const spec = PACKAGE_SPECS[existing.packageSku];
      const now  = new Date();
      // Inclusive expiry: count "now" as day 1 and add (validityDays - 1) more days.
      const days = spec ? spec.validityDays : 30;
      const expiry = new Date(now.getTime() + (days - 1) * 24 * 60 * 60 * 1000);

      // Close other open packages of the same SKU now that this is going active
      await prisma.customerPackage.updateMany({
        where: {
          customerId: existing.customerId,
          packageSku: existing.packageSku,
          closedAt:   null,
          pendingActivation: false,
          NOT: { id: pkgId },
        },
        data: { closedAt: now },
      });

      const updated = await prisma.customerPackage.update({
        where: { id: pkgId },
        data: {
          startedAt:         now,
          expiresAt:         expiry,
          pendingActivation: false,
        },
      });
      return NextResponse.json(updated);
    }

    const updated = await prisma.customerPackage.update({
      where: { id: pkgId },
      data: {
        ...(startedAt         !== undefined ? { startedAt: new Date(startedAt) } : {}),
        ...(expiresAt         !== undefined ? { expiresAt: new Date(expiresAt) } : {}),
        ...(pendingActivation !== undefined ? { pendingActivation: !!pendingActivation } : {}),
        ...(usagesUsed        !== undefined ? { usagesUsed }     : {}),
        ...(paidAmount        !== undefined ? { paidAmount }     : {}),
        ...(notes             !== undefined ? { notes }          : {}),
      },
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update package" }, { status: 500 });
  }
}

// DELETE /api/admin/customers/[id]/packages/[pkgId] — soft-close (closedAt = now)
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; pkgId: string }> },
) {
  try {
    const { pkgId } = await params;
    await prisma.customerPackage.update({
      where: { id: pkgId },
      data:  { closedAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete package" }, { status: 500 });
  }
}
