import { requireOwner } from "@/lib/admin-auth";
import { computeBranchMonthlyPayout } from "@/lib/payroll";
export async function GET(request: Request) {
  const gate = await requireOwner().catch((e: unknown) => e as Response);
  if (gate instanceof Response) return gate;
  try {
    const sp = new URL(request.url).searchParams;
    if (!sp.get("branchId")) throw new Error("กรุณาเลือกสาขา");
    return Response.json({
      rows: await computeBranchMonthlyPayout(
        sp.get("branchId")!,
        sp.get("month") ?? "",
      ),
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "โหลดไม่สำเร็จ" },
      { status: 400 },
    );
  }
}
// Monthly reports aggregate daily payments; they must never create another expense.
export async function POST() {
  const gate = await requireOwner().catch((e: unknown) => e as Response);
  if (gate instanceof Response) return gate;
  return Response.json(
    {
      error:
        "สรุปรายเดือนเป็นรายงานเท่านั้น เพื่อป้องกันรายจ่ายซ้ำ ให้บันทึกจากรายวัน",
    },
    { status: 410 },
  );
}
