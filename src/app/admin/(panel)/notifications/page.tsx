import { prisma } from "@/lib/prisma";
import NotificationsView from "./NotificationsView";

export const dynamic   = "force-dynamic";
export const metadata  = { title: "การแจ้งเตือน — err.day" };

export default async function NotificationsPage() {
  const logs = await prisma.notificationLog.findMany({
    orderBy: { sentAt: "desc" },
    take: 100,
  });

  // Stats for the last 7 days
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recent = await prisma.notificationLog.findMany({
    where:  { sentAt: { gte: since } },
    select: { status: true, kind: true },
  });
  const stats = {
    total:   recent.length,
    sent:    recent.filter((r) => r.status === "SENT").length,
    skipped: recent.filter((r) => r.status === "SKIPPED").length,
    failed:  recent.filter((r) => r.status === "FAILED").length,
  };

  // Non-followers: customers with lineUserId whose pushes hit "Failed to send messages"
  // (LINE API rejects pushes to users who haven't added the OA as a friend).
  const failed = await prisma.notificationLog.findMany({
    where: {
      status:    "FAILED",
      sentAt:    { gte: since },
      recipient: { not: null },
      error:     { contains: "Failed to send messages" },
    },
    select: { recipient: true, error: true, sentAt: true, kind: true },
    orderBy: { sentAt: "desc" },
  });

  // Group by lineUserId, keep the most recent failure per user
  const byUid = new Map<string, { lineUserId: string; lastError: string; lastAt: string; lastKind: string; count: number }>();
  for (const r of failed) {
    const uid = r.recipient!;
    const existing = byUid.get(uid);
    if (existing) {
      existing.count += 1;
    } else {
      byUid.set(uid, {
        lineUserId: uid,
        lastError:  r.error ?? "",
        lastAt:     r.sentAt.toISOString(),
        lastKind:   r.kind,
        count:      1,
      });
    }
  }

  // Look up customer names for these lineUserIds
  const uids = Array.from(byUid.keys());
  const customers = uids.length === 0 ? [] : await prisma.customer.findMany({
    where:  { lineUserId: { in: uids } },
    select: { id: true, name: true, nickname: true, phone: true, lineUserId: true },
  });
  const cMap = new Map(customers.map(c => [c.lineUserId!, c]));

  const nonFollowers = Array.from(byUid.values())
    .map(f => {
      const c = cMap.get(f.lineUserId);
      return {
        ...f,
        customerId: c?.id ?? null,
        name:       c?.name ?? "—",
        nickname:   c?.nickname ?? null,
        phone:      c?.phone ?? null,
      };
    })
    .sort((a, b) => b.lastAt.localeCompare(a.lastAt));

  return (
    <NotificationsView
      logs={logs.map((l) => ({
        id:        l.id,
        kind:      l.kind,
        targetId:  l.targetId,
        channel:   l.channel,
        status:    l.status,
        recipient: l.recipient,
        error:     l.error,
        sentAt:    l.sentAt.toISOString(),
      }))}
      stats={stats}
      nonFollowers={nonFollowers}
    />
  );
}
