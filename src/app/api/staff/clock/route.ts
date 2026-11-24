import { NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/staff-auth";
import { myClockToday, punch } from "@/lib/clock";

export const dynamic = "force-dynamic";

/** GET → my clock-in / clock-out today. */
export async function GET() {
  const me = await getCurrentStaff();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await myClockToday(me.id), { headers: { "Cache-Control": "no-store" } });
}

/** POST { qr, confirm? } → clock in / out with the QR scanned at the desk. */
export async function POST(req: Request) {
  const me = await getCurrentStaff();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const r = await punch(me.id, String(body.qr ?? ""), body.confirm === true);
  return NextResponse.json(r);
}
