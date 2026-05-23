"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, TrendingUp, TrendingDown } from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────
const PRIMARY = "#8B1D24";
const TEXT    = "#3B2A24";
const MUTED   = "#A08070";
const BORDER  = "#E8D8CC";

const PIE_COLORS = [
  "#8B1D24", "#C5734A", "#3B7A57", "#4E6FA3",
  "#8B6B4A", "#6B4E71", "#C59A3A", "#4A8B7A",
];

function fmt(satang: number) {
  return `฿${(satang / 100).toLocaleString("th-TH")}`;
}

// ── Types ─────────────────────────────────────────────────────────────────────
export interface MobileDashData {
  branches: { id: string; name: string }[];
  activeBranchId: string;  // "all" or branch id
  todayRevenue: number;
  todayCount: number;
  thisMonthRevenue: number;       // MTD
  thisMonthCount: number;         // MTD count
  lastMonthRevenue: number;       // last month, same range
  activeMembers: number;
  newMembersThisMonth: number;
  serviceBreakdown: { name: string; total: number; count: number }[];
  topCustomers: { id: string; name: string; total: number; count: number }[];
  staffRevenue: { name: string; total: number; count: number }[];
  weeklyRevenue: { label: string; total: number }[];
  hourlyUsage: { hour: number; count: number }[];
  avgTicket: number;
  currentMonthLabel: string;
  thisMonthRangeLabel: string;
  lastMonthRangeLabel: string;
}

// ── Donut chart (mobile size) ─────────────────────────────────────────────────
interface Slice { name: string; total: number; count: number; color: string }

