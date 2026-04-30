import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/admin-auth";
import UsersManager from "./UsersManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "จัดการผู้ใช้ — err.day" };

export default async function UsersPage() {
  const me = await getCurrentAdmin();
  if (!me) redirect("/admin/login?next=/admin/users");
  if (me.role !== "OWNER") redirect("/admin");

  const users = await prisma.adminUser.findMany({
    orderBy: [{ isActive: "desc" }, { role: "asc" }, { username: "asc" }],
    select: {
      id: true, username: true, name: true, role: true,
      isActive: true, createdAt: true, updatedAt: true,
    },
  });

  return <UsersManager users={users} currentUserId={me.id} />;
}
