import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { VOTE_EVENT } from "@/lib/staff-vote";
import MobileVotes from "./MobileVotes";

export const dynamic = "force-dynamic";
export const metadata = { title: "โหวตพนักงาน — err.day" };

export default async function MobileVotesPage() {
  const [candidates, counts, votes] = await Promise.all([
    prisma.voteCandidate.findMany({
      where: { eventKey: VOTE_EVENT.key },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, photoUrl: true, isActive: true },
    }),
    prisma.staffVote.groupBy({ by: ["candidateId"], where: { eventKey: VOTE_EVENT.key }, _count: { _all: true } }),
    prisma.staffVote.findMany({
      where: { eventKey: VOTE_EVENT.key },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true, createdAt: true, voterName: true,
        candidate: { select: { name: true } },
        customer: { select: { name: true, nickname: true } },
      },
    }),
  ]);
  const byId = new Map(counts.map(c => [c.candidateId, c._count._all]));
  return (
    <div>
      <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-3 bg-white" style={{ borderBottom: "1px solid #E8D8CC" }}>
        <Link href="/admin/m" className="p-1" style={{ color: "#A08070" }}><ArrowLeft size={18} /></Link>
        <p className="font-medium" style={{ color: "#3B2A24" }}>โหวตพนักงาน</p>
      </div>
      <MobileVotes
        title={VOTE_EVENT.titleTh}
        candidates={candidates.filter(c => c.isActive || (byId.get(c.id) ?? 0) > 0).map(c => ({ id: c.id, name: c.name, photoUrl: c.photoUrl, votes: byId.get(c.id) ?? 0 }))}
        log={votes.map(v => ({
          id: v.id, at: v.createdAt.toISOString(), candidate: v.candidate.name,
          voter: v.customer ? v.customer.nickname || v.customer.name : v.voterName || "ผู้ใช้ LINE",
        }))}
      />
    </div>
  );
}
