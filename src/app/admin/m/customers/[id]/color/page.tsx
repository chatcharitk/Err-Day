import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { ColorCardView } from "@/components/color/views";

export const dynamic  = "force-dynamic";
export const metadata = { title: "การ์ดสีผม — err.day" };

export default async function ColorCardPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ booking?: string }> }) {
  const [{ id }, { booking }] = await Promise.all([params, searchParams]);
  if (!await getCurrentAdmin()) redirect(`/admin/login?next=/admin/m/customers/${id}/color`);
  return <ColorCardView customerId={id} base={`/admin/m/customers/${id}/color`} back={booking ? `/admin/m/${booking}` : `/admin/m/customers/${id}`} bookingId={booking ?? null} defaultBranchId={null} canChooseBranch={true} />;
}
