"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Bell, Filter } from "lucide-react";

const PRIMARY = "#8B1D24";
const TEXT    = "#3B2A24";
const MUTED   = "#A08070";
const BORDER  = "#E8D8CC";
const BG      = "#FDF8F3";

interface LogRow {
  id:        string;
  kind:      string;
  status:    string;
  recipient: string | null;
  error:     string | null;
  sentAt:    string;
}
interface Stats {
  total:   number;
  sent:    number;
  failed:  number;
  skipped: number;
}
interface Props {
  logs:  LogRow[];
  stats: Stats;
}

const STATUS_META: Record<string, { label: string; bg: string; fg: string }> = {
  SENT:    { label: "ส่งแล้ว",  bg: "#F0FDF4", fg: "#166534" },
  FAILED:  { label: "ล้มเหลว",  bg: "#FEF2F2", fg: "#B91C1C" },
  SKIPPED: { label: "ข้าม",     bg: "#F4F4F5", fg: "#52525B" },
};

const KIND_LABEL: Record<string, string> = {
  BOOKING_CREATED:       "การจองใหม่",
  BOOKING_CONFIRMED:     "ยืนยันการจอง",
  BOOKING_CANCELLED:     "ยกเลิกการจอง",
  BOOKING_REMINDER_4H:   "เตือนก่อน 4 ชม.",
  BOOKING_REMINDER_24H:  "เตือนก่อน 24 ชม.",
  MEMBERSHIP_ACTIVATED:  "เปิดใช้สมาชิก",
  MEMBERSHIP_EXPIRY_1D:  "สมาชิกหมดอายุพรุ่งนี้",
  PACKAGE_ACTIVATED:     "เปิดใช้แพ็กเกจ",
  PACKAGE_EXPIRY_1D:     "แพ็กเกจหมดอายุพรุ่งนี้",
};

function formatRelativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  const diffMin = Math.floor((Date.now() - t) / 60000);
  if (diffMin < 1)   return "เมื่อสักครู่";
  if (diffMin < 60)  return `${diffMin} นาทีที่แล้ว`;
  if (diffMin < 60 * 24) return `${Math.floor(diffMin / 60)} ชม.ที่แล้ว`;
  return new Date(iso).toLocaleDateString("th-TH", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export default function MobileNotifications({ logs, stats }: Props) {
  const [filter, setFilter] = useState<"all" | "FAILED" | "SENT" | "SKIPPED">("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(
    () => filter === "all" ? logs : logs.filter(l => l.status === filter),
    [logs, filter],
  );

  return (
    <main className="min-h-screen pb-12" style={{ background: BG }}>
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <div className="px-4 py-3 flex items-center gap-3">
          <Link href="/admin/m" className="w-9 h-9 flex items-center justify-center rounded-full" style={{ color: TEXT }}>
            <ArrowLeft size={20} />
          </Link>
          <div>
            <p className="text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>Last 7 days</p>
            <h1 className="text-base font-semibold leading-tight" style={{ color: TEXT }}>การแจ้งเตือน</h1>
          </div>
        </div>
      </header>

      {/* Stats */}
      <section className="px-4 pt-4">
        <div className="grid grid-cols-4 gap-2">
          <StatCard label="ทั้งหมด" value={stats.total} color={TEXT} />
          <StatCard label="ส่งแล้ว" value={stats.sent}    color="#166534" />
          <StatCard label="ข้าม"   value={stats.skipped} color="#52525B" />
          <StatCard label="ล้มเหลว" value={stats.failed}  color="#B91C1C" />
        </div>
      </section>

      {/* Filter pills */}
      <section className="px-4 pt-4 flex items-center gap-2 overflow-x-auto">
        <Filter size={14} className="flex-shrink-0" style={{ color: MUTED }} />
        {(["all", "SENT", "FAILED", "SKIPPED"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
            style={{
              background: filter === f ? PRIMARY : "white",
              color:      filter === f ? "white" : TEXT,
              border:     `1px solid ${filter === f ? PRIMARY : BORDER}`,
            }}>
            {f === "all" ? "ทั้งหมด" : STATUS_META[f]?.label ?? f}
          </button>
        ))}
      </section>

      {/* List */}
      <section className="px-4 pt-3 space-y-2">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center" style={{ border: `1px solid ${BORDER}` }}>
            <Bell size={28} className="mx-auto mb-2 opacity-40" style={{ color: MUTED }} />
            <p className="text-sm" style={{ color: MUTED }}>ไม่มีการแจ้งเตือนในตัวกรองนี้</p>
          </div>
        ) : (
          filtered.map(l => {
            const meta = STATUS_META[l.status] ?? STATUS_META.SKIPPED;
            const isOpen = openId === l.id;
            return (
              <div key={l.id}
                onClick={() => setOpenId(isOpen ? null : l.id)}
                className="bg-white rounded-xl px-3 py-3 cursor-pointer active:scale-[0.99]"
                style={{ border: `1px solid ${BORDER}` }}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: TEXT }}>
                      {KIND_LABEL[l.kind] ?? l.kind}
                    </p>
                    <p className="text-xs truncate" style={{ color: MUTED }}>
                      {formatRelativeTime(l.sentAt)}
                      {l.recipient && (
                        <span className="ml-1 opacity-60"> · {l.recipient.slice(0, 8)}...</span>
                      )}
                    </p>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{ background: meta.bg, color: meta.fg }}>
                    {meta.label}
                  </span>
                </div>
                {/* Expanded detail (tap to expand) */}
                {isOpen && (l.error || l.recipient) && (
                  <div className="mt-2 pt-2 border-t text-xs space-y-1" style={{ borderColor: BORDER }}>
                    {l.recipient && (
                      <p style={{ color: MUTED }}>
                        <span className="font-medium">User: </span>
                        <span className="break-all" style={{ color: TEXT }}>{l.recipient}</span>
                      </p>
                    )}
                    {l.error && (
                      <p style={{ color: MUTED }}>
                        <span className="font-medium">ข้อความ: </span>
                        <span className="break-words" style={{ color: l.status === "FAILED" ? "#B91C1C" : TEXT }}>{l.error}</span>
                      </p>
                    )}
                    <p className="text-[10px]" style={{ color: MUTED }}>
                      {new Date(l.sentAt).toLocaleString("th-TH")}
                    </p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </section>
    </main>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-xl px-2 py-2.5 text-center" style={{ border: `1px solid ${BORDER}` }}>
      <p className="text-[10px]" style={{ color: MUTED }}>{label}</p>
      <p className="text-base font-bold leading-tight mt-0.5" style={{ color }}>{value}</p>
    </div>
  );
}
