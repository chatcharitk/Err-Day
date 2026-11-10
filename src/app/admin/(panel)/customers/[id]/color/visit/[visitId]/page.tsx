import DeskFrame from "@/components/admin/DeskFrame";
import { ColorVisitView } from "@/components/color/views";

export const dynamic  = "force-dynamic";
export const metadata = { title: "บันทึกทำสี — err.day" };

export default async function DesktopColorVisitPage({ params }: { params: Promise<{ id: string; visitId: string }> }) {
  const { id, visitId } = await params;
  return <DeskFrame><ColorVisitView customerId={id} visitId={visitId} base={`/admin/customers/${id}/color`} /></DeskFrame>;
}
