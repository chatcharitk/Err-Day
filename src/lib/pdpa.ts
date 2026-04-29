/**
 * Current PDPA policy version. Bump this string whenever the privacy
 * policy meaningfully changes — that way we know which version each
 * customer's consent was given against.
 */
export const PDPA_VERSION = "2025-04-29";

/** Allowed values for `Customer.pdpaSource`. */
export type PdpaSource = "signup" | "booking" | "staff" | "liff";
