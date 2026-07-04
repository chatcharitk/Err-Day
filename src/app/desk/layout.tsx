import type { Metadata } from "next";

/**
 * The /desk subtree is its own installable web app (the branch iPad / iMac
 * check-in board). Overriding `manifest` here replaces the root app manifest
 * (start_url /admin/m) for every /desk page, so "Add to Home Screen" from the
 * board installs an app that opens straight back into the board — no admin
 * menus, dashboards or other-branch data on the shared front-desk device.
 */
export const metadata: Metadata = {
  manifest: "/desk/manifest.webmanifest",
  appleWebApp: { capable: true, title: "หน้าร้าน err.day", statusBarStyle: "default" },
};

export default function DeskLayout({ children }: { children: React.ReactNode }) {
  return children;
}
