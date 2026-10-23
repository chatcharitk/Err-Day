import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { anthropicHeaders } from "@/lib/anthropic";

/** GET /api/admin/ai/health — does the Anthropic key work? (never returns the key) */
export async function GET() {
  const gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (gate instanceof Response) return gate;
  const headers = anthropicHeaders();
  const env = { keySet: !!headers, workspaceSet: !!process.env.ANTHROPIC_WORKSPACE_ID?.trim() };
  if (!headers) return NextResponse.json({ ok: false, ...env, error: "ANTHROPIC_API_KEY is not set" });
  const res = await fetch("https://api.anthropic.com/v1/models?limit=5", { headers, signal: AbortSignal.timeout(10_000) }).catch(() => null);
  if (!res) return NextResponse.json({ ok: false, ...env, error: "could not reach Anthropic" });
  const body = await res.json().catch(() => ({}));
  return NextResponse.json(res.ok
    ? { ok: true, ...env, models: (body.data ?? []).map((m: { id: string }) => m.id) }
    : { ok: false, ...env, status: res.status, error: body?.error?.message ?? "rejected" });
}
