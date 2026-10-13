import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/admin-auth";
import { activePeople } from "@/lib/staff-person";
import { createDraftIfMissing } from "@/lib/payslip-admin";
import { bangkokTodayStr } from "@/lib/payroll";

/** POST /api/admin/payslips/generate { month } — draft a slip for every active person who has none yet. */
export async function POST(request: Request) {
  const gate = await requireOwner().catch((e: unknown) => e as Response);
  if (gate instanceof Response) return gate;
  const { month } = await request.json().catch(() => ({})) as { month?: string };
  if (!month || !/^\d{4}-\d{2}$/.test(month) || month > bangkokTodayStr().slice(0, 7)) {
    return NextResponse.json({ error: "เดือนไม่ถูกต้อง" }, { status: 400 });
  }
  let created = 0;
  for (const person of await activePeople()) {
    if ((await createDraftIfMissing(person, month)) === "created") created++;
  }
  return NextResponse.json({ created });
}
