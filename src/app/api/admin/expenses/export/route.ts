import { requireOwner } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { csvText, validDay } from "@/lib/finance-math";
import { EXPENSE_CATEGORIES } from "@/lib/expenses";
export async function GET(request: Request) {
  const gate = await requireOwner().catch((e: unknown) => e as Response);
  if (gate instanceof Response) return gate;
  try {
    const sp = new URL(request.url).searchParams,
      from = sp.get("from") || "",
      to = sp.get("to") || "",
      branch = sp.get("branchId"),
      category = sp.get("category");
    if (
      !validDay(from) ||
      !validDay(to) ||
      from > to ||
      Date.parse(to) - Date.parse(from) > 366 * 86400000
    )
      throw new Error("เลือกช่วงวันที่ไม่เกิน 366 วัน");
    const where = {
      status: "CONFIRMED",
      date: {
        gte: new Date(from + "T00:00:00Z"),
        lte: new Date(to + "T23:59:59.999Z"),
      },
      ...(branch && branch !== "all"
        ? { branchId: branch === "shared" ? null : branch }
        : {}),
      ...(category && category !== "all" ? { category } : {}),
    };
    const rows: unknown[][] = [
      [
        "รหัสรายจ่าย",
        "วันที่ลงรายจ่าย",
        "สาขา",
        "หมวด",
        "สถานะเอกสาร",
        "วันที่เอกสาร",
        "เลขที่เอกสาร",
        "ผู้รับเงิน",
        "ชื่อเต็ม",
        "เลขภาษี",
        "สาขาภาษี",
        "ที่อยู่",
        "ยอดเอกสาร (บาท)",
        "VAT (บาท)",
        "ส่วนลด (บาท)",
        "หัก ณ ที่จ่าย (บาท)",
        "จ่ายสุทธิ (บาท)",
        "วันที่จ่าย",
        "วิธีจ่าย",
        "รายการ",
        "หลักฐาน",
        "สิ่งที่ต้องตรวจ",
        "ต้นทาง",
        "หมายเหตุ",
      ],
    ];
    let cursor: string | undefined;
    do {
      const batch = await prisma.expense.findMany({
        where,
        orderBy: { id: "asc" },
        take: 1000,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        include: {
          branch: { select: { name: true } },
          vendorRef: true,
          items: true,
          attachments: true,
        },
      });
      if (!batch.length) break;
      for (const e of batch) {
        // Never substitute changed master data into a historical document snapshot.
        const p = (e.payeeSnapshot || e.vendorRef || {}) as {
          legalName?: string;
          taxId?: string;
          taxBranch?: string;
          address?: string;
        };
        const files = [
          ...new Set([
            ...e.attachments.map((a) => a.url),
            ...(e.receiptUrl ? [e.receiptUrl] : []),
          ]),
        ];
        const issues = [
          !p.legalName && "ขาดชื่อเต็ม",
          !p.taxId && "ขาดเลขภาษี",
          !p.address && "ขาดที่อยู่",
          !e.invoiceNumber && "ขาดเลขเอกสาร",
          !files.length && "ขาดหลักฐาน",
          !e.paidAt && "ยังไม่ระบุวันจ่าย",
          e.vatMode === "LEGACY" && "ตรวจการรวมยอดเอกสารเดิม",
          !e.payeeSnapshot && "ข้อมูลผู้รับเงินเดิมไม่มี snapshot",
        ]
          .filter(Boolean)
          .join("; ");
        rows.push([
          e.id,
          e.date.toISOString().slice(0, 10),
          e.branch?.name || "ส่วนกลาง",
          EXPENSE_CATEGORIES.find((c) => c.value === e.category)?.label ||
            e.category,
          e.status,
          e.documentDate?.toISOString().slice(0, 10),
          e.invoiceNumber,
          e.vendor,
          p.legalName,
          p.taxId,
          p.taxBranch,
          p.address,
          e.totalAmount / 100,
          (e.vatAmount || 0) / 100,
          e.discountAmount / 100,
          e.withholdingAmount / 100,
          (e.totalAmount - e.withholdingAmount) / 100,
          e.paidAt
            ? new Date(e.paidAt.getTime() + 7 * 3600000)
                .toISOString()
                .slice(0, 10)
            : "",
          e.paymentMethod,
          e.items
            .map(
              (it) =>
                `${it.description}: ${it.quantity} × ${it.unitPrice / 100} = ${it.totalPrice / 100}`,
            )
            .join("; "),
          files.join("\n"),
          issues,
          e.sourceKey,
          e.notes,
        ]);
      }
      cursor = batch[batch.length - 1].id;
      if (batch.length < 1000) break;
    } while (cursor);
    return new Response(csvText(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="expenses-accounting-${from}-${to}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "ส่งออกไม่สำเร็จ" },
      { status: 400 },
    );
  }
}
