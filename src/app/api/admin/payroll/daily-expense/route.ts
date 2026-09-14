import { requireOwner } from "@/lib/admin-auth";
export async function POST() {
  const gate = await requireOwner().catch((e: unknown) => e as Response);
  if (gate instanceof Response) return gate;
  return Response.json(
    { error: "กรุณาโหลดหน้าค่าตอบแทนใหม่ แล้วใช้ยืนยันจ่ายและบันทึกรายจ่าย" },
    { status: 410 },
  );
}
