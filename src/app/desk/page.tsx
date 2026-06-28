import { redirect } from "next/navigation";
import { getKioskBranch } from "@/lib/kiosk-auth";
import { loadDeskBoard } from "@/lib/desk";
import { getCachedBranchServices } from "@/lib/branches-cache";
import { SALE_ONLY_SKUS } from "@/lib/capacity";
import DeskBoard from "./DeskBoard";

// Cookie-dependent + live booking data — never cache this page.
export const dynamic  = "force-dynamic";
export const metadata = { title: "หน้าร้าน — err.day" };

export default async function DeskPage() {
  const branch = await getKioskBranch();
  if (!branch) redirect("/desk/setup");

  const [board, services] = await Promise.all([
    loadDeskBoard(branch.id),
    getCachedBranchServices(branch.id),
  ]);

  // Bookable services only (walk-ins can't buy membership/package SKUs).
  const walkinServices = services
    .filter(s => !SALE_ONLY_SKUS.includes(s.id))
    .map(s => ({ id: s.id, nameTh: s.nameTh, price: s.price, duration: s.duration, category: s.category }));

  return <DeskBoard branchName={branch.name} initial={board} services={walkinServices} />;
}
