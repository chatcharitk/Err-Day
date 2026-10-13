import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { phoneDigits } from "@/lib/staff-person";
import {
  verifyPin, signSession, STAFF_COOKIE,
  isLocked, recordFailedAttempt, clearFailedAttempts,
} from "@/lib/staff-auth";

export async function POST(request: Request) {
  const { phone, pin } = await request.json();

  if (typeof phone !== "string" || typeof pin !== "string") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const cleanPhone = phone.trim();
  if (!cleanPhone || !/^\d{4}$/.test(pin)) {
    return NextResponse.json({ error: "เบอร์โทรหรือ PIN ไม่ถูกต้อง" }, { status: 400 });
  }

  if (isLocked(cleanPhone)) {
    return NextResponse.json(
      { error: "ลองผิดเกินกำหนด — โปรดรอสักครู่แล้วลองใหม่" },
      { status: 429 },
    );
  }

  // Match on digits so "082-562-2962" and "0825622962" are the same number, and
  // try every active row of that person (one per branch) — the PIN may have
  // been set on either row.
  const digits = phoneDigits(cleanPhone);
  const rows = digits.length < 9 ? [] : (await prisma.staff.findMany({
    where:  { isActive: true, phone: { not: null } },
    select: { id: true, phone: true, passcodeHash: true },
  })).filter(r => phoneDigits(r.phone) === digits && r.passcodeHash);
  let staff: { id: string } | null = null;
  for (const r of rows) {
    if (await verifyPin(pin, r.passcodeHash!)) { staff = r; break; }
  }

  // Generic message for both "not found" and "wrong PIN" — don't leak which.
  if (!staff) {
    recordFailedAttempt(cleanPhone);
    return NextResponse.json({ error: "เบอร์โทรหรือ PIN ไม่ถูกต้อง" }, { status: 401 });
  }

  clearFailedAttempts(cleanPhone);

  const exp   = Math.floor(Date.now() / 1000) + STAFF_COOKIE.maxAge;
  const token = signSession({ staffId: staff.id, exp });

  // Fire-and-forget — don't block the response on the audit write
  void prisma.staff.update({ where: { id: staff.id }, data: { lastLoginAt: new Date() } }).catch(() => {});

  const res = NextResponse.json({ ok: true });
  res.cookies.set(STAFF_COOKIE.name, token, {
    httpOnly: STAFF_COOKIE.httpOnly,
    sameSite: STAFF_COOKIE.sameSite,
    secure:   STAFF_COOKIE.secure,
    path:     STAFF_COOKIE.path,
    maxAge:   STAFF_COOKIE.maxAge,
  });
  return res;
}
