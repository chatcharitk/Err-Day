import { prisma } from "@/lib/prisma";
import { shortBranchName } from "@/lib/stock";
import type { RestockRow } from "@/components/restock/RestockList";

/** Open requests first (oldest first), then the latest done ones. */
export async function loadRestockRows(opts: { branchId?: string; doneLimit?: number } = {}): Promise<RestockRow[]> {
  const where = opts.branchId ? { branchId: opts.branchId } : {};
  const [open, done, branches] = await Promise.all([
    prisma.restockRequest.findMany({ where: { ...where, status: "OPEN" }, orderBy: { createdAt: "asc" } }),
    prisma.restockRequest.findMany({ where: { ...where, status: "DONE" }, orderBy: { doneAt: "desc" }, take: opts.doneLimit ?? 10 }),
    prisma.branch.findMany({ select: { id: true, name: true } }),
  ]);
  const name = (id: string) => shortBranchName(branches.find(b => b.id === id)?.name ?? id);
  return [...open, ...done].map(r => ({
    id: r.id, branch: name(r.branchId), items: r.items, extras: r.extras, note: r.note, requestedBy: r.requestedBy,
    createdAt: r.createdAt.toISOString(), status: r.status, doneAt: r.doneAt?.toISOString() ?? null, doneBy: r.doneBy,
  }));
}
