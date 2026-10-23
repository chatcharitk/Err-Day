import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";

/**
 * GET /api/admin/inbox/meta-check — which Page the token belongs to, whether
 * this app is subscribed to its messages, the linked Instagram account, and the
 * app's webhook subscriptions. Never returns a token or secret.
 *
 * ?subscribe=1 (re)registers the app's webhooks for the Page and Instagram
 * objects and subscribes the Page — the same as the dashboard buttons, without
 * hunting for them.
 */
export async function GET(request: Request) {
  const gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (gate instanceof Response) return gate;
  const token = process.env.META_PAGE_ACCESS_TOKEN?.trim();
  const appId = process.env.META_APP_ID?.trim();
  const secret = process.env.META_APP_SECRET?.trim();
  const verify = process.env.META_VERIFY_TOKEN?.trim();
  const env = { pageTokenSet: !!token, appSecretSet: !!secret, verifyTokenSet: !!verify, appIdSet: !!appId };
  if (!token) return NextResponse.json({ ...env, error: "META_PAGE_ACCESS_TOKEN is not set" });
  const graph = `https://graph.facebook.com/${process.env.META_GRAPH_VERSION?.trim() || "v23.0"}`;
  const call = async (path: string, accessToken: string, method: "GET" | "POST" = "GET", params: Record<string, string> = {}) => {
    const qs = new URLSearchParams({ ...params, access_token: accessToken });
    const res = await fetch(`${graph}/${path}${path.includes("?") ? "&" : "?"}${qs}`, { method, signal: AbortSignal.timeout(15_000) }).catch(() => null);
    if (!res) return { error: "could not reach Meta" };
    const body = await res.json().catch(() => ({}));
    return res.ok ? body : { error: body?.error?.message ?? `HTTP ${res.status}` };
  };
  const appToken = appId && secret ? `${appId}|${secret}` : null;

  let subscribe: Record<string, unknown> | undefined;
  if (new URL(request.url).searchParams.get("subscribe") === "1") {
    if (!appToken || !verify) {
      subscribe = { error: "META_APP_ID, META_APP_SECRET and META_VERIFY_TOKEN must be set" };
    } else {
      const callback_url = `${new URL(request.url).origin}/api/meta/webhook`;
      const [pageHook, igHook] = await Promise.all([
        call(`${appId}/subscriptions`, appToken, "POST", { object: "page", callback_url, verify_token: verify, fields: "messages,message_echoes" }),
        call(`${appId}/subscriptions`, appToken, "POST", { object: "instagram", callback_url, verify_token: verify, fields: "messages" }),
      ]);
      const pageSubscribe = await call("me/subscribed_apps", token, "POST", { subscribed_fields: "messages,message_echoes" });
      subscribe = { pageHook, igHook, pageSubscribe };
    }
  }

  const [page, subscribedApps, instagram, appWebhooks] = await Promise.all([
    call("me?fields=id,name", token),
    call("me/subscribed_apps", token),
    call("me?fields=instagram_business_account{id,username}", token),
    appToken ? call(`${appId}/subscriptions`, appToken) : Promise.resolve({ error: "META_APP_ID not set" }),
  ]);
  return NextResponse.json({ ...env, ...(subscribe ? { subscribe } : {}), page, subscribedApps, instagram, appWebhooks });
}
