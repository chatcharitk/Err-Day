import CouponsView from "./CouponsView";

export const dynamic = "force-dynamic";
export const metadata = { title: "คูปอง — err.day" };

export default async function CouponsPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c } = await searchParams;
  return <CouponsView selectedId={c} basePath="/admin/coupons" />;
}
