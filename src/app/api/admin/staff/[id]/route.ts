import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";
import { numberIn } from "@/lib/finance-math";
import { jsonSnapshot } from "@/lib/finance-audit";
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
            payType, baseSatang, payCadence, otRateSatang, normalWorkMinutes } = body;

    const financeEdit = [payType, baseSatang, payCadence, otRateSatang, normalWorkMinutes].some(v => v !== undefined);
    if (financeEdit && _gate.role !== "OWNER") return NextResponse.json({ error: "เฉพาะเจ้าของเท่านั้น" }, { status: 403 });
    if (normalWorkMinutes !== undefined) numberIn(normalWorkMinutes, "ชั่วโมงปกติ", 1, 1440);
    if (baseSatang !== undefined) numberIn(baseSatang, "ฐานเงิน");
    if (otRateSatang !== undefined && otRateSatang !== null && otRateSatang !== "") numberIn(otRateSatang, "เรต OT");
    if (payType !== undefined && payType !== "MONTHLY_SALARY" && payType !== "DAILY_WAGE") {
      return NextResponse.json({ error: "invalid payType" }, { status: 400 });
    }
    if (payCadence !== undefined && payCadence !== "MONTHLY" && payCadence !== "WEEKLY") {
      return NextResponse.json({ error: "invalid payCadence" }, { status: 400 });
    }

    const staff = await prisma.$transaction(async tx => {
    const before = await tx.staff.findUniqueOrThrow({ where: { id } });
    const updated = await tx.staff.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(phone !== undefined ? { phone: phone?.trim() || null } : {}),
        ...(branchId !== undefined ? { branchId } : {}),
        ...(commissionRate !== undefined ? { commissionRate: Number(commissionRate) } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
        ...(normalWorkMinutes !== undefined ? { normalWorkMinutes } : {}),
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
    if (financeEdit) await tx.financeAudit.create({ data: { entity: "STAFF_PAY", recordId: id, action: "UPDATE", actor: _gate.username, before: jsonSnapshot({ payType: before.payType, baseSatang: before.baseSatang, otRateSatang: before.otRateSatang, normalWorkMinutes: before.normalWorkMinutes }), after: jsonSnapshot({ payType: updated.payType, baseSatang: updated.baseSatang, otRateSatang: updated.otRateSatang, normalWorkMinutes: updated.normalWorkMinutes }) } });
    return updated;
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
