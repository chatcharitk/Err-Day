import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { getCurrentStaff } from "@/lib/staff-auth";

/**
 * Hair-colour record (HairProfile + ColorVisit). Choices mirror the salon's
 * paper "HAIR COLOR RECORD" form. Cost (ColorVisit.costSatang) is admin-only:
 * staff-facing loaders here never select it.
 */

export { CONSENT_VERSION, OPT, ALLERGY_LABEL, RESULT_LABEL, ZONE_LABEL, ZONES, RETOUCH_WEEKS, developerGramsOf } from "@/lib/color-options";
export type { ColorShade, ColorZone } from "@/lib/color-options";
import { OPT, ZONES, developerGramsOf, type ColorZone } from "@/lib/color-options";

/** Validate/clean zones coming from the client. */
export function cleanZones(raw: unknown): ColorZone[] {
  if (!Array.isArray(raw)) return [];
  const out: ColorZone[] = [];
  for (const r of raw as Record<string, unknown>[]) {
    const zone = String(r?.zone ?? "");
    if (!(ZONES as readonly string[]).includes(zone)) continue;
    const shades = (Array.isArray(r.shades) ? r.shades as Record<string, unknown>[] : [])
      .map(x => ({ productId: x?.productId ? String(x.productId) : null, label: String(x?.label ?? "").slice(0, 80), grams: Math.max(0, Math.min(1000, Math.round(Number(x?.grams) || 0))) }))
      .filter(x => x.label);
    const str = (v: unknown, allowed: readonly string[]) => (typeof v === "string" && allowed.includes(v) ? v : null);
    const iso = (v: unknown) => (typeof v === "string" && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null);
    const minutes = r.minutes == null || r.minutes === "" ? null : Math.max(0, Math.min(180, Math.round(Number(r.minutes) || 0)));
    out.push({
      zone: zone as ColorZone["zone"], shades,
      developerPercent: str(r.developerPercent, OPT.developer), ratio: str(r.ratio, OPT.ratio),
      minutes, startedAt: iso(r.startedAt), rinsedAt: iso(r.rinsedAt),
    });
  }
  return out;
}

/** Grams in a tube/bottle from the product size ("80 g" → 80, "1 L" → 1000). */
export function packGrams(size: string | null | undefined): number | null {
  const m = size?.trim().match(/^(\d+(?:\.\d+)?)\s*(g|ml|l)$/i);
  if (!m) return null;
  const n = Number(m[1]);
  return m[2].toLowerCase() === "l" ? n * 1000 : n;
}

/** Admin-only: chemical cost of a formula (colour + developer) from stock costs. */
export async function formulaCostSatang(zones: ColorZone[]): Promise<number | null> {
  const ids = [...new Set(zones.flatMap(z => z.shades.map(s => s.productId)).filter((x): x is string => !!x))];
  const products = await prisma.product.findMany({
    where: { OR: [{ id: { in: ids } }, { name: { startsWith: "Hydrogen" } }] },
    select: { id: true, name: true, brand: true, size: true, costSatang: true },
  });
  const perGram = (p?: { size: string | null; costSatang: number | null }) => {
    const g = packGrams(p?.size); return p?.costSatang != null && g ? p.costSatang / g : null;
  };
  let total = 0, known = false;
  for (const z of zones) {
    let brand: string | null = null;
    for (const s of z.shades) {
      const p = products.find(x => x.id === s.productId);
      brand ??= p?.brand ?? null;
      const c = perGram(p);
      if (c != null && s.grams) { total += c * s.grams; known = true; }
    }
    const devG = developerGramsOf(z);
    if (devG && z.developerPercent) {
      const dev = products.find(p => p.name === `Hydrogen ${z.developerPercent}` && (!brand || p.brand === brand))
        ?? products.find(p => p.name === `Hydrogen ${z.developerPercent}`);
      const c = perGram(dev);
      if (c != null) { total += c * devG; known = true; }
    }
  }
  return known ? Math.round(total) : null;
}

export type ColorActor = { name: string; staffId?: string; adminId?: string; isAdmin: boolean; branchId?: string };

/** Admin or staff session (the colour card is used from both apps). */
export async function colorActor(): Promise<ColorActor | null> {
  const admin = await getCurrentAdmin();
  if (admin) return { name: admin.name, adminId: admin.id, isAdmin: true };
  const staff = await getCurrentStaff();
  if (staff) return { name: staff.name, staffId: staff.id, isAdmin: false, branchId: staff.branchId };
  return null;
}

/** Fields of a visit that staff may see — costSatang deliberately excluded. */
export const VISIT_PUBLIC_SELECT = {
  id: true, customerId: true, bookingId: true, branchId: true, staffId: true, stylistName: true, visitNo: true, date: true,
  serviceTypes: true, rootLevel: true, midEndsLevel: true, targetLevel: true, grayPercent: true, preChecks: true,
  patchTestNeeded: true, zones: true, otherProducts: true, colorGrams: true, developerGrams: true, result: true,
  scalpAfter: true, referencePhotos: true, beforePhotos: true, afterPhotos: true, nextTimeNotes: true, status: true,
  completedAt: true, updatedAt: true,
} as const;

export function bangkokNoon(d = new Date()): Date {
  const bkk = new Date(d.getTime() + 7 * 3600_000);
  return new Date(Date.UTC(bkk.getUTCFullYear(), bkk.getUTCMonth(), bkk.getUTCDate(), 12));
}
