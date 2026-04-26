"use client";

import { useEffect } from "react";

/**
 * Initializes the LIFF SDK on every page and handles the OAuth redirect.
 *
 * After Line OAuth, the user is redirected to:
 *   https://book.err-daysalon.com/?liff.state=/book/branch-xxx&code=...
 *
 * This component:
 *   1. Runs `liff.init()` to exchange the auth code for tokens (stored in
 *      localStorage so they persist across page loads).
 *   2. Reads the `liff.state` query parameter and explicitly navigates the
 *      user to that path using a hard redirect.  We do this manually because
 *      LIFF SDK's built-in auto-redirect doesn't always fire correctly
 *      inside a Next.js App Router context.
 */
export function LiffProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
    if (!liffId) return;

    import("@line/liff").then(async ({ default: liff }) => {
      try {
        await liff.init({ liffId });

        // After OAuth, Line sends users to the LIFF endpoint URL with a
        // `liff.state` query param holding the original path the user came
        // from.  Read it and navigate the user back there.
        const params    = new URLSearchParams(window.location.search);
        const liffState = params.get("liff.state");

        if (liffState) {
          const targetPath = liffState.startsWith("/") ? liffState : `/${liffState}`;
          if (window.location.pathname + window.location.search !== targetPath) {
            window.location.replace(targetPath);
          }
        }
      } catch (err) {
        console.error("LIFF init failed:", err);
      }
    });
  }, []);

  return <>{children}</>;
}
