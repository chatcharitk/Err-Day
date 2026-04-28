import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { timeToMins } from "@/lib/capacity";

/**
 * PATCH /api/admin/staff/[id]/shifts/[shiftId]
 * Body: { startTime?, endTime?, date? }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; shiftId: string }> },
) {
  try {
    const { id, shiftId } = await params;
    const body = await request.json();
    const { startTime, endTime, date } = body as {
      startTime?: string; endTime?: string; date?: string;
    };

    const existing = await prisma.staffShift.findUnique({ where: { id: shiftId } });
    if (!existing || existing.staffId !== id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const newStart = startTime ?? existing.startTime;
    const newEnd   = endTime   ?? existing.endTime;
    if (timeToMins(newStart) >= timeToMins(newEnd)) {
      return NextResponse.json({ error: "startTime must be before endTime" }, { status: 400 });
    }

    const updated = await prisma.staffShift.update({
      where: { id: shiftId },
      data: {
        ...(startTime !== undefined ? { startTime } : {}),
        ...(endTime   !== undefined ? { endTime   } : {}),
        ...(date      !== undefined ? { date: new Date(date + "T12:00:00") } : {}),
      },
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update shift error:", error);
    return NextResponse.json({ error: "Failed to update shift" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/staff/[id]/shifts/[shiftId]
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; shiftId: string }> },
) {
  try {
    const { id, shiftId } = await params;
    const existing = await prisma.staffShift.findUnique({ where: { id: shiftId } });
    if (!existing || existing.staffId !== id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await prisma.staffShift.delete({ where: { id: shiftId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete shift error:", error);
    return NextResponse.json({ error: "Failed to delete shift" }, { status: 500 });
  }
}
