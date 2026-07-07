"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, RefreshCw, TrendingUp } from "lucide-react";
import type { Period } from "./page";

const PRIMARY = "#8B1D24";
const TEXT    = "#3B2A24";
const MUTED   = "#A08070";
const BORDER  = "#E8D8CC";

const THAI_MONTHS_SHORT = [
  "ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.",
  "ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค.",
];
const DOW_TH_SHORT = ["อา.","จ.","อ.","พ.","พฤ.","ศ.","ส."];

function fmtDayHeader(dateStr: string, todayStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const prefix = dateStr === todayStr ? "วันนี้ · " : `${DOW_TH_SHORT[dt.getDay()]} `;
  return `${prefix}${d} ${THAI_MONTHS_SHORT[m - 1]} ${y + 543}`;
}

interface SaleRow {
  id:           string;
  date:         string;
  startTime:    string;
  totalPrice:   number;
  serviceName:  string;
  customerName: string;
  staffName:    string | null;
}

const PERIOD_TABS: { key: Period; label: string }[] = [
  { key: "today",      label: "วันนี้" },
  { key: "week",       label: "สัปดาห์นี้" },
  { key: "month",      label: "เดือนนี้" },
  { key: "last_month", label: "เดือนที่แล้ว" },
  { key: "year",       label: "ปีนี้" },
];

interface Props {
  sales:        SaleRow[];
  period:       Period;
  periodLabel:  string;
  totalRevenue: number;
  totalCount:   number;
  truncated:    boolean;
  todayStr:     string;
}

export default function MobileSalesHistory({ sales, period, periodLabel, totalRevenue, totalCount, truncated, todayStr }: Props) {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleRefresh = () => {
    setIsRefreshing(true);
    router.refresh();
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const selectPeriod = (p: Period) => {
    if (p === period) return;
    startTransition(() => router.push(`/admin/m/history?period=${p}`));
  };

  const grouped = useMemo(() => {
    const map = new Map<string, SaleRow[]>();
    for (const s of sales) {
      if (!map.has(s.date)) map.set(s.date, []);
      map.get(s.date)!.push(s);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [sales]);

  return (
    <main className="pb-12" style={{ background: "#FDF7F2", minHeight: "100vh" }}>
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <div className="px-4 py-3 flex items-center gap-2">
          <button onClick={() => router.back()} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ color: TEXT }}>
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-base font-medium flex-1" style={{ color: TEXT }}>ประวัติการขาย</h1>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="w-9 h-9 rounded-full flex items-center justify-center disabled:opacity-50"
            style={{ color: TEXT }}
          >
            <RefreshCw size={17} className={isRefreshing ? "animate-spin" : ""} />
          </button>
        </div>

        {/* Period selector */}
        <div className="px-2 pb-2.5 flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {PERIOD_TABS.map(({ key, label }) => {
            const active = key === period;
            return (
              <button
                key={key}
                onClick={() => selectPeriod(key)}
                className="flex-shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all"
                style={{
                  background: active ? PRIMARY : "#FFF8F4",
                  color:      active ? "white"  : TEXT,
                  border:     `1px solid ${active ? PRIMARY : BORDER}`,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </header>

      {/* Period summary */}
      <section className="px-4 pt-4 pb-3">
        <div className="rounded-2xl p-4" style={{ background: PRIMARY, color: "white", opacity: isPending ? 0.6 : 1, transition: "opacity 150ms" }}>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={15} style={{ opacity: 0.75 }} />
            <span className="text-xs font-semibold tracking-wide uppercase" style={{ opacity: 0.75 }}>
              ยอดขาย{periodLabel}
            </span>
          </div>
          <p className="text-3xl font-bold tracking-tight">฿{(totalRevenue / 100).toLocaleString()}</p>
          <p className="text-sm mt-0.5" style={{ opacity: 0.7 }}>{totalCount.toLocaleString()} รายการ</p>
        </div>
      </section>

      {/* Table */}
      <section className="px-4 pb-4">
        {truncated && (
          <p className="text-[11px] mb-2 px-1" style={{ color: MUTED }}>
            แสดง {sales.length.toLocaleString()} รายการล่าสุด จากทั้งหมด {totalCount.toLocaleString()} รายการ — ยอดรวมด้านบนนับครบทุกรายการ
          </p>
        )}
        {grouped.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm" style={{ color: MUTED }}>ไม่มีรายการขายในช่วง{periodLabel}</p>
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
            {/* Column headers */}
            <div
              className="grid text-[10px] font-semibold uppercase tracking-widest px-3 py-2"
              style={{
                gridTemplateColumns: "3rem 1fr 1fr auto",
                background: "#F9F0EA",
                borderBottom: `1px solid ${BORDER}`,
                color: MUTED,
              }}
            >
              <span>เวลา</span>
              <span>ชื่อ</span>
              <span>บริการ</span>
              <span className="text-right">ยอด</span>
            </div>

            {grouped.map(([dateStr, rows], gi) => {
              const dayTotal = rows.reduce((s, r) => s + r.totalPrice, 0);
              const isToday  = dateStr === todayStr;
              return (
                <div key={dateStr}>
                  {/* Day separator */}
                  <div
                    className="flex items-center justify-between px-3 py-1.5"
                    style={{
                      background: isToday ? "#FFF4F4" : "#F9F0EA",
                      borderTop: gi > 0 ? `1px solid ${BORDER}` : undefined,
                    }}
                  >
                    <span className="text-[11px] font-semibold" style={{ color: isToday ? PRIMARY : TEXT }}>
                      {fmtDayHeader(dateStr, todayStr)}
                    </span>
                    <span className="text-[11px] font-bold" style={{ color: TEXT }}>
                      ฿{(dayTotal / 100).toLocaleString()}
                    </span>
                  </div>

                  {/* Rows */}
                  {rows.map((row, ri) => (
                    <div
                      key={row.id}
                      className="grid items-start px-3 py-2"
                      style={{
                        gridTemplateColumns: "3rem 1fr 1fr auto",
                        borderTop: `1px solid ${BORDER}`,
                        background: ri % 2 === 0 ? "white" : "#FDFAF8",
                      }}
                    >
                      <span className="text-xs font-bold pt-px" style={{ color: PRIMARY }}>{row.startTime}</span>

                      <div className="min-w-0 pr-1">
                        <p className="text-xs font-medium truncate" style={{ color: TEXT }}>{row.customerName}</p>
                        {row.staffName && (
                          <p className="text-[10px] truncate" style={{ color: MUTED }}>{row.staffName}</p>
                        )}
                      </div>

                      <p className="text-xs truncate pr-2" style={{ color: MUTED }}>{row.serviceName}</p>

                      <span className="text-xs font-semibold text-right pt-px whitespace-nowrap" style={{ color: "#166534" }}>
                        ฿{(row.totalPrice / 100).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
