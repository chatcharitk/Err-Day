import { prisma } from "@/lib/prisma";
import { SALE_ONLY_SKUS } from "@/lib/capacity";
import { customerLabel } from "@/lib/customer-name";
import { CHEER_AFTER_DAYS, cheerKind, type CheerKind } from "@/lib/cheer-due";

export interface CheerDueItem {
  customerId:   string;
  customerName: string;   // "ชื่อเล่น · ชื่อจริง" — never the phone
  serviceName:  string;
  kind:         CheerKind;
  branchId:     string;
  staffId:      string | null;   // the stylist who did the visit
  staffName:    string | null;
  visitYmd:     string;
  dueYmd:       string;
}

const ymdOf = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Customers due a cheer: a COMPLETED treatment 7 days ago / colour 56 days ago
 * who haven't come back (or booked) for the same kind of service since.
 *   graceDays 0 → due exactly today; 6 → due any day in the last week (so a
 *   stylist who was off on the due day still sees it).
 *   staffIds → only visits those stylists did; branchId → only that branch.
 */
export async function loadCheerDue(opts: { branchId?: string; staffIds?: string[]; graceDays?: number }): Promise<CheerDueItem[]> {
  const grace = opts.graceDays ?? 0;
  const bkk = new Date(Date.now() + 7 * 3600e3);
  const dayStart = (back: number) => new Date(Date.UTC(bkk.getUTCFullYear(), bkk.getUTCMonth(), bkk.getUTCDate() - back));

  const out: CheerDueItem[] = [];
  for (const kind of ["treatment", "color"] as const) {
    const after = CHEER_AFTER_DAYS[kind];
    const visits = await prisma.booking.findMany({
      where: {
        status: "COMPLETED",
        date: { gte: dayStart(after + grace), lt: dayStart(after - 1) },
        serviceId: { notIn: SALE_ONLY_SKUS },
        ...(opts.branchId ? { branchId: opts.branchId } : {}),
        ...(opts.staffIds ? { staffId: { in: opts.staffIds } } : {}),
      },
      select: {
        customerId: true, date: true, branchId: true, staffId: true,
        customer: { select: { name: true, nickname: true } },
        service:  { select: { name: true, nameTh: true, category: true } },
        staff:    { select: { name: true } },
      },
      orderBy: [{ date: "desc" }, { startTime: "asc" }],
    });
    const due = visits.filter(v => cheerKind(v.service) === kind);
    if (!due.length) continue;

    // One query for everything these customers did/booked afterwards.
    const later = await prisma.booking.findMany({
      where: {
        customerId: { in: [...new Set(due.map(v => v.customerId))] },
        date: { gte: dayStart(after + grace) },
        status: { in: ["PENDING", "CONFIRMED", "COMPLETED"] },
      },
      select: { customerId: true, date: true, service: { select: { name: true, nameTh: true, category: true } } },
    });

    const seen = new Set<string>();
    for (const v of due) {
      if (seen.has(v.customerId)) continue;
      if (later.some(l => l.customerId === v.customerId && l.date > v.date && cheerKind(l.service) === kind)) continue;
      seen.add(v.customerId);
      out.push({
        customerId:   v.customerId,
        customerName: customerLabel(v.customer),
        serviceName:  v.service.nameTh || v.service.name,
        kind,
        branchId:     v.branchId,
        staffId:      v.staffId,
        staffName:    v.staff?.name ?? null,
        visitYmd:     ymdOf(v.date),
        dueYmd:       ymdOf(new Date(v.date.getTime() + after * 86400e3)),
      });
    }
  }
  return out.sort((a, b) => b.dueYmd.localeCompare(a.dueYmd));
}
