import DeskFrame from "@/components/admin/DeskFrame";
import RestockPage from "../../m/restock/page";

export const dynamic  = "force-dynamic";
export const metadata = { title: "ของที่ต้องเติม — err.day" };

export default function DesktopRestockPage() {
  return <DeskFrame><RestockPage /></DeskFrame>;
}
