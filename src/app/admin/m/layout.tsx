export const metadata = { title: "Mobile Admin — err.day" };

/**
 * Mobile-admin layout. No sidebar; page-level top-nav handles its own header.
 * Auth gating happens upstream in proxy.ts (cookie presence). Skipping a DB
 * round-trip here saves ~100-200ms on every navigation.
 */
export default function MobileAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: "#FDF7F2" }}>
      <div className="max-w-md mx-auto min-h-screen relative bg-white" style={{ boxShadow: "0 0 24px rgba(0,0,0,0.06)" }}>
        {children}
      </div>
    </div>
  );
}
