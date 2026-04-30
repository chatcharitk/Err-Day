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
    />
  );
}
