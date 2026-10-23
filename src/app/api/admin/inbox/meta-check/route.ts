import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";

/**
 * GET /api/admin/inbox/meta-check — which Page the token belongs to, whether
 * this app is subscribed to its messages, and the linked Instagram account.
 * Never returns a token.
 */
export async function GET() {
  const gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (gate instanceof Response) return gate;
  const token = process.env.META_PAGE_ACCESS_TOKEN?.trim();
  const env = {
    pageTokenSet: !!token,
    appSecretSet: !!process.env.META_APP_SECRET?.trim(),
    verifyTokenSet: !!process.env.META_VERIFY_TOKEN?.trim(),
  };
  if (!token) return NextResponse.json({ ...env, error: "META_PAGE_ACCESS_TOKEN is not set" });
  const graph = `https://graph.facebook.com/${process.env.META_GRAPH_VERSION?.trim() || "v23.0"}`;
  const get = async (path: string) => {
    const res = await fetch(`${graph}/${path}${path.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(10_000) }).catch(() => null);
    if (!res) return { error: "could not reach Meta" };
    const body = await res.json().catch(() => ({}));
    return res.ok ? body : { error: body?.error?.message ?? `HTTP ${res.status}` };
  };
  const [page, subscribedApps, instagram] = await Promise.all([
    get("me?fields=id,name"),
    get("me/subscribed_apps"),
    get("me?fields=instagram_business_account{id,username}"),
  ]);
  return NextResponse.json({ ...env, page, subscribedApps, instagram });
}
