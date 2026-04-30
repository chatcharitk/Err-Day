"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Bell, CheckCircle2, AlertCircle, MinusCircle } from "lucide-react";

const PRIMARY = "#8B1D24";
const TEXT    = "#3B2A24";
const MUTED   = "#A08070";
const BORDER  = "#E8D8CC";

interface Log {
  id:        string;
  kind:      string;
  targetId:  string;
  channel:   string;
  status:    string;
  recipient: string | null;
  error:     string | null;
  sentAt:    string;
}

interface Props {
  logs:  Log[];
  stats: { total: number; sent: number; skipped: number; failed: number };
}

const KIND_LABEL: Record<string, string> = {
  BOOKING_REMINDER_4H:  "เตือนนัด 4 ชม.",
  MEMBERSHIP_ACTIVATED: "เปิดสมาชิกสำเร็จ",
  MEMBERSHIP_EXPIRY_1D: "สมาชิกใกล้หมดอายุ",
  PACKAGE_ACTIVATED:    "เปิดแพ็กเกจสำเร็จ",
  PACKAGE_EXPIRY_1D:    "แพ็กเกจใกล้หมดอายุ",
};

const STATUS_META: Record<string, { label: string; bg: string; fg: string; icon: React.ReactNode }> = {
  SENT:    { label: "ส่งแล้ว",   bg: "#F0FDF4", fg: "#166534", icon: <CheckCircle2 size={12} /> },
  FAILED:  { label: "ล้มเหลว",   bg: "#FEF2F2", fg: "#991B1B", icon: <AlertCircle size={12} /> },
  SKIPPED: { label: "ข้าม",        bg: "#F3F4F6", fg: "#6B7280", icon: <MinusCircle size={12} /> },
};

function formatDateTimeTh(iso: string): string {
  return new Date(iso).toLocaleString("th-TH", {
    day: "numeric", month: "short", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function NotificationsView({ logs, stats }: Props) {
  const router = useRouter();
  const [isRefreshing, startRefresh] = useTransition();
  const [running, setRunning] = useState(false);
  const [runMsg, setRunMsg] = useState<string | null>(null);

  /** Fire the cron endpoint manually (uses CRON_SECRET via ?secret=… fallback). */
  const runNow = async () => {
    setRunMsg(null);
    setRunning(true);
    try {
      const r  = await fetch("/api/cron/notifications");
      const js = await r.json();
      if (r.ok) {
        setRunMsg(`สำเร็จ: ส่งใหม่ ${js.stats?.sent ?? 0} · ข้าม ${js.stats?.skipped ?? 0} · ล้มเหลว ${js.stats?.failed ?? 0}`);
        startRefresh(() => router.refresh());
      } else {
        setRunMsg(js.error ?? "เรียกใช้งานไม่สำเร็จ");
      }
    } catch {
      setRunMsg("เรียกใช้งานไม่สำเร็จ");
    } finally { setRunning(false); }
  };

  return (
    <div className="px-8 py-8">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: MUTED }}>Notifications</p>
          <h1 className="text-2xl font-medium" style={{ color: TEXT }}>การแจ้งเตือน</h1>
          <p className="text-xs mt-1" style={{ color: MUTED }}>
            ประวัติการส่ง LINE notification — รวมทั้งที่ส่งสำเร็จ, ข้าม (ลูกค้าไม่ได้เชื่อม LINE) และล้มเหลว
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => startRefresh(() => router.refresh())}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm border disabled:opacity-50"
            style={{ borderColor: BORDER, color: TEXT, background: "white" }}
          >
            <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} />
            รีเฟรช
          </button>
          <button
            onClick={runNow}
            disabled={running}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-white disabled:opacity-50"
            style={{ background: PRIMARY }}
          >
            <Bell size={14} className={running ? "animate-pulse" : ""} />
            ส่งคิวที่ค้างทันที
          </button>
        </div>
      </div>

      {runMsg && (
        <p className="text-sm mb-4 px-4 py-2 rounded-xl" style={{ background: "#FFF8F4", color: TEXT, border: `1px solid ${BORDER}` }}>
          {runMsg}
        </p>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { k: "total",   labelTh: "ทั้งหมด (7 วัน)" },
          { k: "sent",    labelTh: "ส่งสำเร็จ" },
          { k: "skipped", labelTh: "ข้าม" },
          { k: "failed",  labelTh: "ล้มเหลว" },
        ].map(({ k, labelTh }) => (
          <div key={k} className="rounded-2xl p-4 bg-white" style={{ border: `1px solid ${BORDER}` }}>
            <p className="text-xs uppercase tracking-widest" style={{ color: MUTED }}>{labelTh}</p>
            <p className="text-2xl font-bold mt-1" style={{ color: k === "failed" ? "#991B1B" : k === "sent" ? "#166534" : TEXT }}>
              {stats[k as keyof typeof stats]}
            </p>
          </div>
        ))}
      </div>

      {/* Log table */}
      <div className="rounded-2xl bg-white overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
        <div
          className="grid grid-cols-[150px_180px_1fr_140px_120px] gap-4 px-5 py-3 text-xs font-semibold uppercase tracking-widest"
          style={{ background: "#F9F4F0", color: MUTED, borderBottom: `1px solid ${BORDER}` }}
        >
          <span>เวลา</span>
          <span>ประเภท</span>
          <span>เป้าหมาย / รายละเอียด</span>
          <span>ผู้รับ</span>
          <span>สถานะ</span>
        </div>

        {logs.length === 0 ? (
          <p className="text-center py-12 text-sm" style={{ color: MUTED }}>ยังไม่มีบันทึกการแจ้งเตือน</p>
        ) : (
          <div className="divide-y" style={{ borderColor: "#F5EFE9" }}>
            {logs.map((l) => {
              const meta = STATUS_META[l.status] ?? STATUS_META.FAILED;
              return (
                <div
                  key={l.id}
                  className="grid grid-cols-[150px_180px_1fr_140px_120px] gap-4 px-5 py-3 items-center text-sm"
                  style={{ color: TEXT }}
                >
                  <span className="text-xs" style={{ color: MUTED }}>{formatDateTimeTh(l.sentAt)}</span>
                  <span className="text-xs">{KIND_LABEL[l.kind] ?? l.kind}</span>
                  <span className="text-xs font-mono truncate" title={l.error ?? l.targetId}>
                    {l.error ? <span style={{ color: "#991B1B" }}>{l.error}</span> : l.targetId}
                  </span>
                  <span className="text-[10px] font-mono truncate" style={{ color: MUTED }} title={l.recipient ?? ""}>
                    {l.recipient ? l.recipient.slice(0, 8) + "…" : "—"}
                  </span>
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium w-fit"
                    style={{ background: meta.bg, color: meta.fg }}
                  >
                    {meta.icon} {meta.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
