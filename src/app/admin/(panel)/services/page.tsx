import { prisma } from "@/lib/prisma";
import ServicesManager from "./ServicesManager";

export const revalidate = 30;

// Categories that are bookkeeping-only (membership / package SKUs, not real
// services). Excluded from the dropdown so the admin can't accidentally
// reuse them when creating a new bookable service.
const HIDDEN_CATEGORIES = ["Membership", "แพ็กเกจ"];

export default async function ServicesPage() {
  const [services, branches, distinctCategories] = await Promise.all([
    prisma.service.findMany({
      orderBy: [{ category: "asc" }, { nameTh: "asc" }],
      include: {
        branches: {
          include: { branch: true },
          orderBy: { branch: { name: "asc" } },
        },
      },
    }),
    prisma.branch.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    // Pull the categories actually in use today so the dropdown matches reality
    // instead of showing the generic salon list.
    prisma.service.findMany({
      distinct: ["category"],
      select:   { category: true },
      orderBy:  { category: "asc" },
    }),
  ]);

  const categories = distinctCategories
    .map(c => c.category)
    .filter(c => c && !HIDDEN_CATEGORIES.includes(c));

  return (
    <ServicesManager
      services={services.map(s => ({
        id: s.id,
        name: s.name,
        nameTh: s.nameTh,
        category: s.category,
        advanceBookingRequired: s.advanceBookingRequired,
        memberPrice: s.memberPrice,
        memberDiscountPercent: s.memberDiscountPercent,
        isActive: s.isActive,
        branches: s.branches.map(bs => ({
          id: bs.id,
          branchId: bs.branchId,
          price: bs.price,
          duration: bs.duration,
          isActive: bs.isActive,
          branch: { id: bs.branch.id, name: bs.branch.name },
        })),
      }))}
      branches={branches.map(b => ({ id: b.id, name: b.name }))}
      categories={categories}
    />
  );
}
