import { prisma } from "@/lib/prisma";
import { customerLabel } from "@/lib/customer-name";
import { VISIT_PUBLIC_SELECT, cleanZones, type ColorZone } from "@/lib/color";

/**
 * Everything the colour card screens need — staff-safe (no cost). The shade
 * picker comes from stock products in the "สีย้อมผม" category.
 */

export type ShadeOption = { id: string; label: string; brand: string | null; name: string; qtyByBranch: Record<string, number> };

export async function loadColorCard(customerId: string) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, name: true, nickname: true, phone: true, pictureUrl: true, hairProfile: true },
  });
  if (!customer) return null;
  const [visits, branches] = await Promise.all([
    prisma.colorVisit.findMany({ where: { customerId }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 40, select: VISIT_PUBLIC_SELECT }),
    prisma.branch.findMany({ select: { id: true, name: true }, orderBy: { createdAt: "asc" } }),
  ]);
  const branchName = (id: string) => branches.find(b => b.id === id)?.name.replace(/^err\.day\s*สาขา/, "") ?? id;
  return {
    customer: { ...customer, label: customerLabel(customer) },
    profile: customer.hairProfile,
    visits: visits.map(v => ({ ...v, zones: cleanZones(v.zones), branchName: branchName(v.branchId) })),
    branches: branches.map(b => ({ id: b.id, name: b.name.replace(/^err\.day\s*สาขา/, "") })),
  };
}

export type ColorCardData = NonNullable<Awaited<ReturnType<typeof loadColorCard>>>;
export type ColorVisitView = ColorCardData["visits"][number];

export async function loadShadeOptions(): Promise<ShadeOption[]> {
  const products = await prisma.product.findMany({
    where: { isActive: true, category: "สีย้อมผม", NOT: { name: { contains: "Bleach" } } },
    select: { id: true, name: true, brand: true, levels: { select: { location: true, qty: true } } },
  });
  return products
    .map(p => ({
      id: p.id, name: p.name, brand: p.brand,
      label: [p.brand, p.name].filter(Boolean).join(" "),
      qtyByBranch: Object.fromEntries(p.levels.map(l => [l.location, l.qty])),
    }))
    .sort((a, b) => (a.brand ?? "").localeCompare(b.brand ?? "") || a.name.localeCompare(b.name, "th", { numeric: true }));
}

/** One-line formula summary, e.g. "โคน · 7-pGG 40g · 6% 1:1.5 · 30′". */
export function zoneSummary(z: ColorZone): string {
  const shades = z.shades.map(s => `${s.label.replace(/^(Ordeve|NIGAO)\s+/i, "")} ${s.grams}g`).join(" + ");
  return [shades || "—", [z.developerPercent, z.ratio].filter(Boolean).join(" "), z.minutes ? `${z.minutes}′` : ""].filter(Boolean).join(" · ");
}
