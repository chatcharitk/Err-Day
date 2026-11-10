import DeskFrame from "@/components/admin/DeskFrame";
import CustomerDetailPage from "../../../m/customers/[id]/page";

// Desktop shell over the phone customer screen — photos, membership/packages,
// hair-colour record, merge duplicates, booking history.
export const revalidate = 30;
export const metadata = { title: "ข้อมูลลูกค้า — err.day" };

export default function DesktopCustomerPage(props: { params: Promise<{ id: string }> }) {
  return <DeskFrame><CustomerDetailPage {...props} /></DeskFrame>;
}
