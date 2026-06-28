import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { getKioskBranch } from "@/lib/kiosk-auth";
import { prisma } from "@/lib/prisma";
import SetupClient from "./SetupClient";

export const dynamic  = "force-dynamic";
export const metadata = { title: "ตั้งค่าอุปกรณ์หน้าร้าน — err.day" };

/**
 * One-time kiosk arming. The owner logs in (admin) once per device and picks
 * the branch it belongs to; after that `/desk` works with no login.
 */
export default async function DeskSetupPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login?next=/desk/setup");

  const [branches, current] = await Promise.all([
    prisma.branch.findMany({
      where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true },
    }),
    getKioskBranch(),
  ]);

  return <SetupClient branches={branches} currentBranchId={current?.id ?? null} adminName={admin.name} />;
}
