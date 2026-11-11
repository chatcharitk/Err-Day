import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { sendPackageActivated } from "@/lib/notifications";

/**
 * POST → (re)send the "you've got your package / voucher" LINE card — e.g. the
 * customer wasn't LINE-linked at the sale and has linked since. Sends again
 * even if a card already went out (admin asked for it explicitly).
 */
export async function POST(_req: Request, { params }: { params: Promise<{ pkgId: string }> }) {
  const gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (gate instanceof Response) return gate;
  const { pkgId } = await params;
  const pkg = await prisma.customerPackage.findUnique({ where: { id: pkgId }, select: { id: true } });
  if (!pkg) return NextResponse.json({ error: "not_found" }, { status: 404 });
  // Clear the log row so the sender's once-only guard lets this through.
  await prisma.notificationLog.deleteMany({ where: { kind: "PACKAGE_ACTIVATED", targetId: pkgId } });
  const r = await sendPackageActivated(pkgId);
  return NextResponse.json(r, { status: r.status === "FAILED" ? 502 : 200 });
}
