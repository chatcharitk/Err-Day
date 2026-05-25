import { prisma } from "@/lib/prisma";
import MobileServices from "./MobileServices";

export const revalidate = 30;
export const metadata   = { title: "บริการ — err.day" };

export default async function MobileServicesPage() {
  const [services, branches] = await Promise.all([
    prisma.service.findMany({
      orderBy: [{ category: "asc" }, { nameTh: "asc" }],
      include: {
        branches: {
          include: { branch: { select: { id: true, name: true } } },
          orderBy: { branch: { name: "asc" } },
        },
      },
    }),
    prisma.branch.findMany({
      where:   { isActive: true },
      orderBy: { name: "asc" },
      select:  { id: true, name: true },
    }),
  ]);

  return (
    <MobileServices
      services={services.map(s => ({
        id:                     s.id,
        nameTh:                 s.nameTh,
        name:                   s.name,
        category:               s.category,
        advanceBookingRequired: s.advanceBookingRequired,
        memberPrice:            s.memberPrice,
        memberDiscountPercent:  s.memberDiscountPercent,
        isActive:               s.isActive,
        branches: s.branches.map(bs => ({
          id:        bs.id,
          branchId:  bs.branchId,
          price:     bs.price,
          duration:  bs.duration,
          isActive:  bs.isActive,
          branchName: bs.branch.name,
        })),
      }))}
      branches={branches}
    />
  );
}
