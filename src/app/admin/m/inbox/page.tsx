import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { lineQuota } from "@/lib/inbox";
import AutoRefresh from "./AutoRefresh";

export const dynamic = "force-dynamic";
export const metadata = { title: "แชทลูกค้า — err.day" };

const TEXT = "#3B2A24", MUTED = "#A08070", BORDER = "#E8D8CC", WINE = "#8B1D24";

function ago(d: Date) {
  const min = Math.round((Date.now() - d.getTime()) / 60_000);
  if (min < 1) return "เมื่อกี้";
  if (min < 60) return `${min} นาที`;
  if (min < 24 * 60) return `${Math.round(min / 60)} ชม.`;
  return `${Math.round(min / 1440)} วัน`;
}

export default async function MobileInboxPage() {
  if (!await getCurrentAdmin()) redirect("/admin/login?next=/admin/m/inbox");
  const quotaP = lineQuota();
  const threads = await prisma.inboxThread.findMany({
    orderBy: { lastMessageAt: "desc" }, take: 60,
    include: {
      customer: { select: { name: true, nickname: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { direction: true, kind: true, text: true } },
      drafts: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true } },
    },
  });
  const quota = await quotaP;
  const pct = quota?.limit ? quota.used / quota.limit : 0;
  return (
    <div>
      <AutoRefresh seconds={20} />
      <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-3 bg-white" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <Link href="/admin/m" className="p-1" style={{ color: MUTED }}><ArrowLeft size={18} /></Link>
        <p className="font-medium flex-1" style={{ color: TEXT }}>แชทลูกค้า · AI ช่วยร่าง</p>
        <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: "#FEF3C7", color: "#92400E" }}>ทดลอง</span>
      </div>
      {quota && (
        <div className="px-4 py-2 text-[11px] flex items-center gap-2" style={{ borderBottom: `1px solid ${BORDER}`, color: pct > 0.9 ? "#B91C1C" : MUTED }}>
          <span className="shrink-0">โควตา LINE เดือนนี้</span>
          {quota.limit && (
            <span className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "#F3E8E0" }}>
              <span className="block h-full" style={{ width: `${Math.min(100, pct * 100)}%`, background: pct > 0.9 ? "#B91C1C" : pct > 0.75 ? "#D97706" : "#06C755" }} />
            </span>
          )}
          <span className="shrink-0 font-semibold">{quota.used.toLocaleString()}{quota.limit ? ` / ${quota.limit.toLocaleString()}` : ""}</span>
        </div>
      )}
      {threads.length === 0 && (
        <p className="p-6 text-sm text-center" style={{ color: MUTED }}>ยังไม่มีข้อความ — ข้อความ LINE ใหม่จากลูกค้าจะขึ้นที่นี่</p>
      )}
      <ul>
        {threads.map(t => {
          const name = t.customer ? (t.customer.nickname ? `${t.customer.nickname} · ${t.customer.name}` : t.customer.name) : (t.displayName ?? "ลูกค้า LINE");
          const last = t.messages[0];
          const preview = !last ? "" : `${last.direction === "OUT" ? "แอดมิน: " : ""}${last.kind === "text" ? last.text : last.kind === "sticker" ? "(สติกเกอร์)" : last.kind === "image" ? "(รูปภาพ)" : "(ข้อความ)"}`;
          const draft = t.drafts[0]?.status;
          return (
            <li key={t.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
              <Link href={`/admin/m/inbox/${t.id}`} className="flex items-center gap-3 px-4 py-3">
                {t.pictureUrl
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={t.pictureUrl} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                  : <div className="w-10 h-10 rounded-full shrink-0" style={{ background: "#F3E8E0" }} />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm truncate ${t.unread ? "font-bold" : "font-medium"}`} style={{ color: TEXT }}>{name}</p>
                    {!t.customer && <span className="text-[10px] shrink-0" style={{ color: MUTED }}>ไม่พบในระบบ</span>}
                  </div>
                  <p className="text-xs truncate" style={{ color: MUTED }}>{preview}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="text-[10px]" style={{ color: MUTED }}>{ago(t.lastMessageAt)}</span>
                  {t.unread > 0 && <span className="text-[10px] font-bold text-white px-1.5 rounded-full" style={{ background: WINE }}>{t.unread}</span>}
                  {draft === "READY" && t.unread > 0 && <span className="text-[10px]" style={{ color: "#166534" }}>✨ ร่างพร้อม</span>}
                  {draft === "PENDING" && <span className="text-[10px]" style={{ color: MUTED }}>กำลังร่าง…</span>}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
