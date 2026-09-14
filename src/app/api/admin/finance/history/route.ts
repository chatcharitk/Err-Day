import { requireOwner } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { bangkokDayNoon } from "@/lib/payroll";
import { validDay } from "@/lib/finance-math";
export async function GET(request: Request) {
  const gate = await requireOwner().catch((e: unknown) => e as Response);
  if (gate instanceof Response) return gate;
  const sp = new URL(request.url).searchParams;
  let recordId = sp.get("recordId");
  const entity = sp.get("entity");
  if (entity === "PAYROLL") {
    const staffId = sp.get("staffId"),
      date = sp.get("date") ?? "";
    if (!staffId || !validDay(date))
      return Response.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
    recordId =
      (
        await prisma.staffDailyPayout.findUnique({
          where: { staffId_date: { staffId, date: bangkokDayNoon(date) } },
          select: { id: true },
        })
      )?.id ?? null;
  } else if (entity !== "EXPENSE")
    return Response.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  if (!recordId) return Response.json({ rows: [] });
  const rows = await prisma.financeAudit.findMany({
    where: { entity, recordId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return Response.json({ rows }, { headers: { "Cache-Control": "no-store" } });
}
