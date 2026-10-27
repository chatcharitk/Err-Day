import { redirect } from "next/navigation";
import { getCurrentStaff } from "@/lib/staff-auth";
import { ColorVisitView } from "@/components/color/views";

export const dynamic  = "force-dynamic";
export const metadata = { title: "บันทึกสี — err.day" };

export default async function ColorVisitPage({ params }: { params: Promise<{ id: string; visitId: string }> }) {
  const { id, visitId } = await params;
  const me = await getCurrentStaff();
  if (!me) redirect("/staff/login");
  return <ColorVisitView customerId={id} visitId={visitId} base={`/staff/customers/${id}/color`} />;
}
