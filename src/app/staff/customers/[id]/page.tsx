import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Phone, StickyNote, Images, History } from "lucide-react";
import { maskPhone } from "@/lib/staff-person";
import { prisma } from "@/lib/prisma";
import { getCurrentStaffPerson } from "@/lib/staff-auth";
import { bangkokTodayKey, bangkokYmdOf } from "@/lib/member-pricing";

export const dynamic  = "force-dynamic";
export const metadata = { title: "ข้อมูลลูกค้า — err.day" };

const PRIMARY = "#8B1D24";
const TEXT    = "#3B2A24";
const MUTED   = "#A08070";
const BORDER  = "#E8D8CC";
const BG      = "#FDF8F3";

const STATUS: Record<string, { label: string; fg: string }> = {
  PENDING:   { label: "รอยืนยัน",  fg: "#9A3412" },
  CONFIRMED: { label: "นัดไว้",     fg: "#1D4ED8" },
  COMPLETED: { label: "มาแล้ว",    fg: "#166534" },
  NO_SHOW:   { label: "ไม่มา",     fg: "#52525B" },
};

/**
 * Customer card for staff (read-only): who they are, the shop's notes, their
 * photos (hair before/after, references they sent in chat) and visit history.
 * Phone stays masked (PDPA) — contact goes through the front desk.
 */
