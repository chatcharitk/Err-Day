import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

const username = "admin";
const password = "errday";

async function main() {
  const hash = await bcrypt.hash(password, 10);
  const existing = await prisma.adminUser.findUnique({ where: { username } });

  if (existing) {
    await prisma.adminUser.update({
      where: { username },
      data:  { password: hash, isActive: true, role: "OWNER", name: "Owner" },
    });
    console.log("✓ Updated admin user:", username);
  } else {
    await prisma.adminUser.create({
      data: { username, password: hash, name: "Owner", role: "OWNER" },
    });
    console.log("✓ Created admin user:", username);
  }
  console.log("  Login: " + username + " / " + password);
}

main().finally(() => prisma.$disconnect());
