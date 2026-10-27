import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { ColorPrintView } from "@/components/color/views";

export const dynamic  = "force-dynamic";
export const metadata = { title: "การ์ดสีผม A4 — err.day" };

export default async function ColorPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!await getCurrentAdmin()) redirect(`/admin/login?next=/admin/m/customers/${id}/color`);
  return <ColorPrintView customerId={id} base={`/admin/m/customers/${id}/color`} />;
}
