import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/admin-auth";
import AutoRefresh from "../AutoRefresh";
import Composer from "./Composer";
import type { BookingProposal } from "@/lib/inbox-booking";

export const dynamic = "force-dynamic";
export const metadata = { title: "แชทลูกค้า — err.day" };

const TEXT = "#3B2A24", MUTED = "#A08070", BORDER = "#E8D8CC";

const hhmm = (d: Date) => d.toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" });
const day = (d: Date) => d.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", weekday: "short", day: "numeric", month: "short" });

export default async function MobileInboxThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!await getCurrentAdmin()) redirect(`/admin/login?next=/admin/m/inbox/${id}`);
  const thread = await prisma.inboxThread.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, name: true, nickname: true, phone: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 80 },
      drafts: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!thread) notFound();
  if (thread.unread > 0) await prisma.inboxThread.update({ where: { id }, data: { unread: 0 } });

  const messages = [...thread.messages].reverse();
  const draft = thread.drafts[0] ?? null;
  const name = thread.customer ? (thread.customer.nickname ? `${thread.customer.nickname} · ${thread.customer.name}` : thread.customer.name) : (thread.displayName ?? "ลูกค้า LINE");
  const days = messages.map(m => day(m.createdAt));

  return (
    <div className="flex flex-col min-h-screen">
      <AutoRefresh seconds={draft?.status === "PENDING" ? 4 : 15} />
      <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-3 bg-white" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <Link href="/admin/m/inbox" className="p-1" style={{ color: MUTED }}><ArrowLeft size={18} /></Link>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate" style={{ color: TEXT }}>{name}</p>
          <p className="text-[11px] truncate" style={{ color: MUTED }}>
            {thread.customer ? thread.customer.phone : "ยังไม่ผูกกับลูกค้าในระบบ"} · LINE{thread.displayName ? ` · ${thread.displayName}` : ""}
          </p>
        </div>
        {thread.customer && <Link href={`/admin/m/customers?q=${encodeURIComponent(thread.customer.phone)}`} className="text-xs px-2 py-1 rounded-lg" style={{ border: `1px solid ${BORDER}`, color: TEXT }}>ลูกค้า</Link>}
      </div>

      <div className="flex-1 px-3 py-3 space-y-1.5" style={{ background: "#FBF6F2" }}>
        {messages.map((m, i) => {
          const d = days[i];
          const showDay = i === 0 || d !== days[i - 1];
          const mine = m.direction === "OUT";
          const body = m.kind === "text" ? m.text : m.kind === "sticker" ? "(สติกเกอร์)" : m.kind === "image" ? "(รูปภาพ — ดูใน LINE OA)" : "(ข้อความประเภทอื่น)";
          return (
            <div key={m.id}>
              {showDay && <p className="text-center text-[10px] my-2" style={{ color: MUTED }}>{d}</p>}
              <div className={`flex ${mine ? "justify-end" : "justify-start"} items-end gap-1`}>
                {mine && <span className="text-[9px]" style={{ color: MUTED }}>{hhmm(m.createdAt)}</span>}
                <p className="max-w-[78%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words"
                  style={mine ? { background: "#C7DDF7", color: TEXT } : { background: "white", color: TEXT, border: `1px solid ${BORDER}` }}>
                  {body}
                </p>
                {!mine && <span className="text-[9px]" style={{ color: MUTED }}>{hhmm(m.createdAt)}</span>}
              </div>
            </div>
          );
        })}
        <p className="text-center text-[10px] pt-2" style={{ color: MUTED }}>ข้อความที่ตอบใน LINE OA Manager โดยตรงจะไม่แสดงที่นี่ · ข้อความที่ส่งจากหน้านี้จะขึ้นใน LINE OA ด้วย</p>
      </div>

      <div className="sticky bottom-0 bg-white px-3 py-3" style={{ borderTop: `1px solid ${BORDER}` }}>
        <Composer threadId={thread.id} customerName={name} draft={draft && {
          id: draft.id, status: draft.status, note: draft.note, error: draft.error,
          bubbles: Array.isArray(draft.bubbles) ? (draft.bubbles as string[]) : [],
          booking: (draft.booking as unknown as BookingProposal | null) ?? null, bookingId: draft.bookingId,
        }} />
      </div>
    </div>
  );
}
