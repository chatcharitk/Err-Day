import DeskFrame from "@/components/admin/DeskFrame";
import { ColorCardView } from "@/components/color/views";

export const dynamic  = "force-dynamic";
export const metadata = { title: "การ์ดสีผม — err.day" };

export default async function DesktopColorCardPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ booking?: string }> }) {
  const [{ id }, { booking }] = await Promise.all([params, searchParams]);
  return (
    <DeskFrame>
      <ColorCardView customerId={id} base={`/admin/customers/${id}/color`} back={booking ? `/admin/bookings/${booking}` : `/admin/customers/${id}`} bookingId={booking ?? null} defaultBranchId={null} canChooseBranch={true} />
    </DeskFrame>
  );
}
