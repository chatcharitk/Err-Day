import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, requireOwner } from "@/lib/admin-auth";

/**
 * GET /api/admin/users — list all admin users (OWNER only).
 */
export async function GET() {
  try {
    await requireOwner();
    const users = await prisma.adminUser.findMany({
      orderBy: [{ isActive: "desc" }, { role: "asc" }, { username: "asc" }],
      select: {
        id: true, username: true, name: true, role: true,
        isActive: true, createdAt: true, updatedAt: true,
      },
    });
    return NextResponse.json(users);
  } catch (e) {
    if (e instanceof Response) return e;
    console.error(e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

/**
 * POST /api/admin/users — create a new admin user (OWNER only).
 * Body: { username, password, name, role }
 */
export async function POST(request: Request) {
  try {
    await requireOwner();
    const { username, password, name, role } = await request.json();

    if (!username?.trim()) return NextResponse.json({ error: "ต้องระบุชื่อผู้ใช้" }, { status: 400 });
    if (!password?.trim()) return NextResponse.json({ error: "ต้องระบุรหัสผ่าน" }, { status: 400 });
    if (!name?.trim())     return NextResponse.json({ error: "ต้องระบุชื่อ" }, { status: 400 });
    if (password.length < 4) return NextResponse.json({ error: "รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร" }, { status: 400 });

    const cleanUsername = String(username).toLowerCase().trim();
    const exists = await prisma.adminUser.findUnique({ where: { username: cleanUsername } });
    if (exists) return NextResponse.json({ error: "ชื่อผู้ใช้นี้มีอยู่แล้ว" }, { status: 409 });

    const user = await prisma.adminUser.create({
      data: {
        username: cleanUsername,
        password: await hashPassword(password),
        name:     String(name).trim(),
        role:     role === "OWNER" ? "OWNER" : "ADMIN",
      },
      select: { id: true, username: true, name: true, role: true, isActive: true },
    });
    return NextResponse.json(user);
  } catch (e) {
    if (e instanceof Response) return e;
    console.error(e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
