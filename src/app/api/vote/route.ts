import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyLineAccessToken } from "@/lib/line-auth";
import { VOTE_EVENT, voteDayAt, votePhaseAt } from "@/lib/staff-vote";

/**
 * POST /api/vote  { lineAccessToken, candidateId? }
 *
 * Without candidateId: returns the event state, the candidates (no vote counts —
 * customers must not see a running tally) and the caller's vote for today, if any.
 * With candidateId: casts the vote. Open to anyone signed in with LINE — they
 * don't need to have visited the shop. One vote per LINE account per day; the
 * database unique key is the real guard, the pre-check just gives a clean answer.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { lineAccessToken?: unknown; candidateId?: unknown; preview?: unknown } | null;
  const lineProfile = await verifyLineAccessToken(body?.lineAccessToken);
  if (!lineProfile) {
    return NextResponse.json({ error: "invalid_line_session" }, { status: 401 });
  }

  const customer = await prisma.customer.findUnique({
    where: { lineUserId: lineProfile.userId },
    select: { id: true },
  });
  const phase = votePhaseAt();
  const voteDay = voteDayAt();
  // Before voting opens the roster stays private — only the team's preview
  // (`preview: true`) gets it. Casting a vote is refused until "open" regardless.
  const showRoster = phase === "open" || body?.preview === true;
  const candidates = !showRoster ? [] : await prisma.voteCandidate.findMany({
    where: { eventKey: VOTE_EVENT.key, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, photoUrl: true },
  });
  const existing = await prisma.staffVote.findUnique({
    where: { eventKey_lineUserId_voteDay: { eventKey: VOTE_EVENT.key, lineUserId: lineProfile.userId, voteDay } },
    select: { candidateId: true, createdAt: true },
  });

  const state = {
    event: { key: VOTE_EVENT.key, from: VOTE_EVENT.from, to: VOTE_EVENT.to, phase },
    candidates,
    // Any LINE account may vote; a customer record is attached only when there is one.
    canVote: true,
    myVote: existing ? { candidateId: existing.candidateId, at: existing.createdAt.toISOString() } : null,
  };

  const candidateId = body?.candidateId;
  if (candidateId === undefined) return NextResponse.json(state);

  if (typeof candidateId !== "string" || !candidateId) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  if (phase !== "open") {
    return NextResponse.json(
      { error: "not_open", message: phase === "upcoming" ? "ยังไม่เปิดโหวต เริ่ม 17 ต.ค. 2569" : "ปิดโหวตแล้ว" },
      { status: 403 },
    );
  }
  if (existing) {
    return NextResponse.json({ error: "already_voted", message: "วันนี้คุณโหวตแล้ว โหวตได้วันละ 1 ครั้ง กลับมาโหวตใหม่พรุ่งนี้นะคะ", ...state }, { status: 409 });
  }
  if (!candidates.some(c => c.id === candidateId)) {
    return NextResponse.json({ error: "invalid_candidate", message: "ไม่พบพนักงานที่เลือก" }, { status: 400 });
  }

  try {
    const vote = await prisma.staffVote.create({
      data: {
        eventKey: VOTE_EVENT.key, candidateId, voteDay,
        customerId: customer?.id ?? null,
        lineUserId: lineProfile.userId,
        voterName: lineProfile.displayName?.slice(0, 80) ?? null,
      },
      select: { candidateId: true, createdAt: true },
    });
    return NextResponse.json({ ...state, myVote: { candidateId: vote.candidateId, at: vote.createdAt.toISOString() } }, { status: 201 });
  } catch (e) {
    // Two taps racing: the unique (eventKey, lineUserId, voteDay) rejects the second.
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return NextResponse.json({ error: "already_voted", message: "วันนี้คุณโหวตแล้ว โหวตได้วันละ 1 ครั้ง กลับมาโหวตใหม่พรุ่งนี้นะคะ" }, { status: 409 });
    }
    console.error("[vote]", e);
    return NextResponse.json({ error: "vote_failed", message: "โหวตไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  }
}
