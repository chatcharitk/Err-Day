import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const _gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (_gate instanceof Response) return _gate;

  try {
    const { id } = await params;
    const body = await request.json();
    const { name, phone, branchId, commissionRate, isActive,
            payType, baseSatang, payCadence, otRateSatang } = body;

    if (payType !== undefined && payType !== "MONTHLY_SALARY" && payType !== "DAILY_WAGE") {
      return NextResponse.json({ error: "invalid payType" }, { status: 400 });
    }
    if (payCadence !== undefined && payCadence !== "MONTHLY" && payCadence !== "WEEKLY") {
      return NextResponse.json({ error: "invalid payCadence" }, { status: 400 });
    }

    const staff = await prisma.staff.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(phone !== undefined ? { phone: phone?.trim() || null } : {}),
        ...(branchId !== undefined ? { branchId } : {}),
        ...(commissionRate !== undefined ? { commissionRate: Number(commissionRate) } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
        // ── Payroll config ──
        ...(payType !== undefined ? { payType } : {}),
        ...(baseSatang !== undefined ? { baseSatang: Math.max(0, Math.round(Number(baseSatang))) } : {}),
        ...(payCadence !== undefined ? { payCadence } : {}),
        ...(otRateSatang !== undefined
          ? { otRateSatang: otRateSatang === null || otRateSatang === "" ? null : Math.max(0, Math.round(Number(otRateSatang))) }
          : {}),
      },
      include: { branch: true },
    });
    // Bust the cached per-branch staff lists so edits/branch moves show at once.
    revalidateTag("staff", "max");
    return NextResponse.json(staff);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update staff" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const _gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (_gate instanceof Response) return _gate;

  try {
    const { id } = await params;
    // Soft delete
    await prisma.staff.update({ where: { id }, data: { isActive: false } });
    revalidateTag("staff", "max");
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete staff" }, { status: 500 });
  }
}
