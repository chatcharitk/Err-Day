import DeskFrame from "@/components/admin/DeskFrame";
import InboxThreadPage from "../../../m/inbox/[id]/page";

export const dynamic  = "force-dynamic";
export const metadata = { title: "แชทลูกค้า — err.day" };

export default function DesktopInboxThreadPage(props: { params: Promise<{ id: string }> }) {
  return <DeskFrame width={720}><InboxThreadPage {...props} /></DeskFrame>;
}
