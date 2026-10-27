import { redirect } from "next/navigation";
import { getCurrentStaff } from "@/lib/staff-auth";
import { ColorProfileView } from "@/components/color/views";

export const dynamic  = "force-dynamic";
export const metadata = { title: "ประวัติก่อนทำสี — err.day" };

export default async function ColorProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getCurrentStaff();
  if (!me) redirect("/staff/login");
  return <ColorProfileView customerId={id} base={`/staff/customers/${id}/color`} />;
}
