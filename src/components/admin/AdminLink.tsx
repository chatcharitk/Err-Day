"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { useAdminHref } from "@/lib/use-admin-href";

/** next/link for screens shared by the phone and desktop admin: write the
 * phone path, and on desktop it points at the desktop page instead. Usable
 * from server components. */
export default function AdminLink({ href, ...rest }: Omit<ComponentProps<typeof Link>, "href"> & { href: string }) {
  const ah = useAdminHref();
  return <Link href={ah(href)} {...rest} />;
}
