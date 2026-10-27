import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { ColorVisitView } from "@/components/color/views";

export const dynamic  = "force-dynamic";
export const metadata = { title: "บันทึกสี — err.day" };

export default async function ColorVisitPage({ params }: { params: Promise<{ id: string; visitId: string }> }) {
  const { id, visitId } = await params;
  if (!await getCurrentAdmin()) redirect(`/admin/login?next=/admin/m/customers/${id}/color`);
  return <ColorVisitView customerId={id} visitId={visitId} base={`/admin/m/customers/${id}/color`} />;
}
