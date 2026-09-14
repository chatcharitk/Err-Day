import { prisma } from "../src/lib/prisma";
import { hash } from "bcryptjs";
export async function seedFinanceFixtures() {
  const url = new URL(process.env.DATABASE_URL!);
  if (
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    url.pathname !== "/errday_finance"
  )
    throw new Error(
      "Fixtures only run on the dedicated LOCAL errday_finance database",
    );
  const branch = await prisma.branch.upsert({
    where: { id: "finance-branch" },
    create: {
      id: "finance-branch",
      name: "err.day สาขาทดสอบ",
      address: "ทดสอบ",
      phone: "0000000000",
    },
    update: {},
  });
  for (const [id, name, normalWorkMinutes, otRateSatang] of [
    ["finance-normal", "วัน", 540, 10000],
    ["finance-porn", "พร", 600, 12000],
  ] as const)
    await prisma.staff.upsert({
      where: { id },
      create: {
        id,
        name,
        branchId: branch.id,
        normalWorkMinutes,
        otRateSatang,
        baseSatang: 1500000,
      },
      update: {},
    });
  for (const [username, role] of [
    ["finance-owner", "OWNER"],
    ["finance-admin", "ADMIN"],
  ] as const)
    await prisma.adminUser.upsert({
      where: { username },
      create: {
        username,
        role,
        name: username,
        password: await hash("local-finance-test-only", 4),
      },
      update: {},
    });
  await prisma.service.upsert({
    where: { id: "finance-service" },
    create: {
      id: "finance-service",
      name: "Haircut",
      nameTh: "ตัดผม",
      category: "hair",
      commissionSatang: 20000,
    },
    update: {},
  });
  await prisma.branchService.upsert({
    where: {
      branchId_serviceId: { branchId: branch.id, serviceId: "finance-service" },
    },
    create: {
      branchId: branch.id,
      serviceId: "finance-service",
      price: 50000,
      duration: 60,
    },
    update: {},
  });
  await prisma.customer.upsert({
    where: { phone: "finance-test-customer" },
    create: {
      id: "finance-customer",
      name: "ลูกค้าทดสอบ",
      phone: "finance-test-customer",
    },
    update: {},
  });
  const date = "2026-09-10";
  for (const [id, staffId, commissionSatang] of [
    ["finance-booking-1", "finance-normal", 20000],
    ["finance-booking-2", "finance-normal", 15000],
    ["finance-booking-3", "finance-porn", 20000],
  ] as const)
    await prisma.booking.upsert({
      where: { id },
      create: {
        id,
        branchId: branch.id,
        staffId,
        customerId: "finance-customer",
        serviceId: "finance-service",
        date: new Date(date + "T12:00:00Z"),
        startTime: id.endsWith("2") ? "14:00" : "11:00",
        endTime: id.endsWith("2") ? "15:00" : "12:00",
        totalPrice: 50000,
        commissionSatang,
        status: "COMPLETED",
      },
      update: {},
    });
  return { branchId: branch.id, date };
}
if (process.argv.includes("--seed"))
  seedFinanceFixtures()
    .then(() => console.log("Local finance fixtures ready"))
    .finally(() => prisma.$disconnect());
