import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { VOTE_EVENT } from "@/lib/staff-vote";

/** GET /api/admin/votes[?format=csv] — vote log (who voted for whom, when). */
export async function GET(request: Request) {
  const gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (gate instanceof Response) return gate;

  const votes = await prisma.staffVote.findMany({
    where: { eventKey: VOTE_EVENT.key },
    orderBy: { createdAt: "asc" },
    select: {
      id: true, createdAt: true, voterName: true,
      candidate: { select: { id: true, name: true } },
      customer: { select: { id: true, name: true, nickname: true, phone: true } },
    },
  });

  if (new URL(request.url).searchParams.get("format") === "csv") {
    const bkk = (d: Date) => new Date(d.getTime() + 7 * 3600_000).toISOString().replace("T", " ").slice(0, 19);
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const rows = [["เวลา (เวลาไทย)", "ผู้โหวต", "เบอร์โทร", "โหวตให้"], ...votes.map(v => [bkk(v.createdAt), v.customer?.name ?? v.voterName ?? "ผู้ใช้ LINE", v.customer?.phone ?? "(ไม่ใช่ลูกค้าร้าน)", v.candidate.name])];
    return new Response("﻿" + rows.map(r => r.map(esc).join(",")).join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${VOTE_EVENT.key}-votes.csv"`,
      },
    });
  }
  return NextResponse.json({ votes });
}
