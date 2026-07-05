/**
 * Current PDPA policy version. Bump this string whenever the privacy
 * policy meaningfully changes — that way we know which version each
 * customer's consent was given against.
 */
export const PDPA_VERSION = "2026-07-05"; // added วันเกิด to collected-data categories

/** Allowed values for `Customer.pdpaSource`. */
export type PdpaSource = "signup" | "booking" | "staff" | "liff";
