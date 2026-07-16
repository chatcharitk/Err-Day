import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

/**
 * Cached lists of slow-changing reference data: branches, branch services,
 * branch staff, and addons. 5-minute revalidation. Tags allow targeted
 * invalidation when admin edits.
 */

export const getCachedBranches = unstable_cache(
  async () => {
    return prisma.branch.findMany({
      where:   { isActive: true },
      orderBy: { name: "asc" },
      select:  { id: true, name: true },
    });
  },
  ["active-branches-slim"],
  { revalidate: 3600, tags: ["branches"] },
);

export function getCachedBranchServices(branchId: string) {
  return unstable_cache(
    async () => {
      const rows = await prisma.branchService.findMany({
        // Require the parent Service to be active too — a deactivated service
        // whose BranchService row was left active must not leak into pickers.
        where:   { branchId, isActive: true, service: { isActive: true } },
        orderBy: { service: { category: "asc" } },
        select: {
          serviceId: true,
          price:     true,
          duration:  true,
          service:   { select: { nameTh: true, category: true, memberPrice: true, memberDiscountPercent: true } },
        },
      });
      return rows.map((bs) => ({
        id:                    bs.serviceId,
        nameTh:                bs.service.nameTh,
        category:              bs.service.category,
        price:                 bs.price,
        duration:              bs.duration,
        memberPrice:           bs.service.memberPrice,
        memberDiscountPercent: bs.service.memberDiscountPercent,
      }));
    },
    [`branch-services-${branchId}`],
    { revalidate: 3600, tags: ["services", `branch-services-${branchId}`] },
  )();
}

export function getCachedBranchStaff(branchId: string) {
  return unstable_cache(
    async () => {
      return prisma.staff.findMany({
        where:   { branchId, isActive: true },
        orderBy: { name: "asc" },
        select:  { id: true, name: true },
      });
    },
    [`branch-staff-${branchId}`],
    { revalidate: 3600, tags: ["staff", `branch-staff-${branchId}`] },
  )();
}

export const getCachedAddons = unstable_cache(
  async () => {
    return prisma.serviceAddon.findMany({
      where:   { isActive: true },
      orderBy: { price: "asc" },
      select:  { id: true, nameTh: true, price: true },
    });
  },
  ["active-addons-slim"],
  { revalidate: 3600, tags: ["addons"] },
);
