"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getLiff } from "@/lib/liff-client";

/**
 * Initializes the LIFF SDK on every page and handles the OAuth redirect.
 *
 * After LINE OAuth the user lands at:
 *   https://book.err-daysalon.com/?liff.state=/liff/membership/signup&code=...
 *
 * What this component does:
 *   1. Calls getLiff() — a module-level singleton so liff.init() runs at most
 *      once per page lifetime (critical for performance on Android LINE WebView).
 *   2. Reads the `liff.state` query param and navigates via router.replace()
 *      (client-side — no full-page reload) so the already-initialized LIFF
 *      instance is preserved in memory for the destination page.
 */
export function LiffProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_LIFF_ID) return;

    getLiff()
      .then(() => {
        const params    = new URLSearchParams(window.location.search);
        const liffState = params.get("liff.state");

        if (liffState) {
          const targetPath = liffState.startsWith("/") ? liffState : `/${liffState}`;
          if (window.location.pathname + window.location.search !== targetPath) {
            // Client-side navigation — preserves the JS module singleton so the
            // destination page gets getLiff() resolved immediately (no re-init).
            router.replace(targetPath);
          }
        }
      })
      .catch(err => console.error("LIFF init failed:", err));
  }, [router]);

  return <>{children}</>;
}
