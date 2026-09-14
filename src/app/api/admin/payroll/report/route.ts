import { requireOwner } from "@/lib/admin-auth";
import { payrollReport } from "@/lib/payroll-report";
import { csvText } from "@/lib/finance-math";
export async function GET(request: Request) {
  const gate = await requireOwner().catch((e: unknown) => e as Response);
  if (gate instanceof Response) return gate;
  try {
    const sp = new URL(request.url).searchParams,
      data = await payrollReport(sp),
      format = sp.get("format");
    if (format !== "csv" && format !== "bookings") return Response.json(data);
    const rows: unknown[][] =
      format === "csv"
        ? [
            [
              "รหัสพนักงาน",
              "พนักงาน",
              "สาขา",
              "วันที่ทำงาน",
              "เวลาเข้าจริง",
              "เวลาออกจริง",
              "พักไม่นับ (นาที)",
              "เวลาทำงาน (นาที)",
              "OT ที่จ่าย (ชม.)",
              "ค่ามือ (บาท)",
              "OT ที่จ่าย (บาท)",
              "ทิป (บาท)",
              "ปรับเพิ่มลด (บาท)",
              "เหตุผล",
              "ยอดจ่ายจริง (บาท)",
              "สถานะ",
              "วันที่จ่าย",
              "รหัสรายจ่าย",
              "แหล่งรายละเอียด",
            ],
          ]
        : [
            [
              "รหัสพนักงาน",
              "พนักงาน",
              "วันที่",
              "รหัสบุ๊กกิ้ง",
              "เวลา",
              "บริการ",
              "บริการเสริม",
              "บทบาท",
              "สถานะงาน",
              "ค่ามือ (บาท)",
              "ข้อมูล ณ วันจ่าย / ปัจจุบัน",
            ],
          ];
    const local = (v: string | null) =>
      v
        ? new Date(Date.parse(v) + 7 * 3600000)
            .toISOString()
            .replace("T", " ")
            .slice(0, 19)
        : "";
    for (const p of data.people)
      for (const d of p.days) {
        if (format === "csv")
          rows.push([
            p.id,
            p.name,
            data.branch,
            d.date,
            local(d.clockIn),
            local(d.clockOut),
            d.breakMinutes,
            d.workedMinutes,
            d.otHours,
            d.commissionSatang / 100,
            d.otSatang / 100,
            d.tipSatang / 100,
            d.adjustmentSatang / 100,
            d.reason,
            d.totalSatang / 100,
            d.status,
            local(d.paidAt),
            d.expenseId,
            d.legacy
              ? "รายละเอียดปัจจุบัน; ยอดจ่ายเดิม"
              : d.status === "PAID"
                ? "ข้อมูล ณ วันจ่าย"
                : "ยังไม่จ่าย; OT ยังไม่ยืนยัน",
          ]);
        else
          for (const b of d.bookings)
            rows.push([
              p.id,
              p.name,
              d.date,
              b.id,
              b.time,
              b.service,
              b.addons,
              b.primary ? "ช่างหลัก" : "ผู้ช่วย",
              b.status,
              b.commissionSatang / 100,
              d.legacy || d.status !== "PAID"
                ? "ข้อมูลปัจจุบัน"
                : "ข้อมูล ณ วันจ่าย",
            ]);
      }
    return new Response(csvText(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="payroll-${format}-${data.range.from}-${data.range.to}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "สร้างรายงานไม่สำเร็จ" },
      { status: 400 },
    );
  }
}
