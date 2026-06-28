import { redirect } from "next/navigation";
import { getKioskBranch } from "@/lib/kiosk-auth";
import { loadDeskBoard } from "@/lib/desk";
import DeskBoard from "./DeskBoard";

// Cookie-dependent + live booking data — never cache this page.
export const dynamic  = "force-dynamic";
export const metadata = { title: "หน้าร้าน — err.day" };

export default async function DeskPage() {
  const branch = await getKioskBranch();
  if (!branch) redirect("/desk/setup");

  const board = await loadDeskBoard(branch.id);

  return <DeskBoard branchName={branch.name} initial={board} />;
}
