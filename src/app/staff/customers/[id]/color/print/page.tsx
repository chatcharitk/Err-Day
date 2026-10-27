import { redirect } from "next/navigation";
import { getCurrentStaff } from "@/lib/staff-auth";
import { ColorPrintView } from "@/components/color/views";

export const dynamic  = "force-dynamic";
export const metadata = { title: "การ์ดสีผม A4 — err.day" };

export default async function ColorPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getCurrentStaff();
  if (!me) redirect("/staff/login");
  return <ColorPrintView customerId={id} base={`/staff/customers/${id}/color`} />;
}
