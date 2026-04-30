import { NextResponse } from "next/server";
import { destroySession } from "@/lib/admin-auth";

/**
 * POST /api/admin/auth/logout
 * Clears the admin_session cookie and deletes the DB session row.
 */
export async function POST() {
  await destroySession();
  return NextResponse.json({ ok: true });
}
