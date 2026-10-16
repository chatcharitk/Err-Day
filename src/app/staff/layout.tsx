import type { Metadata } from "next";

/**
 * The /staff subtree is its own installable web app. Overriding `manifest`
 * here replaces the root admin manifest (start_url /admin/m) for every /staff
 * page, so a staff member's Home Screen icon opens /staff (→ /staff/login when
 * signed out) instead of the admin login.
 */
export const metadata: Metadata = {
  manifest: "/staff/manifest.webmanifest",
  appleWebApp: { capable: true, title: "err.day ทีม", statusBarStyle: "default" },
};

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return children;
}
