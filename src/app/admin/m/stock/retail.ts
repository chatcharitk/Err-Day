import { prisma } from "@/lib/prisma";
import { RETAIL_CATEGORY } from "@/lib/capacity";

/** POS retail items not yet linked to another product (plus the current link). */
export async function retailOptions(productId?: string) {
  const [services, taken] = await Promise.all([
    prisma.service.findMany({ where: { category: RETAIL_CATEGORY, isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, nameTh: true } }),
    prisma.product.findMany({ where: { serviceId: { not: null }, ...(productId ? { NOT: { id: productId } } : {}) }, select: { serviceId: true } }),
  ]);
  const used = new Set(taken.map(t => t.serviceId));
  return services.filter(s => !used.has(s.id)).map(s => ({ id: s.id, name: s.nameTh || s.name }));
}

/** Categories already used by products (for the picker). */
export async function usedCategories(): Promise<string[]> {
  const rows = await prisma.product.findMany({ where: { category: { not: null } }, distinct: ["category"], select: { category: true } });
  return rows.map(r => r.category!).filter(Boolean);
}
