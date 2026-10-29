import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { agentBranch } from "@/lib/print-agent";

/** The print helper reports whether the bytes reached the printer. */
export async function POST(request: Request) {
  const branch = await agentBranch(request);
  if (!branch) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id, ok, error } = await request.json().catch(() => ({})) as { id?: string; ok?: boolean; error?: string };
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  await prisma.printJob.updateMany({
    where: { id, branchId: branch.id, status: "PRINTING" },
    data: ok ? { status: "DONE", printedAt: new Date(), error: null } : { status: "FAILED", error: String(error ?? "ส่งเข้าเครื่องพิมพ์ไม่สำเร็จ").slice(0, 300) },
  });
  return NextResponse.json({ ok: true });
}
