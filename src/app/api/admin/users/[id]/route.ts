import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, requireOwner } from "@/lib/admin-auth";

type Params = { params: Promise<{ id: string }> };

/**
 * PATCH /api/admin/users/[id] — update name / role / isActive / password (OWNER only).
 * Body: { name?, role?, isActive?, password? }
 *
 * Refuses to lock out the last OWNER (de-activating self / demoting last OWNER).
 */
export async function PATCH(request: Request, { params }: Params) {
  try {
    const me = await requireOwner();
    const { id } = await params;
    const body = await request.json();
    const { name, role, isActive, password } = body;

    const target = await prisma.adminUser.findUnique({ where: { id } });
    if (!target) return NextResponse.json({ error: "ไม่พบผู้ใช้" }, { status: 404 });

    // Lock-out guard: if demoting last OWNER or deactivating last OWNER, reject
    const wouldRemoveOwner =
      target.role === "OWNER" &&
      ((role !== undefined && role !== "OWNER") || isActive === false);

    if (wouldRemoveOwner) {
      const otherOwners = await prisma.adminUser.count({
        where: { role: "OWNER", isActive: true, id: { not: id } },
      });
      if (otherOwners === 0) {
        return NextResponse.json(
          { error: "ต้องมี OWNER อย่างน้อย 1 คนในระบบ" },
          { status: 400 },
        );
      }
    }

    // OWNER deactivating themselves while no other OWNER would be confusing — guard
    if (id === me.id && isActive === false) {
      return NextResponse.json(
        { error: "ไม่สามารถระงับบัญชีของตัวเองได้" },
        { status: 400 },
      );
    }

    const updated = await prisma.adminUser.update({
      where: { id },
      data: {
        ...(name     !== undefined ? { name: String(name).trim() }                       : {}),
        ...(role     !== undefined ? { role: role === "OWNER" ? "OWNER" : "ADMIN" }     : {}),
        ...(isActive !== undefined ? { isActive: !!isActive }                            : {}),
        ...(password ? { password: await hashPassword(String(password)) }                : {}),
      },
      select: { id: true, username: true, name: true, role: true, isActive: true },
    });

    // If we just deactivated a user, revoke all their active sessions
    if (isActive === false) {
      await prisma.adminSession.deleteMany({ where: { userId: id } });
    }
    // If we just changed their password, revoke all sessions except current
    if (password) {
      await prisma.adminSession.deleteMany({ where: { userId: id } });
    }

    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof Response) return e;
    console.error(e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/users/[id] — soft-delete by setting isActive=false (OWNER only).
 * Same lock-out guard as PATCH.
 */
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const me = await requireOwner();
    const { id } = await params;

    if (id === me.id) {
      return NextResponse.json({ error: "ไม่สามารถลบบัญชีของตัวเองได้" }, { status: 400 });
    }

    const target = await prisma.adminUser.findUnique({ where: { id } });
    if (!target) return NextResponse.json({ error: "ไม่พบผู้ใช้" }, { status: 404 });

    if (target.role === "OWNER") {
      const otherOwners = await prisma.adminUser.count({
        where: { role: "OWNER", isActive: true, id: { not: id } },
      });
      if (otherOwners === 0) {
        return NextResponse.json({ error: "ต้องมี OWNER อย่างน้อย 1 คน" }, { status: 400 });
      }
    }

    await prisma.adminUser.update({ where: { id }, data: { isActive: false } });
    await prisma.adminSession.deleteMany({ where: { userId: id } });

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error(e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
