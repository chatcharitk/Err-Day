import { prisma } from "@/lib/prisma";
import { VOTE_EVENT } from "@/lib/staff-vote";
import VotesManager from "./VotesManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "โหวตพนักงาน — err.day" };

export default async function VotesPage() {
  const [candidates, counts, votes] = await Promise.all([
    prisma.voteCandidate.findMany({
      where: { eventKey: VOTE_EVENT.key },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, photoUrl: true, isActive: true, sortOrder: true },
    }),
    prisma.staffVote.groupBy({ by: ["candidateId"], where: { eventKey: VOTE_EVENT.key }, _count: { _all: true } }),
    prisma.staffVote.findMany({
      where: { eventKey: VOTE_EVENT.key },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, createdAt: true,
        candidate: { select: { name: true } },
        customer: { select: { name: true, nickname: true, phone: true } },
      },
    }),
  ]);
  const byId = new Map(counts.map(c => [c.candidateId, c._count._all]));

  return (
    <VotesManager
      event={{ title: VOTE_EVENT.titleTh, from: VOTE_EVENT.from, to: VOTE_EVENT.to }}
      candidates={candidates.map(c => ({ ...c, votes: byId.get(c.id) ?? 0 }))}
      log={votes.map(v => ({
        id: v.id,
        at: v.createdAt.toISOString(),
        candidate: v.candidate.name,
        customer: v.customer.nickname || v.customer.name,
        phone: v.customer.phone,
      }))}
    />
  );
}
