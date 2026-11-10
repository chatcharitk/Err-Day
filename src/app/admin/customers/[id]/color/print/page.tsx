import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { ColorPrintView } from "@/components/color/views";

// Outside the (panel) group on purpose: the A4 print sheet has no sidebar.
export const dynamic  = "force-dynamic";
export const metadata = { title: "พิมพ์การ์ดสีผม — err.day" };

export default async function DesktopColorPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!await getCurrentAdmin()) redirect(`/admin/login?next=/admin/customers/${id}/color`);
  return <ColorPrintView customerId={id} base={`/admin/customers/${id}/color`} />;
}
