import DeskFrame from "@/components/admin/DeskFrame";
import NameCheckPage from "../../../m/customers/name-check/page";

export const dynamic  = "force-dynamic";
export const metadata = { title: "ตรวจชื่อลูกค้า — err.day" };

export default function DesktopNameCheckPage() {
  return <DeskFrame><NameCheckPage /></DeskFrame>;
}
