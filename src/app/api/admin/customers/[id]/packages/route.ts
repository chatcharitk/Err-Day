import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PACKAGE_SPECS } from "@/lib/packages";

// POST /api/admin/customers/[id]/packages — create a package for a customer (manual entry)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: customerId } = await params;
    const { sku, startedAt, expiresAt, paidAmount, pendingActivation, notes } =
      await request.json();

    const spec = PACKAGE_SPECS[sku];
    if (!spec) {
      return NextResponse.json({ error: "Unknown package SKU" }, { status: 400 });
    }

    const start  = startedAt ? new Date(startedAt) : new Date();
    const expiry = expiresAt
      ? new Date(expiresAt)
      // Inclusive expiry: start day counts as day 1, add (validityDays - 1) more days
      : new Date(start.getTime() + (spec.validityDays - 1) * 24 * 60 * 60 * 1000);

    // Close any open package of the same SKU when activating a new one
    if (!pendingActivation) {
      await prisma.customerPackage.updateMany({
        where: { customerId, packageSku: sku, closedAt: null, pendingActivation: false },
        data:  { closedAt: new Date() },
      });
    }

    const pkg = await prisma.customerPackage.create({
      data: {
        customerId,
        packageSku:        sku,
        startedAt:         start,
        expiresAt:         expiry,
        usagesUsed:        0,
        usageLimit:        spec.usageLimit,
        paidAmount:        paidAmount ?? spec.priceSatang,
        paymentMethod:     "Manual",
        pendingActivation: !!pendingActivation,
        notes:             notes ?? null,
      },
    });
    return NextResponse.json(pkg, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create package" }, { status: 500 });
  }
}