function MobileDonut({ slices, size = 140 }: { slices: Slice[]; size?: number }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const total = slices.reduce((s, sl) => s + sl.total, 0);
  if (total === 0) return null;

  const CX = size / 2, CY = size / 2;
  const R = size * 0.44, r = size * 0.28;
  let angle = -Math.PI / 2;

  const segments = slices.map((sl, i) => {
    const a   = (sl.total / total) * 2 * Math.PI;
    const seg = { ...sl, startAngle: angle, endAngle: angle + a, index: i };
    angle += a;
    return seg;
  });

  function arcPath(s: number, e: number, outerR: number, innerR: number) {
    const x1 = CX + outerR * Math.cos(s), y1 = CY + outerR * Math.sin(s);
    const x2 = CX + outerR * Math.cos(e), y2 = CY + outerR * Math.sin(e);
    const xi1 = CX + innerR * Math.cos(e), yi1 = CY + innerR * Math.sin(e);
    const xi2 = CX + innerR * Math.cos(s), yi2 = CY + innerR * Math.sin(s);
    const large = e - s > Math.PI ? 1 : 0;
    return `M ${x1} ${y1} A ${outerR} ${outerR} 0 ${large} 1 ${x2} ${y2} L ${xi1} ${yi1} A ${innerR} ${innerR} 0 ${large} 0 ${xi2} ${yi2} Z`;
  }

  const hov = hovered !== null ? slices[hovered] : null;

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ overflow: "visible" }}>
        {segments.map((seg) => (
          <path
            key={seg.index}
            d={arcPath(seg.startAngle, seg.endAngle, hovered === seg.index ? R + 5 : R, r)}
            fill={seg.color}
            opacity={hovered !== null && hovered !== seg.index ? 0.5 : 1}
            style={{ cursor: "pointer", transition: "all 120ms" }}
            onMouseEnter={() => setHovered(seg.index)}
            onMouseLeave={() => setHovered(null)}
            onTouchStart={() => setHovered(seg.index)}
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-1">
        {hov ? (
          <>
            <p className="text-[10px] font-medium leading-tight" style={{ color: TEXT, maxWidth: r * 1.6 }}>{hov.name}</p>
            <p className="text-xs font-bold mt-0.5" style={{ color: PRIMARY }}>{fmt(hov.total)}</p>
            <p className="text-[9px]" style={{ color: MUTED }}>{((hov.total / total) * 100).toFixed(1)}%</p>
          </>
        ) : (
          <>
            <p className="text-[9px]" style={{ color: MUTED }}>รวม</p>
            <p className="text-xs font-bold" style={{ color: TEXT }}>{fmt(total)}</p>
          </>
        )}
      </div>
    </div>
  );
}

// ── Hour bars (mobile) ────────────────────────────────────────────────────────
function HourBars({ hourly }: { hourly: { hour: number; count: number }[] }) {
  const max     = Math.max(...hourly.map((h) => h.count), 1);
  const total   = hourly.reduce((s, h) => s + h.count, 0);
  const peakIdx = hourly.reduce((bestIdx, h, i, arr) => h.count > arr[bestIdx].count ? i : bestIdx, 0);
  const peak    = hourly[peakIdx];
  return (
    <div>
      <div className="flex items-end gap-[3px]" style={{ height: 90 }}>
        {hourly.map((h, i) => {
          const isPeak = i === peakIdx && h.count > 0;
          return (
            <div key={h.hour} className="flex-1 flex flex-col items-center justify-end gap-0.5 min-w-0">
              <span className="text-[9px] leading-none" style={{ color: h.count > 0 ? TEXT : "transparent" }}>{h.count}</span>
              <div className="w-full rounded-t" style={{
                height: `${(h.count / max) * 60}px`,
                background: h.count > 0 ? (isPeak ? PRIMARY : "#C5734A") : BORDER,
                minHeight: h.count > 0 ? 3 : 2,
              }} />
              <span className="text-[9px] leading-none" style={{ color: MUTED }}>
                {String(h.hour).padStart(2, "0")}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between mt-2 pt-2 text-[11px]" style={{ color: MUTED, borderTop: `1px solid #F5EFE9` }}>
        <span>รวม {total} ครั้ง</span>
        {peak && peak.count > 0 && (
          <span>
            ยอดนิยม:
            <span className="ml-1 font-semibold" style={{ color: PRIMARY }}>{String(peak.hour).padStart(2, "0")}:00</span>
          </span>
        )}
      </div>
    </div>
  );
}

// ── Week bars ─────────────────────────────────────────────────────────────────
function WeekBars({ weeks }: { weeks: { label: string; total: number }[] }) {
  const max = Math.max(...weeks.map((w) => w.total), 1);
  return (
    <div className="flex items-end gap-1.5" style={{ height: 56 }}>
      {weeks.map((w, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
          <div
            className="w-full rounded-t"
            style={{
              height: `${(w.total / max) * 44}px`,
              background: w.total > 0 ? PRIMARY : BORDER,
              minHeight: w.total > 0 ? 3 : 2,
            }}
          />
          <span className="text-[9px]" style={{ color: MUTED }}>ส{w.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function MobileDashboard({ data }: { data: MobileDashData }) {
  const router = useRouter();
  const {
    branches, activeBranchId,
    todayRevenue, todayCount,
    thisMonthRevenue, thisMonthCount,
    lastMonthRevenue,
    activeMembers, newMembersThisMonth,
    serviceBreakdown, topCustomers, staffRevenue, weeklyRevenue,
    hourlyUsage,
    avgTicket,
    currentMonthLabel, thisMonthRangeLabel, lastMonthRangeLabel,
  } = data;

  const isAllBranches = activeBranchId === "all";
  const branchOptions: { id: string; label: string }[] = [
    { id: "all", label: "ทุกสาขา" },
    ...branches.map(b => ({ id: b.id, label: b.name.replace(/^err\.day\s*/i, "") })),
  ];
  function selectBranch(id: string) {
    const params = new URLSearchParams();
    if (id !== "all") params.set("branchId", id);
    router.push(`/admin/m/dashboard${params.toString() ? `?${params}` : ""}`);
  }

  const momDiff = thisMonthRevenue - lastMonthRevenue;
  const momPct  = lastMonthRevenue > 0 ? (momDiff / lastMonthRevenue) * 100 : 0;
  const momUp   = momDiff >= 0;

  // Top 7 services + "อื่นๆ"
  let slices: Slice[];
  if (serviceBreakdown.length <= 7) {
    slices = serviceBreakdown.map((s, i) => ({ ...s, color: PIE_COLORS[i % PIE_COLORS.length] }));
  } else {
    const top6 = serviceBreakdown.slice(0, 6);
    const rest = serviceBreakdown.slice(6);
    slices = [
      ...top6.map((s, i) => ({ ...s, color: PIE_COLORS[i] })),
      {
        name: "อื่นๆ",
        total: rest.reduce((s, x) => s + x.total, 0),
        count: rest.reduce((s, x) => s + x.count, 0),
        color: PIE_COLORS[6],
      },
    ];
  }
  const sliceTotal = slices.reduce((s, x) => s + x.total, 0);

  return (
    <main className="pb-10" style={{ background: "#FDF7F2", minHeight: "100vh" }}>
      {/* Header */}
      <header
        className="sticky top-0 z-10 bg-white"
        style={{ borderBottom: `1px solid ${BORDER}` }}
      >
        <div className="px-4 py-3 flex items-center gap-3">
          <Link
            href="/admin/m"
            className="w-9 h-9 flex items-center justify-center rounded-full"
            style={{ color: TEXT }}
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <p className="text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>Business Intelligence</p>
            <h1 className="text-base font-semibold leading-tight" style={{ color: TEXT }}>ภาพรวมธุรกิจ</h1>
          </div>
        </div>
        {/* Branch picker — horizontal scroll if many branches */}
        <div className="px-4 pb-3 flex gap-1.5 overflow-x-auto">
          {branchOptions.map(o => {
            const active = o.id === activeBranchId;
            return (
              <button key={o.id} onClick={() => selectBranch(o.id)}
                className="flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors"
                style={{
                  background: active ? PRIMARY : "white",
                  color:      active ? "white"  : TEXT,
                  border:     `1px solid ${active ? PRIMARY : BORDER}`,
                }}>
                {o.label}
              </button>
            );
          })}
        </div>
      </header>

      <div className="px-4 pt-5 space-y-4">
        {/* ── KPI Grid ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          {/* Today */}
          <div className="rounded-2xl bg-white p-4" style={{ border: `1.5px solid ${BORDER}` }}>
            <p className="text-[11px] mb-1.5" style={{ color: MUTED }}>รายได้วันนี้</p>
            <p className="text-xl font-bold leading-tight" style={{ color: PRIMARY }}>{fmt(todayRevenue)}</p>
            <p className="text-[11px] mt-0.5" style={{ color: MUTED }}>{todayCount} รายการ</p>
          </div>

          {/* This month MTD */}
          <div className="rounded-2xl bg-white p-4" style={{ border: `1.5px solid ${BORDER}` }}>
            <p className="text-[11px] mb-1.5" style={{ color: MUTED }}>{thisMonthRangeLabel}</p>
            <p className="text-xl font-bold leading-tight" style={{ color: TEXT }}>{fmt(thisMonthRevenue)}</p>
            <p className="text-[11px] mt-0.5" style={{ color: MUTED }}>{thisMonthCount} รายการ</p>
          </div>

          {/* MoM — same range of days */}
          <div className="rounded-2xl bg-white p-4 col-span-2" style={{ border: `1.5px solid ${BORDER}` }}>
            <p className="text-[11px] mb-2" style={{ color: MUTED }}>
              เทียบช่วงเดียวกัน · {lastMonthRangeLabel}
            </p>
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: momUp ? "#DCFCE7" : "#FEE2E2" }}
              >
                {momUp
                  ? <TrendingUp size={16} color="#166534" />
                  : <TrendingDown size={16} color="#991B1B" />}
              </div>
              <div>
                <p className="text-xl font-bold leading-tight" style={{ color: momUp ? "#166534" : "#991B1B" }}>
                  {momUp ? "+" : ""}{fmt(momDiff)}
                </p>
                <p className="text-[11px]" style={{ color: momUp ? "#166534" : "#991B1B" }}>
                  {momUp ? "▲" : "▼"} {Math.abs(momPct).toFixed(1)}%
                  <span style={{ color: MUTED }}> จาก {fmt(lastMonthRevenue)}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Active members */}
          <div className="rounded-2xl bg-white p-4" style={{ border: `1.5px solid ${BORDER}` }}>
            <p className="text-[11px] mb-1.5" style={{ color: MUTED }}>
              สมาชิกที่ใช้งานได้
              {!isAllBranches && <span className="ml-1 text-[9px]">(ทั่วระบบ)</span>}
            </p>
            <p className="text-xl font-bold leading-tight" style={{ color: TEXT }}>{activeMembers}</p>
            {newMembersThisMonth > 0 && (
              <p className="text-[11px] mt-0.5" style={{ color: "#166534" }}>+{newMembersThisMonth} ใหม่</p>
            )}
          </div>

          {/* Avg ticket */}
          <div className="rounded-2xl bg-white p-4" style={{ border: `1.5px solid ${BORDER}` }}>
            <p className="text-[11px] mb-1.5" style={{ color: MUTED }}>เฉลี่ย/ครั้ง</p>
            <p className="text-xl font-bold leading-tight" style={{ color: TEXT }}>
              {thisMonthCount > 0 ? fmt(avgTicket) : "—"}
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: MUTED }}>{thisMonthCount} รายการ</p>
          </div>
        </div>

        {/* ── Service breakdown ─────────────────────────────────────────────── */}
        <div className="rounded-2xl bg-white p-4" style={{ border: `1.5px solid ${BORDER}` }}>
          <h2 className="font-medium text-sm mb-4" style={{ color: TEXT }}>
            ยอดขายตามบริการ
            <span className="ml-1.5 font-normal text-xs" style={{ color: MUTED }}>— {currentMonthLabel}</span>
          </h2>
          {slices.length === 0 ? (
            <p className="text-sm text-center py-4" style={{ color: MUTED }}>ยังไม่มีข้อมูล</p>
          ) : (
            <div className="flex items-center gap-4">
              <MobileDonut slices={slices} size={140} />
              <div className="flex-1 min-w-0 space-y-2">
                {slices.map((sl, i) => (
                  <div key={i} className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: sl.color }} />
                      <span className="text-[11px] truncate" style={{ color: TEXT }}>{sl.name}</span>
                    </div>
                    <span className="text-[11px] font-semibold flex-shrink-0" style={{ color: TEXT }}>
                      {sliceTotal > 0 ? ((sl.total / sliceTotal) * 100).toFixed(0) : 0}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Service detail list */}
          {slices.length > 0 && (
            <div className="mt-4 space-y-2 border-t pt-4" style={{ borderColor: "#F5EFE9" }}>
              {slices.map((sl, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: sl.color }} />
                    <span className="truncate" style={{ color: TEXT }}>{sl.name}</span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span style={{ color: MUTED }}>{sl.count} ครั้ง</span>
                    <span className="font-semibold" style={{ color: TEXT }}>{fmt(sl.total)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Weekly revenue ────────────────────────────────────────────────── */}
        <div className="rounded-2xl bg-white p-4" style={{ border: `1.5px solid ${BORDER}` }}>
          <h2 className="font-medium text-sm mb-4" style={{ color: TEXT }}>รายได้รายสัปดาห์</h2>
          <WeekBars weeks={weeklyRevenue} />
          <div className="mt-3 space-y-1.5">
            {weeklyRevenue.map((w, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span style={{ color: MUTED }}>สัปดาห์ {w.label}</span>
                <span style={{ color: w.total > 0 ? TEXT : MUTED, fontWeight: w.total > 0 ? 600 : 400 }}>
                  {fmt(w.total)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Hourly usage ──────────────────────────────────────────────────── */}
        <div className="rounded-2xl bg-white p-4" style={{ border: `1.5px solid ${BORDER}` }}>
          <h2 className="font-medium text-sm mb-4" style={{ color: TEXT }}>ช่วงเวลาที่ลูกค้าใช้บริการ</h2>
          {hourlyUsage.every(h => h.count === 0) ? (
            <p className="text-sm text-center py-4" style={{ color: MUTED }}>ยังไม่มีข้อมูลเดือนนี้</p>
          ) : (
            <HourBars hourly={hourlyUsage} />
          )}
        </div>

        {/* ── Top customers — by usage frequency ──────────────────────────── */}
        {topCustomers.length > 0 && (
          <div className="rounded-2xl bg-white p-4" style={{ border: `1.5px solid ${BORDER}` }}>
            <h2 className="font-medium text-sm mb-4" style={{ color: TEXT }}>ลูกค้าใช้บริการบ่อยที่สุด</h2>
            <div className="space-y-3">
              {topCustomers.map((c, i) => (
                <div key={c.id} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="text-xs font-bold w-5 text-center flex-shrink-0"
                      style={{ color: i === 0 ? PRIMARY : MUTED }}
                    >
                      {i + 1}
                    </span>
                    <span className="text-sm truncate" style={{ color: TEXT }}>{c.name}</span>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold" style={{ color: PRIMARY }}>{c.count} ครั้ง</p>
                    <p className="text-[11px]" style={{ color: MUTED }}>{fmt(c.total)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Staff performance ─────────────────────────────────────────────── */}
        {staffRevenue.length > 0 && (
          <div className="rounded-2xl bg-white p-4" style={{ border: `1.5px solid ${BORDER}` }}>
            <h2 className="font-medium text-sm mb-4" style={{ color: TEXT }}>ประสิทธิภาพช่าง</h2>
            <div className="space-y-4">
              {staffRevenue.map((s, i) => {
                const maxTotal = staffRevenue[0].total;
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm" style={{ color: TEXT }}>{s.name}</span>
                      <span className="text-sm font-semibold" style={{ color: TEXT }}>{fmt(s.total)}</span>
                    </div>
                    <div className="w-full rounded-full" style={{ height: 4, background: BORDER }}>
                      <div
                        className="rounded-full"
                        style={{
                          width: `${maxTotal > 0 ? (s.total / maxTotal) * 100 : 0}%`,
                          height: 4, background: PRIMARY,
                        }}
                      />
                    </div>
                    <p className="text-[11px] mt-1" style={{ color: MUTED }}>
                      {s.count} ครั้ง · เฉลี่ย {s.count > 0 ? fmt(Math.round(s.total / s.count)) : "—"}/ครั้ง
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Insights ─────────────────────────────────────────────────────── */}
        <div className="rounded-2xl bg-white p-4" style={{ border: `1.5px solid ${BORDER}` }}>
          <h2 className="font-medium text-sm mb-4" style={{ color: TEXT }}>ข้อมูลเชิงลึก</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[11px]" style={{ color: MUTED }}>ราคาเฉลี่ยต่อครั้ง</p>
              <p className="text-xl font-bold mt-0.5" style={{ color: TEXT }}>
                {thisMonthCount > 0 ? fmt(avgTicket) : "—"}
              </p>
            </div>
            <div>
              <p className="text-[11px]" style={{ color: MUTED }}>รายการเสร็จสิ้น</p>
              <p className="text-xl font-bold mt-0.5" style={{ color: TEXT }}>{thisMonthCount}</p>
              <p className="text-[11px] mt-0.5" style={{ color: MUTED }}>{thisMonthRangeLabel}</p>
            </div>
          </div>
        </div>

        <div className="h-2" />
      </div>
    </main>
  );
}
