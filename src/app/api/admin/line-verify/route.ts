import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";

/**
 * POST /api/admin/line-verify
 * Body: { lineUserId: string }
 * Returns: { ok: true, displayName, pictureUrl } if the user follows the OA,
 *          { ok: false, status, error } if profile lookup fails (404 = not follower).
 */
export async function POST(request: Request) {
  await requireAdmin();
  const { lineUserId } = await request.json();
  if (!lineUserId) return NextResponse.json({ ok: false, error: "missing lineUserId" }, { status: 400 });

  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN?.trim();
  if (!token) return NextResponse.json({ ok: false, error: "no_token" }, { status: 500 });

  const res = await fetch(`https://api.line.me/v2/bot/profile/${lineUserId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    return NextResponse.json({ ok: false, status: res.status, error: txt.slice(0, 200) });
  }
  const data = await res.json();
  return NextResponse.json({ ok: true, displayName: data.displayName, pictureUrl: data.pictureUrl });
}
