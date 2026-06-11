import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { pushText } from "@/lib/line-messaging";

const STAFF_LINE_IDS = [
  "U91a73dcc35c56adc217c8afc361265ce", // Looklipair
  "U2548106b79ded01779f134727dc373d3", // Chatcharit
];

async function fetchProfile(userId: string) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN?.trim();
  if (!token) return { error: "no_token" };
  const res = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    return { error: `${res.status} ${txt.slice(0, 200)}` };
  }
  const data = await res.json();
  return { displayName: data.displayName, pictureUrl: data.pictureUrl };
}

// GET /api/admin/test-notify — push test message AND check profile validity
export async function GET() {
  const _gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (_gate instanceof Response) return _gate;

  const results = await Promise.all(
    STAFF_LINE_IDS.map(async (uid) => {
      const [profile, push] = await Promise.all([
        fetchProfile(uid),
        pushText(uid, "🔔 ทดสอบการแจ้งเตือน err·day — ระบบทำงานปกติ"),
      ]);
      return { uid, profile, push: { ok: push.ok, error: push.error ?? null } };
    })
  );
  return NextResponse.json({ results });
}
