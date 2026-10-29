import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { isAgentOnline, pingAgent } from "@/lib/print-agent";

/**
 * POST { receiptNumber | receiptId, lang? }  → print that receipt on its branch's printer
 * POST { test: true, branchId }              → test slip
 * The print helper on the branch's computer picks it up within a couple of seconds.
 */
export async function POST(request: Request) {
  const gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (gate instanceof Response) return gate;

  const body = await request.json().catch(() => ({})) as { receiptNumber?: string; receiptId?: string; lang?: string; test?: boolean; branchId?: string };
  const lang = body.lang === "en" ? "en" : "th";

  let branchId: string; let receiptId: string | null = null; let kind = "RECEIPT";
  if (body.test) {
    if (!body.branchId) return NextResponse.json({ error: "เลือกสาขา" }, { status: 400 });
    branchId = body.branchId; kind = "TEST";
  } else {
    const r = await prisma.receipt.findFirst({
      where: body.receiptId ? { id: body.receiptId } : body.receiptNumber ? { number: body.receiptNumber } : { id: "none" },
      select: { id: true, branchId: true },
    });
    if (!r) return NextResponse.json({ error: "ไม่พบใบเสร็จ" }, { status: 404 });
    branchId = r.branchId; receiptId = r.id;
  }

  const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { name: true, printAgentKeyHash: true, printAgentSeenAt: true } });
  if (!branch) return NextResponse.json({ error: "ไม่พบสาขา" }, { status: 404 });
  if (!branch.printAgentKeyHash) {
    return NextResponse.json({ error: `สาขา ${branch.name} ยังไม่ได้ตั้งค่าเครื่องพิมพ์ (ไปที่ ตั้งค่า → เครื่องพิมพ์)` }, { status: 409 });
  }

  // A double tap within a few seconds is one print, not two.
  const dupe = await prisma.printJob.findFirst({
    where: { branchId, receiptId, kind, lang, status: { in: ["PENDING", "PRINTING"] }, createdAt: { gte: new Date(Date.now() - 8000) } },
    select: { id: true },
  });
  const job = dupe ?? await prisma.printJob.create({ data: { branchId, receiptId, kind, lang, requestedBy: gate.name } , select: { id: true } });
  if (!dupe) await pingAgent(branchId);

  return NextResponse.json({ id: job.id, branchName: branch.name, agentOnline: isAgentOnline(branch.printAgentSeenAt) });
}
