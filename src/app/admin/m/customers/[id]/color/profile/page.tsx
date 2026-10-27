import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { ColorProfileView } from "@/components/color/views";

export const dynamic  = "force-dynamic";
export const metadata = { title: "ประวัติก่อนทำสี — err.day" };

export default async function ColorProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!await getCurrentAdmin()) redirect(`/admin/login?next=/admin/m/customers/${id}/color`);
  return <ColorProfileView customerId={id} base={`/admin/m/customers/${id}/color`} />;
}
