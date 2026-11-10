"use client";

import { usePathname } from "next/navigation";
import { useCallback } from "react";
import { isPhoneAdminPath, toDesktopAdminPath } from "@/lib/admin-paths";

/** Returns a function that maps a phone-form admin link ("/admin/m/…") to the
 * shell the admin is currently in — unchanged on the phone, desktop path on
 * the desktop panel. */
export function useAdminHref(): (path: string) => string {
  const pathname = usePathname() ?? "";
  const phone = isPhoneAdminPath(pathname);
  return useCallback((path: string) => (phone ? path : toDesktopAdminPath(path)), [phone]);
}
