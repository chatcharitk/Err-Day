import { prisma } from "@/lib/prisma";
import MobileNotifications from "./MobileNotifications";

export const revalidate = 30;
export const metadata   = { title: "การแจ้งเตือน — err.day" };

export default async function MobileNotificationsPage() {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [logs, recent] = await Promise.all([
    prisma.notificationLog.findMany({
      orderBy: { sentAt: "desc" },
      take: 100,
    }),
    prisma.notificationLog.findMany({
      where:  { sentAt: { gte: since } },
      select: { status: true },
    }),
  ]);

  const stats = {
    total:   recent.length,
    sent:    recent.filter(r => r.status === "SENT").length,
    failed:  recent.filter(r => r.status === "FAILED").length,
    skipped: recent.filter(r => r.status === "SKIPPED").length,
  };

  return (
    <MobileNotifications
      logs={logs.map(l => ({
        id:        l.id,
        kind:      l.kind,
        status:    l.status,
        recipient: l.recipient,
        error:     l.error,
        sentAt:    l.sentAt.toISOString(),
      }))}
      stats={stats}
    />
  );
}
