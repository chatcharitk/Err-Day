import { NextResponse } from "next/server";
import { STAFF_COOKIE } from "@/lib/staff-auth";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(STAFF_COOKIE.name, "", {
    httpOnly: STAFF_COOKIE.httpOnly,
    sameSite: STAFF_COOKIE.sameSite,
    secure:   STAFF_COOKIE.secure,
    path:     STAFF_COOKIE.path,
    maxAge:   0,
  });
  return res;
}
