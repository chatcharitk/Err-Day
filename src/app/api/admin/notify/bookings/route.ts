import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { sendBranchBookingSchedule } from "@/lib/notifications";

/**
 * POST /api/admin/notify/bookings
 * Body: { branchId: string, day: "today" | "tomorrow" }
 * Manually push a branch's booking schedule to its LINE group chat.
 */
export async function POST(request: Request) {
  const _gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (_gate instanceof Response) return _gate;

  const { branchId, day } = await request.json().catch(() => ({}));
  if (typeof branchId !== "string" || (day !== "today" && day !== "tomorrow")) {
    return NextResponse.json({ error: "branchId + day (today|tomorrow) required" }, { status: 400 });
  }

  const result = await sendBranchBookingSchedule(branchId, day);
  if (result.status === "SKIPPED") {
    return NextResponse.json({ error: "สาขานี้ยังไม่ได้ตั้งค่ากลุ่ม LINE" }, { status: 400 });
  }
  if (result.status === "FAILED") {
    return NextResponse.json({ error: result.reason ?? "ส่งไม่สำเร็จ" }, { status: 502 });
  }
  return NextResponse.json(result);
}
