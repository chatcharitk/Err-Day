import { prisma } from "@/lib/prisma";
import PosTerminal from "./PosTerminal";

export const dynamic = "force-dynamic";

export default async function PosPage({
  searchParams,
}: {
  searchParams: Promise<{ branchId?: string; bookingId?: string; customerPhone?: string; customerName?: string }>;
}) {
  const { branchId, bookingId, customerPhone, customerName } = await searchParams;

  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  // If redirected from a calendar booking, load it for pre-fill
  let prefillBooking: {
    id: string;
    branchId: string;
    customer: { name: string; phone: string };
    serviceName: string;
    totalPrice: number;
  } | null = null;

  if (bookingId) {
    const b = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { customer: true, service: true },
    });
    if (b) {
      prefillBooking = {
        id: b.id,
        branchId: b.branchId,
        customer: { name: b.customer.name, phone: b.customer.phone },
        serviceName: b.service.nameTh || b.service.name,
        totalPrice: b.totalPrice,
      };
    }
  }

  // Use the booking's branch if no explicit branchId was given
  const activeBranchId =
    branchId ?? prefillBooking?.branchId ?? branches[0]?.id ?? "";

  const [branchServices, addons] = await Promise.all([
    activeBranchId
      ? prisma.branchService.findMany({
          where: { branchId: activeBranchId, isActive: true },
          include: { service: true },
          orderBy: [{ service: { category: "asc" } }],
        })
      : Promise.resolve([]),
    prisma.serviceAddon.findMany({
      where: { isActive: true },
      orderBy: { price: "asc" },
    }),
  ]);

  // Pre-fill customer from ?customerPhone param (e.g. navigating from pending tab)
  let prefillCustomer: { id: string | null; name: string; phone: string } | null = null;
  if (customerPhone && !prefillBooking) {
    const c = await prisma.customer.findUnique({
      where: { phone: customerPhone },
      select: { id: true, name: true, phone: true },
    });
    prefillCustomer = c
      ? { id: c.id, name: c.name, phone: c.phone }
      : { id: null, name: customerName ?? "", phone: customerPhone };
  }

  return (
    <PosTerminal
      branches={branches}
      activeBranchId={activeBranchId}
      branchServices={branchServices}
      addons={addons}
      prefillBooking={prefillBooking}
      prefillCustomer={prefillCustomer}
    />
  );
}
