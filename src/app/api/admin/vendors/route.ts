import { prisma } from "@/lib/prisma";
import { requireAdmin, requireOwner } from "@/lib/admin-auth";
import { jsonSnapshot } from "@/lib/finance-audit";
export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const manage = sp.get("manage") === "1";
  const gate = await (manage ? requireOwner() : requireAdmin()).catch(
    (e: unknown) => e as Response,
  );
  if (gate instanceof Response) return gate;
  const q = sp.get("q")?.trim() || "";
  const vendors = await prisma.vendor.findMany({
    where: {
      ...(!manage ? { isActive: true } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { legalName: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
    take: manage
      ? 1000
      : Math.max(1, Math.min(50, Number(sp.get("limit")) || 20)),
  });
  if (manage) {
    const staff = await prisma.staff.findMany({
      where: { isActive: true },
      select: { id: true, name: true, branch: { select: { name: true } } },
      orderBy: { name: "asc" },
    });
    return Response.json({ vendors, staff });
  }
  return Response.json({
    vendors: vendors.map((v) => ({
      id: v.id,
      name: v.name,
      phone: v.phone,
      category: v.category,
      type: v.type,
      legalName: v.legalName,
      complete: !!(v.legalName && v.taxId && v.address),
    })),
  });
}
async function save(request: Request, update: boolean) {
  const gate = await requireOwner().catch((e: unknown) => e as Response);
  if (gate instanceof Response) return gate;
  try {
    const b = await request.json();
    if (typeof b.name !== "string" || !b.name.trim())
      throw new Error("กรุณาระบุชื่อผู้รับเงิน");
    if (!["BUSINESS", "PERSON", "EMPLOYEE"].includes(b.type))
      throw new Error("ประเภทผู้รับเงินไม่ถูกต้อง");
    if (b.taxId && !/^\d{13}$/.test(b.taxId))
      throw new Error("เลขผู้เสียภาษี / เลขประชาชนต้องมี 13 หลัก");
    if (b.type === "EMPLOYEE" && !b.staffId)
      throw new Error("กรุณาเชื่อมกับพนักงาน");
    const data = {
      name: b.name.trim(),
      type: b.type,
      staffId: b.type === "EMPLOYEE" ? String(b.staffId) : null,
      isActive: b.isActive !== false,
      ...Object.fromEntries(
        [
          "legalName",
          "taxId",
          "address",
          "taxBranch",
          "phone",
          "bankName",
          "bankAccount",
          "bankAccountName",
          "category",
          "notes",
        ].map((k) => [
          k,
          typeof b[k] === "string" ? b[k].trim().slice(0, 2000) || null : null,
        ]),
      ),
    };
    const vendor = await prisma.$transaction(async (tx) => {
      const old = update
        ? await tx.vendor.findUniqueOrThrow({ where: { id: String(b.id) } })
        : null;
      if (old?.staffId && data.staffId !== old.staffId)
        throw new Error(
          "เปลี่ยนพนักงานที่เชื่อมไว้ไม่ได้ ให้ปิดใช้งานแล้วสร้างผู้รับเงินใหม่",
        );
      const v = update
        ? await tx.vendor.update({ where: { id: String(b.id) }, data })
        : await tx.vendor.create({ data });
      await tx.financeAudit.create({
        data: {
          entity: "PAYEE",
          recordId: v.id,
          action: update ? "UPDATE" : "CREATE",
          actor: gate.username,
          ...(old ? { before: jsonSnapshot(old) } : {}),
          after: jsonSnapshot(v),
        },
      });
      return v;
    });
    return Response.json({ vendor });
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof Error && e.message.includes("Unique constraint")
            ? "พนักงานคนนี้เชื่อมกับผู้รับเงินแล้ว กรุณาแก้รายการเดิม"
            : e instanceof Error
              ? e.message
              : "บันทึกไม่สำเร็จ",
      },
      { status: 400 },
    );
  }
}
export const POST = (r: Request) => save(r, false);
export const PATCH = (r: Request) => save(r, true);
