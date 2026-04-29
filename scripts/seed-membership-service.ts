import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import "dotenv/config";

neonConfig.webSocketConstructor = ws;
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const svc = await prisma.service.upsert({
    where: { id: "svc-membership-30d" },
    update: {
      name: "Membership 30 days",
      nameTh: "สมาชิก 30 วัน",
      category: "Membership",
      isActive: true,
      memberPrice: null,
      memberDiscountPercent: 0,
    },
    create: {
      id: "svc-membership-30d",
      name: "Membership 30 days",
      nameTh: "สมาชิก 30 วัน",
      category: "Membership",
      isActive: true,
    },
  });
  console.log("✓ Service:", svc.id, svc.nameTh);

  const branches = await prisma.branch.findMany({ where: { isActive: true } });
  for (const b of branches) {
    await prisma.branchService.upsert({
      where: { branchId_serviceId: { branchId: b.id, serviceId: svc.id } },
      update: { price: 99000, duration: 5, isActive: true },
      create: { branchId: b.id, serviceId: svc.id, price: 99000, duration: 5, isActive: true },
    });
    console.log("  ↳ Priced at", b.name);
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
