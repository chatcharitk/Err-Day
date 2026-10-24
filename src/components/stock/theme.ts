export const PRIMARY = "#8B1D24";
export const TEXT    = "#3B2A24";
export const MUTED   = "#A08070";
export const BORDER  = "#E8D8CC";
export const BG      = "#FDF8F3";
export const LOW     = "#B91C1C";
export const LOW_BG  = "#FEE2E2";
export const OK      = "#166534";

export function label(p: { name: string; brand?: string | null; size?: string | null }) {
  return [p.brand, p.name, p.size].filter(Boolean).join(" · ");
}

export async function postStock(body: Record<string, unknown>): Promise<{ ok: true; [k: string]: unknown } | { ok: false; error: string }> {
  const res = await fetch("/api/stock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  if (!res) return { ok: false, error: "เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง" };
  const j = await res.json().catch(() => ({})) as { error?: string };
  return res.ok ? { ok: true, ...j } : { ok: false, error: j.error || `ผิดพลาด (${res.status})` };
}
