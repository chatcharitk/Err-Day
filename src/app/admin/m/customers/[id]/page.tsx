import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { findCustomerPackagesForAdmin } from "@/lib/packages";
import CustomerDetail from "./CustomerDetail";

export const revalidate = 30;

export default async function MobileCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const customer = await prisma.customer.findUnique({
    where: { id },
    select: {
      id:         true,
      name:       true,
      nickname:   true,
      phone:      true,
      email:      true,
      gender:      true,
      dateOfBirth: true,
      lineUserId:  true,
      pictureUrl: true,
      notes:      true,
      photoUrls:  true,
      createdAt:  true,
      membership: {
        select: {
          id:                true,
          label:             true,
          activatedAt:       true,
          expiresAt:         true,
          usagesUsed:        true,
          usagesAllowed:     true,
          pendingActivation: true,
        },
      },
      membershipCycles: {
        orderBy: { startedAt: "desc" },
        take: 24,
        select: {
          id:            true,
          startedAt:     true,
          endedAt:       true,
          closedAt:      true,
          paidAmount:    true,
          paymentMethod: true,
          bookingsUsed:  true,
          notes:         true,
        },
      },
      _count: { select: { bookings: true } },
    },
  });

  if (!customer) notFound();

  const packages = await findCustomerPackagesForAdmin(id);

  // Recent bookings (last 5)
  const recentBookings = await prisma.booking.findMany({
    where:   { customerId: id },
    orderBy: { date: "desc" },
    take:    5,
    select: {
      id:         true,
      date:       true,
      startTime:  true,
      endTime:    true,
      status:     true,
      totalPrice: true,
      branch:     { select: { name: true } },
      service:    { select: { nameTh: true } },
    },
  });

  return (
    <CustomerDetail
      customer={{
        id:         customer.id,
        name:       customer.name,
        nickname:   customer.nickname,
        phone:      customer.phone,
        email:      customer.email,
        gender:      customer.gender,
        dateOfBirth: customer.dateOfBirth?.toISOString() ?? null,
        lineUserId:  customer.lineUserId,
        pictureUrl: customer.pictureUrl,
        notes:      customer.notes ?? null,
        photoUrls:  customer.photoUrls ?? null,
        bookingsCount: customer._count.bookings,
        membership: customer.membership ? {
          ...customer.membership,
          activatedAt: customer.membership.activatedAt.toISOString(),
          expiresAt:   customer.membership.expiresAt?.toISOString() ?? null,
        } : null,
        membershipCycles: customer.membershipCycles.map(cy => ({
          id:            cy.id,
          startedAt:     cy.startedAt.toISOString(),
          endedAt:       cy.endedAt.toISOString(),
          closedAt:      cy.closedAt?.toISOString() ?? null,
          paidAmount:    cy.paidAmount,
          paymentMethod: cy.paymentMethod,
          bookingsUsed:  cy.bookingsUsed,
          notes:         cy.notes,
        })),
        packages: packages.map(p => ({
          id:                p.id,
          sku:               p.packageSku,
          nameTh:            p.spec.nameTh,
          startedAt:         p.startedAt.toISOString(),
          expiresAt:         p.expiresAt.toISOString(),
          usagesUsed:        p.usagesUsed,
          usageLimit:        p.usageLimit,
          usagesLeft:        p.usagesLeft,
          pendingActivation: p.pendingActivation,
        })),
        recentBookings: recentBookings.map(b => ({
          id:         b.id,
          date:       b.date.toISOString(),
          startTime:  b.startTime,
          endTime:    b.endTime,
          status:     b.status,
          totalPrice: b.totalPrice,
          branchName: b.branch.name,
          serviceName: b.service.nameTh,
        })),
      }}
    />
  );
}
