import { prisma } from "@/lib/prisma";
import NewBookingForm from "./NewBookingForm";

export const dynamic = "force-dynamic";

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function NewBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ branchId?: string; date?: string }>;
}) {
  const { branchId, date } = await searchParams;

  const branches = await prisma.branch.findMany({
    where:   { isActive: true },
    orderBy: { name: "asc" },
    select:  { id: true, name: true, openTime: true, closeTime: true },
  });

  const activeBranchId = branchId ?? branches[0]?.id ?? "";

  const branchServices = activeBranchId
    ? await prisma.branchService.findMany({
        where:   { branchId: activeBranchId, isActive: true },
        include: { service: true },
        orderBy: { service: { category: "asc" } },
      })
    : [];

  const branchStaff = activeBranchId
    ? await prisma.staff.findMany({
        where:   { branchId: activeBranchId, isActive: true },
        orderBy: { name: "asc" },
        select:  { id: true, name: true },
      })
    : [];

  return (
    <NewBookingForm
      branches={branches}
      activeBranchId={activeBranchId}
      defaultDate={date ?? toLocalDateStr(new Date())}
      branchServices={branchServices.map((bs) => ({
        id:       bs.serviceId,
        nameTh:   bs.service.nameTh,
        category: bs.service.category,
        price:    bs.price,
        duration: bs.duration,
      }))}
      branchStaff={branchStaff}
    />
  );
}
