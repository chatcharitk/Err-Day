import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { agentBranch, JOB_EXPIRE_MS, JOB_STUCK_MS, originOf, signalUrl } from "@/lib/print-agent";
import { buildJobBytes } from "@/lib/receipt-print";

export const maxDuration = 30;

/**
 * Called by the branch's print helper (Authorization: Bearer <key>) when the
 * wake-up file changes and on a timer. Returns the jobs to print, already drawn
 * as printer bytes. Also records that the helper is alive.
 */
export async function POST(request: Request) {
  const branch = await agentBranch(request);
  if (!branch) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({})) as { width?: number };
  const now = Date.now();
  await prisma.branch.update({ where: { id: branch.id }, data: { printAgentSeenAt: new Date(now) } });
  await prisma.printJob.updateMany({ where: { branchId: branch.id, status: "PENDING", createdAt: { lt: new Date(now - JOB_EXPIRE_MS) } }, data: { status: "EXPIRED", error: "ไม่มีใครรับงานภายใน 10 นาที" } });
  await prisma.printJob.updateMany({ where: { branchId: branch.id, status: "PRINTING", claimedAt: { lt: new Date(now - JOB_STUCK_MS) } }, data: { status: "FAILED", error: "ไม่ได้รับผลการพิมพ์" } });

  const pending = await prisma.printJob.findMany({ where: { branchId: branch.id, status: "PENDING" }, orderBy: { createdAt: "asc" }, take: 3 });
  const origin = originOf(request);
  const jobs: { id: string; data: string }[] = [];
  for (const job of pending) {
    // Claim atomically so two helpers (or two polls) never print the same slip.
    const claimed = await prisma.printJob.updateMany({ where: { id: job.id, status: "PENDING" }, data: { status: "PRINTING", claimedAt: new Date() } });
    if (claimed.count !== 1) continue;
    try {
      const bytes = await buildJobBytes(job, origin, Number(body.width) || 576);
      jobs.push({ id: job.id, data: bytes.toString("base64") });
    } catch (e) {
      await prisma.printJob.update({ where: { id: job.id }, data: { status: "FAILED", error: (e instanceof Error ? e.message : String(e)).slice(0, 300) } });
    }
  }
  return NextResponse.json({ branch: branch.name, signalUrl: signalUrl(branch.id), jobs });
}
