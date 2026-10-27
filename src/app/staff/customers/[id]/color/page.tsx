import { redirect } from "next/navigation";
import { getCurrentStaff } from "@/lib/staff-auth";
import { ColorCardView } from "@/components/color/views";

export const dynamic  = "force-dynamic";
export const metadata = { title: "การ์ดสีผม — err.day" };

export default async function ColorCardPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ booking?: string }> }) {
  const [{ id }, { booking }] = await Promise.all([params, searchParams]);
  const me = await getCurrentStaff();
  if (!me) redirect("/staff/login");
  return <ColorCardView customerId={id} base={`/staff/customers/${id}/color`} back={booking ? `/staff/bookings/${booking}` : `/staff/customers/${id}`} bookingId={booking ?? null} defaultBranchId={me.branchId} canChooseBranch={false} />;
}
