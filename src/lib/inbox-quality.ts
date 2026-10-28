import { prisma } from "@/lib/prisma";

/** Weekly reply-quality score: of the AI drafts sent from the app, how many went out unchanged. */
export async function draftQuality(days = 7) {
  const since = new Date(Date.now() - days * 86400_000);
  const rows = await prisma.inboxDraft.findMany({
    where: { createdAt: { gte: since }, status: { in: ["USED", "EDITED"] } },
    select: { status: true, feedback: true },
  });
  const used = rows.filter(r => r.status === "USED").length;
  const reasons = new Map<string, number>();
  for (const r of rows) for (const f of r.feedback) reasons.set(f, (reasons.get(f) ?? 0) + 1);
  return {
    sent: rows.length, unchanged: used,
    pct: rows.length ? Math.round((used / rows.length) * 100) : null,
    topReasons: [...reasons].sort((a, b) => b[1] - a[1]).slice(0, 3),
  };
}
