import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, createSession } from "@/lib/admin-auth";

/**
 * POST /api/admin/auth/login
 * Body: { username, password }
 * On success: sets the admin_session cookie and returns { ok, user }.
 */
export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();
    if (!username || !password) {
      return NextResponse.json({ error: "Missing credentials" }, { status: 400 });
    }

    const user = await prisma.adminUser.findUnique({
      where: { username: String(username).toLowerCase().trim() },
    });
    if (!user || !user.isActive) {
      return NextResponse.json({ error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" }, { status: 401 });
    }

    const ok = await verifyPassword(String(password), user.password);
    if (!ok) {
      return NextResponse.json({ error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" }, { status: 401 });
    }

    await createSession(user.id);

    return NextResponse.json({
      ok:   true,
      user: { id: user.id, username: user.username, name: user.name, role: user.role },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
