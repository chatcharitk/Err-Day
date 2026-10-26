import type { Metadata } from "next";

/**
 * The chat inbox can be installed as its own Home Screen app: this replaces the
 * root manifest (start_url /admin/m) on inbox pages, so the icon opens the chat.
 */
export const metadata: Metadata = {
  manifest: "/manifests/inbox.webmanifest",
  appleWebApp: { capable: true, title: "แชท err.day", statusBarStyle: "default" },
};

export default function InboxLayout({ children }: { children: React.ReactNode }) {
  return children;
}
