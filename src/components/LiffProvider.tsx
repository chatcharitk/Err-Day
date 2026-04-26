"use client";

import { useEffect } from "react";

/**
 * Initializes the LIFF SDK on every page.
 *
 * Why this is needed:
 *   When a user logs in with Line via `liff.login()` from a deep page like
 *   /book/[branchId], Line's OAuth flow redirects the user back to the LIFF
 *   "Endpoint URL" configured in the Line console — which is the homepage
 *   (/).  The redirect URL contains `?liff.state=/book/branch-xxx&code=...`
 *   parameters.  The LIFF SDK must run `liff.init()` on this landing page
 *   to (1) exchange the OAuth code for tokens, and (2) navigate the user to
 *   the path stored in `liff.state`.
 *
 *   By placing this provider in the root layout, *every* page in the app
 *   runs `liff.init()` on mount.  Whichever page Line redirects to, the
 *   callback completes successfully and the user lands where they intended.
 */
export function LiffProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
    if (!liffId) return;

    import("@line/liff")
      .then(({ default: liff }) => liff.init({ liffId }))
      .catch((err) => console.error("LIFF init failed:", err));
  }, []);

  return <>{children}</>;
}
