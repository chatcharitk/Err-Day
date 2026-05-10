import { prisma } from "@/lib/prisma";
import { defaultBranchId } from "@/lib/utils";
import { getCachedBranches } from "@/lib/branches-cache";
import MobilePos from "./MobilePos";

export const dynamic = "force-dynamic";

export default async function MobilePosPage({
  searchParams,
}: {
  searchParams: Promise<{ branchId?: string; bookingId?: string }>;
}) {
  const { branchId, bookingId } = await searchParams;

  const branches = await getCachedBranches();

  // If continuing from a booking, load it for pre-fill
  let prefillBooking: {
    id:          string;
    branchId:    string;
    customer:    { id: string; name: string; phone: string };
    serviceId:   string;
    serviceName: string;
    totalPrice:  number;
    /** True if the customer has a currently valid membership — used to apply member pricing immediately. */
    isMember:    boolean;
    /** Add-ons attached to the booking (snapshot prices at booking time). */
    addons:      { addonId: string; name: string; price: number }[];
  } | null = null;

  if (bookingId) {
    const todayUTC = new Date(); todayUTC.setUTCHours(0, 0, 0, 0);
    const b = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        service: true,
        customer: {
          include: {
            membership: {
              select: { expiresAt: true, usagesUsed: true, usagesAllowed: true, pendingActivation: true },
            },
          },
        },
        addons: {
          include: { addon: { select: { id: true, nameTh: true } } },
        },
      },
    });
    if (b) {
      // Determine live membership validity
      let isMember = false;
      if (b.customer.membership) {
        const m = b.customer.membership;
        const expired = m.expiresAt != null && new Date(m.expiresAt) < todayUTC;
        const usedUp  = m.usagesAllowed > 0 && m.usagesUsed >= m.usagesAllowed;
        isMember = !expired && !usedUp && !m.pendingActivation;
      }
      prefillBooking = {
        id:          b.id,
        branchId:    b.branchId,
        customer:    { id: b.customer.id, name: b.customer.name, phone: b.customer.phone },
        serviceId:   b.serviceId,
        serviceName: b.service.nameTh || b.service.name,
        totalPrice:  b.totalPrice,
        isMember,
        addons:      b.addons.map(a => ({
          addonId: a.addonId,
          name:    a.addon.nameTh,
          price:   a.price,           // snapshot price already reflects any member discount
        })),
      };
    }
  }

  const activeBranchId = branchId ?? prefillBooking?.branchId ?? defaultBranchId(branches);

  const [branchServices, addons] = await Promise.all([
    activeBranchId
      ? prisma.branchService.findMany({
          where:   { branchId: activeBranchId, isActive: true },
          select: {
            id:        true,
            branchId:  true,
            serviceId: true,
            price:     true,
            duration:  true,
            isActive:  true,
            service: {
              select: {
                id:                    true,
                nameTh:                true,
                category:              true,
                memberPrice:           true,
                memberDiscountPercent: true,
              },
            },
          },
          orderBy: [{ service: { category: "asc" } }],
        })
      : Promise.resolve([]),
    prisma.serviceAddon.findMany({
      where:  { isActive: true },
      select: { id: true, nameTh: true, price: true },
      orderBy: { price: "asc" },
    }),
  ]);

  return (
    <MobilePos
      branches={branches}
      activeBranchId={activeBranchId}
      branchServices={branchServices}
      addons={addons}
      prefillBooking={prefillBooking}
    />
  );
}
