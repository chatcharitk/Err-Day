/**
 * Module-level LIFF singleton.
 *
 * `liff.init()` is expensive on Android LINE WebView (1–3 s each call).
 * This module ensures it is called exactly once per page lifetime.
 * Because JS modules are singletons in the browser, the resolved promise
 * survives client-side navigations (router.replace / router.push) and is
 * reused immediately by any subsequent caller.
 */

import type { Liff } from "@line/liff";

let _promise: Promise<Liff> | null = null;

export function getLiff(): Promise<Liff> {
  if (_promise) return _promise;

  const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
  if (!liffId) return Promise.reject(new Error("NEXT_PUBLIC_LIFF_ID is not set"));

  _promise = import("@line/liff").then(async ({ default: liff }) => {
    await liff.init({ liffId });
    return liff;
  }).catch(err => {
    _promise = null; // allow retry on transient network errors
    throw err;
  });

  return _promise;
}
