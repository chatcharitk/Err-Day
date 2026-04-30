import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mobile Admin — err.day" };

/**
 * Mobile-admin layout. No sidebar; page-level top-nav handles its own header.
 * Auth: redundant defense in depth (proxy.ts already gates the route).
 */
export default async function MobileAdminLayout({ children }: { children: React.ReactNode }) {
  const me = await getCurrentAdmin();
  if (!me) redirect("/admin/login?next=/admin/m");

  return (
    <div className="min-h-screen" style={{ background: "#FDF7F2" }}>
      {/* Constrain width so this works nicely on desktop too (PWA-style) */}
      <div className="max-w-md mx-auto min-h-screen relative bg-white" style={{ boxShadow: "0 0 24px rgba(0,0,0,0.06)" }}>
        {children}
      </div>
    </div>
  );
}