export default async function StaffCustomerPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const me = await getCurrentStaffPerson();
  if (!me) redirect("/staff/login");
  const { id } = await params;
  const { from } = await searchParams;

  const c = await prisma.customer.findUnique({
    where: { id },
    select: {
      id: true, name: true, nickname: true, phone: true, gender: true, pictureUrl: true, notes: true, photoUrls: true,
      membership: { select: { pendingActivation: true, expiresAt: true } },
    },
  });
  if (!c) notFound();

  const [bookings, chatPhotos] = await Promise.all([
    prisma.booking.findMany({
      where: { customerId: id, status: { not: "CANCELLED" } },
      orderBy: [{ date: "desc" }, { startTime: "desc" }],
      take: 40,
      select: {
        id: true, date: true, startTime: true, status: true, internalNotes: true,
        service: { select: { name: true, nameTh: true } },
        branch:  { select: { name: true } },
        staff:   { select: { name: true } },
        addons:  { select: { addon: { select: { name: true, nameTh: true } } } },
      },
    }),
    prisma.inboxMessage.findMany({
      where: { direction: "IN", mediaUrl: { not: null }, thread: { customerId: id } },
      orderBy: { createdAt: "desc" }, take: 24,
      select: { id: true, mediaUrl: true, createdAt: true },
    }),
  ]);

  let shopPhotos: string[] = [];
  try { shopPhotos = JSON.parse(c.photoUrls ?? "[]"); } catch { shopPhotos = []; }

  const today = bangkokTodayKey();
  const m = c.membership;
  const member = !m ? null
    : m.pendingActivation ? { label: "สมาชิก (รอเริ่มใช้)", bg: "#FEF3C7", fg: "#92400E" }
    : m.expiresAt && bangkokYmdOf(m.expiresAt) >= today ? { label: `สมาชิก ถึง ${new Date(m.expiresAt).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}`, bg: "#F0FDF4", fg: "#166534" }
    : { label: "สมาชิกหมดอายุ", bg: "#F4F4F5", fg: "#52525B" };
  const visits = bookings.filter(b => b.status === "COMPLETED").length;
  const thaiDate = (d: Date) => d.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "2-digit" });

  return (
    <main className="min-h-screen pb-12" style={{ background: BG }}>
      <header className="px-4 py-3 flex items-center gap-3" style={{ background: PRIMARY }}>
        <Link href={from ? `/staff/bookings/${from}` : "/staff"} className="text-white/80 hover:text-white p-1 -ml-1">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="flex-1 text-white font-bold text-base">ข้อมูลลูกค้า</h1>
      </header>

      <div className="p-4 space-y-3 max-w-lg mx-auto">
        {/* Who */}
        <section className="bg-white rounded-2xl p-4 flex items-center gap-3" style={{ border: `1px solid ${BORDER}` }}>
          {c.pictureUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={c.pictureUrl} alt="" className="w-14 h-14 rounded-full object-cover shrink-0" />
            : <div className="w-14 h-14 rounded-full shrink-0" style={{ background: "#F3E8E0" }} />}
          <div className="flex-1 min-w-0">
            <p className="text-lg font-bold truncate" style={{ color: TEXT }}>
              {c.nickname || c.name}
              {c.nickname && <span className="text-sm font-normal ml-1.5" style={{ color: MUTED }}>({c.name})</span>}
            </p>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              {member && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: member.bg, color: member.fg }}>{member.label}</span>}
              <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: "#F9F3EE", color: MUTED }}>มาแล้ว {visits} ครั้ง</span>
              {maskPhone(c.phone) && <span className="text-[11px] inline-flex items-center gap-1" style={{ color: MUTED }}><Phone size={11} />{maskPhone(c.phone)}</span>}
            </div>
          </div>
        </section>

        <Link href={`/staff/customers/${c.id}/color${from ? `?booking=${from}` : ""}`}
          className="flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-semibold bg-white"
          style={{ color: PRIMARY, border: `1px solid ${PRIMARY}` }}>
          การ์ดสีผม · ประวัติสูตรสี
          <span>›</span>
        </Link>

        {/* Shop notes */}
        {c.notes && (
          <section className="bg-white rounded-2xl p-4" style={{ border: `1px solid ${BORDER}` }}>
            <p className="text-[10px] uppercase tracking-wider font-semibold flex items-center gap-1.5" style={{ color: MUTED }}><StickyNote size={12} /> โน้ตลูกค้า</p>
            <p className="text-sm mt-1.5 whitespace-pre-wrap" style={{ color: TEXT }}>{c.notes}</p>
          </section>
        )}

        {/* Photos */}
        {(shopPhotos.length > 0 || chatPhotos.length > 0) && (
          <section className="bg-white rounded-2xl p-4 space-y-3" style={{ border: `1px solid ${BORDER}` }}>
            <p className="text-[10px] uppercase tracking-wider font-semibold flex items-center gap-1.5" style={{ color: MUTED }}><Images size={12} /> รูปภาพ</p>
            {shopPhotos.length > 0 && (
              <div>
                <p className="text-[11px] mb-1.5" style={{ color: MUTED }}>รูปที่ร้านบันทึกไว้</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {shopPhotos.map(u => (
                    <a key={u} href={u} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={u} alt="" className="w-full aspect-square object-cover rounded-lg" style={{ border: `1px solid ${BORDER}` }} />
                    </a>
                  ))}
                </div>
              </div>
            )}
            {chatPhotos.length > 0 && (
              <div>
                <p className="text-[11px] mb-1.5" style={{ color: MUTED }}>รูปที่ลูกค้าส่งมาในแชท</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {chatPhotos.map(p => (
                    <a key={p.id} href={p.mediaUrl!} target="_blank" rel="noreferrer" className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.mediaUrl!} alt="" className="w-full aspect-square object-cover rounded-lg" style={{ border: `1px solid ${BORDER}` }} />
                      <span className="absolute bottom-1 left-1 text-[9px] px-1 rounded text-white" style={{ background: "rgba(0,0,0,0.5)" }}>{thaiDate(p.createdAt)}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* History */}
        <section className="bg-white rounded-2xl p-4" style={{ border: `1px solid ${BORDER}` }}>
          <p className="text-[10px] uppercase tracking-wider font-semibold flex items-center gap-1.5 mb-2" style={{ color: MUTED }}><History size={12} /> ประวัติการใช้บริการ</p>
          {bookings.length === 0 && <p className="text-sm" style={{ color: MUTED }}>ยังไม่มีประวัติ</p>}
          <ul className="divide-y" style={{ borderColor: BORDER }}>
            {bookings.map(b => {
              const st = STATUS[b.status] ?? STATUS.PENDING;
              return (
                <li key={b.id} className="py-2.5">
                  <Link href={`/staff/bookings/${b.id}`} className="block">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold flex-1" style={{ color: TEXT }}>{thaiDate(b.date)} · {b.startTime}</p>
                      <span className="text-[10px] font-semibold" style={{ color: st.fg }}>{st.label}</span>
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: TEXT }}>
                      {b.service.nameTh || b.service.name}
                      {b.addons.length > 0 && <span style={{ color: MUTED }}> + {b.addons.map(a => a.addon.nameTh || a.addon.name).join(", ")}</span>}
                    </p>
                    <p className="text-[11px]" style={{ color: MUTED }}>{b.branch.name.replace(/^err\.day\s*/i, "")} · ช่าง{b.staff?.name ?? " ไม่ระบุ"}</p>
                    {b.internalNotes && <p className="text-[11px] mt-1 px-2 py-1 rounded whitespace-pre-wrap" style={{ background: "#FFF8F4", color: TEXT }}>📝 {b.internalNotes}</p>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <p className="text-xs text-center pt-1" style={{ color: MUTED }}>ดูได้เท่านั้น · หากต้องการแก้ไขข้อมูล กรุณาแจ้งผู้จัดการ</p>
      </div>
    </main>
  );
}
