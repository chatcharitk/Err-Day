import DeskFrame from "@/components/admin/DeskFrame";
import InboxPage from "../../m/inbox/page";

export const dynamic  = "force-dynamic";
export const metadata = { title: "แชทลูกค้า — err.day" };

export default function DesktopInboxPage() {
  return <DeskFrame width={720}><InboxPage /></DeskFrame>;
}
