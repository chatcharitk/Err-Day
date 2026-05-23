import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Phone, Clock, Sparkles, FileText } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/staff-auth";

export const dynamic  = "force-dynamic";
export const metadata = { title: "รายละเอียดการจอง — err.day" };

const PRIMARY = "#8B1D24";
const TEXT    = "#3B2A24";
const MUTED   = "#A08070";
const BORDER  = "#E8D8CC";
const BG      = "#FDF8F3";

const STATUS_META: Record<string, { label: string; bg: string; fg: string }> = {
  PENDING:   { label: "รอยืนยัน",  bg: "#FFF7ED", fg: "#9A3412" },
  CONFIRMED: { label: "ยืนยันแล้ว", bg: "#EFF6FF", fg: "#1D4ED8" },
  COMPLETED: { label: "เสร็จสิ้น",  bg: "#F0FDF4", fg: "#166534" },
  CANCELLED: { label: "ยกเลิก",   bg: "#FEF2F2", fg: "#B91C1C" },
  NO_SHOW:   { label: "ไม่มา",    bg: "#F4F4F5", fg: "#52525B" },
};

function formatBaht(satang: number): string {
  return `฿${(satang / 100).toLocaleString("th-TH")}`;
}
function timeToMins(t: string) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }

export default async function StaffBookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await getCurrentStaff();
  if (!me) redirect("/staff/login");

  const { id } = await params;
  const b = await prisma.booking.findUnique({
    where:  { id },
    select: {
      id:         true,
      date:       true,
      startTime:  true,
      endTime:    true,
      status:     true,
      totalPrice: true,
      notes:      true,
      staffId:    true,
      branchId:   true,
      service:    { select: { name: true, nameTh: true } },
      customer:   { select: { name: true, nickname: true, phone: true } },
      staff:      { select: { id: true, name: true } },
      addons:     { select: { id: true, price: true, addon: { select: { name: true, nameTh: true } } } },
    },
  });

  // Branch-scoped: staff can view any booking at their branch (so they can
  // assist coverage, prep, etc.). 404 on bookings outside their branch to
  // avoid leaking existence of bookings at other branches.
  if (!b || b.branchId !== me.branchId) notFound();

  const meta = STATUS_META[b.status] ?? STATUS_META.PENDING;
  const duration = timeToMins(b.endTime) - timeToMins(b.startTime);
  const dateLabel = b.date.toLocaleDateString("th-TH", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return (
    <main className="min-h-screen pb-12" style={{ background: BG }}>
      {/* Header */}
      <header className="px-4 py-3 flex items-center gap-3" style={{ background: PRIMARY }}>
        <Link href="/staff" className="text-white/80 hover:text-white p-1 -ml-1">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="flex-1 text-white font-bold text-base">รายละเอียดการจอง</h1>
        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
          style={{ background: meta.bg, color: meta.fg }}>
          {meta.label}
        </span>
      </header>

      <div className="p-4 space-y-3 max-w-lg mx-auto">
        {/* Customer card */}
        <section className="bg-white rounded-2xl p-4" style={{ border: `1px solid ${BORDER}` }}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: MUTED }}>ลูกค้า</p>
              <p className="text-lg font-bold mt-1" style={{ color: TEXT }}>
                {b.customer.name}
                {b.customer.nickname && (
                  <span className="text-sm font-normal ml-1.5" style={{ color: MUTED }}>({b.customer.nickname})</span>
                )}
              </p>
            </div>
            {/* Assignment badge — who's the appointment for? */}
            <div className="text-right flex-shrink-0">
              <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: MUTED }}>ช่าง</p>
              {b.staffId === me.id ? (
                <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full mt-1"
                  style={{ background: PRIMARY, color: "white" }}>
                  ของฉัน
                </span>
              ) : b.staff ? (
                <p className="text-sm font-semibold mt-1" style={{ color: TEXT }}>{b.staff.name}</p>
              ) : (
                <p className="text-sm font-medium italic mt-1" style={{ color: MUTED }}>ไม่ระบุ</p>
              )}
            </div>
          </div>
          <a href={`tel:${b.customer.phone}`}
            className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium"
            style={{ background: "#F0FDF4", color: "#166534", border: "1px solid #BBF7D0" }}>
            <Phone size={14} />
            {b.customer.phone}
          </a>
        </section>

        {/* Time + service card */}
        <section className="bg-white rounded-2xl p-4 space-y-3" style={{ border: `1px solid ${BORDER}` }}>
          <div className="flex items-start gap-3">
            <div className="rounded-lg p-2" style={{ background: "#FFF8F4" }}>
              <Clock size={18} style={{ color: PRIMARY }} />
            </div>
            <div className="flex-1">
              <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: MUTED }}>วันและเวลา</p>
              <p className="text-sm font-bold mt-0.5" style={{ color: TEXT }}>{dateLabel}</p>
              <p className="text-sm mt-0.5" style={{ color: TEXT }}>
                {b.startTime} – {b.endTime} <span className="text-xs" style={{ color: MUTED }}>({duration} นาที)</span>
              </p>
            </div>
          </div>

          <div className="border-t pt-3" style={{ borderColor: BORDER }}>
            <div className="flex items-start gap-3">
              <div className="rounded-lg p-2" style={{ background: "#FFF8F4" }}>
                <Sparkles size={18} style={{ color: PRIMARY }} />
              </div>
              <div className="flex-1">
                <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: MUTED }}>บริการ</p>
                <p className="text-sm font-bold mt-0.5" style={{ color: TEXT }}>{b.service.nameTh || b.service.name}</p>
                {b.addons.length > 0 && (
                  <div className="mt-2 space-y-0.5">
                    <p className="text-[10px] font-semibold" style={{ color: PRIMARY }}>บริการเสริม</p>
                    {b.addons.map(a => (
                      <p key={a.id} className="text-xs" style={{ color: TEXT }}>
                        + {a.addon.nameTh || a.addon.name}
                      </p>
                    ))}
                  </div>
                )}
              </div>
              <div className="text-right">
                <p className="text-[10px]" style={{ color: MUTED }}>ราคา</p>
                <p className="text-base font-bold" style={{ color: PRIMARY }}>{formatBaht(b.totalPrice)}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Notes (if any) */}
        {b.notes && (
          <section className="bg-white rounded-2xl p-4" style={{ border: `1px solid ${BORDER}` }}>
            <div className="flex items-start gap-3">
              <div className="rounded-lg p-2" style={{ background: "#FFF8F4" }}>
                <FileText size={18} style={{ color: PRIMARY }} />
              </div>
              <div className="flex-1">
                <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: MUTED }}>หมายเหตุจากผู้จัดการ</p>
                <p className="text-sm mt-1 whitespace-pre-wrap" style={{ color: TEXT }}>{b.notes}</p>
              </div>
            </div>
          </section>
        )}

        <p className="text-xs text-center pt-2" style={{ color: MUTED }}>
          ดูได้เท่านั้น · หากต้องการเปลี่ยนแปลง กรุณาแจ้งผู้จัดการ
        </p>
      </div>
    </main>
  );
}
