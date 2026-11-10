import DeskFrame from "@/components/admin/DeskFrame";
import BookingDetailPage from "../../../m/[id]/page";

// Desktop shell over the phone booking screen — same actions (slips, receipt,
// add-ons, discount, payment), links mapped to desktop by useAdminHref.
export const revalidate = 30;
export const metadata = { title: "รายละเอียดการจอง — err.day" };

export default function DesktopBookingPage(props: { params: Promise<{ id: string }> }) {
  return <DeskFrame><BookingDetailPage {...props} /></DeskFrame>;
}
