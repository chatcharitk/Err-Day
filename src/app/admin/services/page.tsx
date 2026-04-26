import { prisma } from "@/lib/prisma";
import ServicesManager from "./ServicesManager";

export const dynamic = "force-dynamic";

export default async function ServicesPage() {
  const [services, branches] = await Promise.all([
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
  ]);

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
    />
  );
}
