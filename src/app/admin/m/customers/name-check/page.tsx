import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { nameCheckQueue } from "@/lib/customer-name-check";
import NameCheckList from "./NameCheckList";

export const dynamic  = "force-dynamic";
export const metadata = { title: "ตรวจชื่อลูกค้า — err.day" };

export default async function NameCheckPage() {
  if (!await getCurrentAdmin()) redirect("/admin/login?next=/admin/m/customers/name-check");
  return <NameCheckList items={await nameCheckQueue()} />;
}
