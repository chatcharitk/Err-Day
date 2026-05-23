"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// ── Constants ─────────────────────────────────────────────────────────────────
const PRIMARY = "#8B1D24";
const TEXT    = "#3B2A24";
const MUTED   = "#A08070";
const BORDER  = "#E8D8CC";

const PIE_COLORS = [
  "#8B1D24", "#C5734A", "#3B7A57", "#4E6FA3",
  "#8B6B4A", "#6B4E71", "#C59A3A", "#4A8B7A",
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(satang: number) {
  return `฿${(satang / 100).toLocaleString("th-TH")}`;
}

// ── Types ─────────────────────────────────────────────────────────────────────
export interface DashboardData {
  branches: { id: string; name: string }[];
  /** "all" or a specific branch id — drives the pill picker and the page URL. */
  activeBranchId: string;
  todayRevenue: number;
  todayCount: number;
  thisMonthRevenue: number;       // MTD: 1 → today
  thisMonthCount: number;         // MTD count
  lastMonthRevenue: number;       // last month, same range of days
  lastMonthCount: number;
  activeMembers: number;
  newMembersThisMonth: number;
  serviceBreakdown: { name: string; total: number; count: number }[];
  topCustomers: { id: string; name: string; total: number; count: number }[]; // sorted by count
  staffRevenue: { name: string; total: number; count: number }[];
  weeklyRevenue: { label: string; total: number }[];
  hourlyUsage: { hour: number; count: number }[];
  avgTicket: number;
  currentMonthLabel: string;
  lastMonthRangeLabel: string;    // e.g., "1–10 เม.ย."
  thisMonthRangeLabel: string;    // e.g., "1–10 พ.ค."
}

// ── Donut chart ───────────────────────────────────────────────────────────────
interface Slice {
  name: string;
  total: number;
  count: number;
  color: string;
}

function DonutChart({ slices, size = 180 }: { slices: Slice[]; size?: number }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const total = slices.reduce((s, sl) => s + sl.total, 0);

  if (total === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-full"
        style={{ width: size, height: size, background: "#F5EFE9", color: MUTED, fontSize: 13 }}
      >
        ไม่มีข้อมูล
      </div>
    );
  }

  const CX = size / 2, CY = size / 2;
  const R = size * 0.44, r = size * 0.28;

  let angle = -Math.PI / 2;
  const segments = slices.map((sl, i) => {
    const a = (sl.total / total) * 2 * Math.PI;
    const seg = { ...sl, startAngle: angle, endAngle: angle + a, index: i };
    angle += a;
    return seg;
  });

  function arcPath(start: number, end: number, outerR: number, innerR: number) {
    const x1 = CX + outerR * Math.cos(start);
    const y1 = CY + outerR * Math.sin(start);
    const x2 = CX + outerR * Math.cos(end);
    const y2 = CY + outerR * Math.sin(end);
    const xi1 = CX + innerR * Math.cos(end);
    const yi1 = CY + innerR * Math.sin(end);
    const xi2 = CX + innerR * Math.cos(start);
    const yi2 = CY + innerR * Math.sin(start);
    const large = end - start > Math.PI ? 1 : 0;
    return `M ${x1} ${y1} A ${outerR} ${outerR} 0 ${large} 1 ${x2} ${y2} L ${xi1} ${yi1} A ${innerR} ${innerR} 0 ${large} 0 ${xi2} ${yi2} Z`;
  }

  const hoveredSlice = hovered !== null ? slices[hovered] : null;

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ overflow: "visible" }}>
        {segments.map((seg) => (
          <path
            key={seg.index}
            d={arcPath(
              seg.startAngle, seg.endAngle,
              hovered === seg.index ? R + 6 : R,
              r,
            )}
            fill={seg.color}
            opacity={hovered !== null && hovered !== seg.index ? 0.5 : 1}
            style={{ cursor: "pointer", transition: "all 150ms" }}
            onMouseEnter={() => setHovered(seg.index)}
            onMouseLeave={() => setHovered(null)}
          />
        ))}
      </svg>
      {/* Centre label */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-2"
      >
        {hoveredSlice ? (
          <>
            <p className="text-[11px] font-medium leading-tight" style={{ color: TEXT, maxWidth: r * 1.6 }}>
              {hoveredSlice.name}
            </p>
            <p className="text-sm font-bold mt-0.5" style={{ color: PRIMARY }}>{fmt(hoveredSlice.total)}</p>
            <p className="text-[10px]" style={{ color: MUTED }}>
              {((hoveredSlice.total / total) * 100).toFixed(1)}%
            </p>
          </>
        ) : (
          <>
            <p className="text-[10px]" style={{ color: MUTED }}>รวม</p>
            <p className="text-sm font-bold" style={{ color: TEXT }}>{fmt(total)}</p>
          </>
        )}
      </div>
    </div>
  );
}

// ── Week bars ─────────────────────────────────────────────────────────────────
function WeekBars({ weeks }: { weeks: { label: string; total: number }[] }) {
  const max = Math.max(...weeks.map((w) => w.total), 1);
  return (
    <div className="flex items-end gap-2" style={{ height: 72 }}>
      {weeks.map((w, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div
            className="w-full rounded-t-md"
            style={{
              height: `${(w.total / max) * 56}px`,
              background: w.total > 0 ? PRIMARY : BORDER,
              minHeight: w.total > 0 ? 4 : 2,
              transition: "height 400ms",
            }}
          />
          <span className="text-[10px]" style={{ color: MUTED }}>ส{w.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Hourly bar chart ──────────────────────────────────────────────────────────
function HourBars({ hourly }: { hourly: { hour: number; count: number }[] }) {
  const max     = Math.max(...hourly.map((h) => h.count), 1);
  const total   = hourly.reduce((s, h) => s + h.count, 0);
  const peakIdx = hourly.reduce((bestIdx, h, i, arr) => h.count > arr[bestIdx].count ? i : bestIdx, 0);
  const peak    = hourly[peakIdx];
  return (
    <div>
      <div className="flex items-end gap-1.5" style={{ height: 120 }}>
        {hourly.map((h, i) => {
          const isPeak = i === peakIdx && h.count > 0;
          return (
            <div key={h.hour} className="flex-1 flex flex-col items-center justify-end gap-1 min-w-0">
              <span className="text-[10px] leading-none" style={{ color: h.count > 0 ? TEXT : "transparent" }}>
                {h.count}
              </span>
              <div
                className="w-full rounded-t-md"
                style={{
                  height: `${(h.count / max) * 80}px`,
                  background: h.count > 0 ? (isPeak ? PRIMARY : "#C5734A") : BORDER,
                  minHeight: h.count > 0 ? 4 : 2,
                  transition: "height 400ms",
                }}
              />
              <span className="text-[10px] leading-none" style={{ color: MUTED }}>
                {String(h.hour).padStart(2, "0")}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between mt-3 pt-3 text-xs" style={{ color: MUTED, borderTop: `1px solid #F5EFE9` }}>
        <span>รวม {total} ครั้ง</span>
        {peak && peak.count > 0 && (
          <span>
            ช่วงเวลายอดนิยม:
            <span className="ml-1 font-semibold" style={{ color: PRIMARY }}>
              {String(peak.hour).padStart(2, "0")}:00
            </span>
            <span className="ml-1">({peak.count} ครั้ง)</span>
          </span>
        )}
      </div>
    </div>
  );
}

// ── KPI card ──────────────────────────────────────────────────────────────────
function KpiCard({
  label, value, sub, valueColor, subColor,
}: {
  label: string;
  value: string;
  sub?: string;
  valueColor?: string;
  subColor?: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-5" style={{ border: `1.5px solid ${BORDER}` }}>
      <p className="text-xs mb-2" style={{ color: MUTED }}>{label}</p>
      <p className="text-2xl font-bold mb-1 leading-tight" style={{ color: valueColor ?? TEXT }}>{value}</p>
      {sub && <p className="text-xs leading-snug" style={{ color: subColor ?? MUTED }}>{sub}</p>}
    </div>
  );
}

// ── Branch filter pills ───────────────────────────────────────────────────────
function BranchPicker({
  branches, activeBranchId,
}: {
  branches: { id: string; name: string }[];
  activeBranchId: string;
}) {
  const router = useRouter();
  function select(id: string) {
    const params = new URLSearchParams();
    if (id !== "all") params.set("branchId", id);
    router.push(`/admin${params.toString() ? `?${params}` : ""}`);
  }
  const options: { id: string; label: string }[] = [
    { id: "all", label: "ทุกสาขา" },
    ...branches.map(b => ({ id: b.id, label: b.name.replace(/^err\.day\s*/i, "") })),
  ];
  return (
    <div className="flex flex-wrap gap-1.5 bg-white rounded-full p-1 self-start" style={{ border: `1.5px solid ${BORDER}` }}>
      {options.map(o => {
        const active = o.id === activeBranchId;
        return (
          <button key={o.id} onClick={() => select(o.id)}
            className="px-4 py-1.5 rounded-full text-xs font-semibold transition-colors"
            style={{
              background: active ? PRIMARY : "transparent",
              color:      active ? "white"  : TEXT,
            }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function DashboardView({ data }: { data: DashboardData }) {
  const {
    branches, activeBranchId,
    todayRevenue, todayCount,
    thisMonthRevenue, thisMonthCount,
    lastMonthRevenue,
    activeMembers, newMembersThisMonth,
    serviceBreakdown, topCustomers, staffRevenue, weeklyRevenue,
    hourlyUsage,
    avgTicket,
    currentMonthLabel, lastMonthRangeLabel, thisMonthRangeLabel,
  } = data;

  const activeBranchName = activeBranchId === "all"
    ? "ทุกสาขา"
    : branches.find(b => b.id === activeBranchId)?.name ?? "—";
  const isAllBranches = activeBranchId === "all";

  const momDiff = thisMonthRevenue - lastMonthRevenue;
  const momPct  = lastMonthRevenue > 0 ? (momDiff / lastMonthRevenue) * 100 : 0;
  const momUp   = momDiff >= 0;

  // Top 8 services; group remainder as "อื่นๆ"
  let slices: Slice[];
  if (serviceBreakdown.length <= 8) {
    slices = serviceBreakdown.map((s, i) => ({ ...s, color: PIE_COLORS[i] }));
  } else {
    const top7 = serviceBreakdown.slice(0, 7);
    const rest = serviceBreakdown.slice(7);
    const otherTotal = rest.reduce((s, x) => s + x.total, 0);
    const otherCount = rest.reduce((s, x) => s + x.count, 0);
    slices = [
      ...top7.map((s, i) => ({ ...s, color: PIE_COLORS[i] })),
      { name: "อื่นๆ", total: otherTotal, count: otherCount, color: PIE_COLORS[7] },
    ];
  }

  const sliceTotal = slices.reduce((s, x) => s + x.total, 0);

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: MUTED }}>Business Intelligence</p>
          <h1 className="text-2xl font-medium" style={{ color: TEXT }}>
            ภาพรวมธุรกิจ
            <span className="ml-2 text-sm font-normal" style={{ color: MUTED }}>· {activeBranchName}</span>
          </h1>
        </div>
        <BranchPicker branches={branches} activeBranchId={activeBranchId} />
      </div>

      {/* ── KPI Row ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="รายได้วันนี้"
          value={fmt(todayRevenue)}
          sub={`${todayCount} รายการเสร็จสิ้น`}
          valueColor={PRIMARY}
        />
        <KpiCard
          label={`รายได้เดือนนี้ · ${thisMonthRangeLabel}`}
          value={fmt(thisMonthRevenue)}
          sub={`${thisMonthCount} รายการ`}
        />
        <div className="rounded-2xl bg-white p-5" style={{ border: `1.5px solid ${BORDER}` }}>
          <p className="text-xs mb-2" style={{ color: MUTED }}>
            เทียบช่วงเดียวกัน · {lastMonthRangeLabel}
          </p>
          <p className="text-2xl font-bold mb-1 leading-tight" style={{ color: momUp ? "#166534" : "#991B1B" }}>
            {momUp ? "+" : ""}{fmt(momDiff)}
          </p>
          <p className="text-xs" style={{ color: momUp ? "#166534" : "#991B1B" }}>
            {momUp ? "▲" : "▼"} {Math.abs(momPct).toFixed(1)}%
            <span style={{ color: MUTED }}> จาก {fmt(lastMonthRevenue)}</span>
          </p>
        </div>
        <div className="rounded-2xl bg-white p-5" style={{ border: `1.5px solid ${BORDER}` }}>
          <p className="text-xs mb-2" style={{ color: MUTED }}>
            สมาชิกที่ใช้งานได้
            {!isAllBranches && <span className="ml-1 text-[10px]">(ทั่วระบบ)</span>}
          </p>
          <p className="text-2xl font-bold mb-1 leading-tight" style={{ color: TEXT }}>{activeMembers}</p>
          <p className="text-xs" style={{ color: "#166534" }}>
            {newMembersThisMonth > 0 ? `+${newMembersThisMonth} ใหม่เดือนนี้` : "ไม่มีสมาชิกใหม่เดือนนี้"}
          </p>
        </div>
      </div>

      {/* ── Charts Row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">
        {/* Pie chart + legend */}
        <div className="lg:col-span-3 rounded-2xl bg-white p-5" style={{ border: `1.5px solid ${BORDER}` }}>
          <h2 className="font-medium text-sm mb-4" style={{ color: TEXT }}>
            ยอดขายตามบริการ
            <span className="ml-2 font-normal" style={{ color: MUTED }}>— {currentMonthLabel}</span>
          </h2>
          {slices.length === 0 ? (
            <p className="text-sm text-center py-10" style={{ color: MUTED }}>ยังไม่มีข้อมูลเดือนนี้</p>
          ) : (
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
              <DonutChart slices={slices} size={180} />
              <div className="flex-1 min-w-0 space-y-2 w-full self-center">
                {slices.map((sl, i) => (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: sl.color }} />
                      <span className="text-xs truncate" style={{ color: TEXT }}>{sl.name}</span>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 text-xs">
                      <span style={{ color: MUTED }}>{sl.count} ครั้ง</span>
                      <span className="font-semibold w-24 text-right" style={{ color: TEXT }}>{fmt(sl.total)}</span>
                      <span className="w-9 text-right" style={{ color: MUTED }}>
                        {sliceTotal > 0 ? ((sl.total / sliceTotal) * 100).toFixed(0) : 0}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Weekly revenue */}
        <div className="lg:col-span-2 rounded-2xl bg-white p-5" style={{ border: `1.5px solid ${BORDER}` }}>
          <h2 className="font-medium text-sm mb-4" style={{ color: TEXT }}>รายได้รายสัปดาห์</h2>
          <WeekBars weeks={weeklyRevenue} />
          <div className="mt-4 space-y-2">
            {weeklyRevenue.map((w, i) => (
              <div key={i} className="flex justify-between items-center text-xs">
                <span style={{ color: MUTED }}>สัปดาห์ {w.label}</span>
                <span style={{ color: w.total > 0 ? TEXT : MUTED, fontWeight: w.total > 0 ? 600 : 400 }}>
                  {fmt(w.total)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Hourly Usage ───────────────────────────────────────────────────── */}
      <div className="rounded-2xl bg-white p-5 mb-6" style={{ border: `1.5px solid ${BORDER}` }}>
        <h2 className="font-medium text-sm mb-4" style={{ color: TEXT }}>
          ช่วงเวลาที่ลูกค้าใช้บริการ
          <span className="ml-2 font-normal" style={{ color: MUTED }}>— {currentMonthLabel}</span>
        </h2>
        {hourlyUsage.every((h) => h.count === 0) ? (
          <p className="text-sm text-center py-8" style={{ color: MUTED }}>ยังไม่มีข้อมูลเดือนนี้</p>
        ) : (
          <HourBars hourly={hourlyUsage} />
        )}
      </div>

      {/* ── Bottom Row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Top customers — by usage frequency */}
        <div className="rounded-2xl bg-white p-5" style={{ border: `1.5px solid ${BORDER}` }}>
          <h2 className="font-medium text-sm mb-4" style={{ color: TEXT }}>ลูกค้าใช้บริการบ่อยที่สุด — เดือนนี้</h2>
          {topCustomers.length === 0 ? (
            <p className="text-sm py-4 text-center" style={{ color: MUTED }}>ยังไม่มีข้อมูล</p>
          ) : (
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
                    <p className="text-xs" style={{ color: MUTED }}>{fmt(c.total)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Staff performance */}
        <div className="rounded-2xl bg-white p-5" style={{ border: `1.5px solid ${BORDER}` }}>
          <h2 className="font-medium text-sm mb-4" style={{ color: TEXT }}>ประสิทธิภาพช่าง — เดือนนี้</h2>
          {staffRevenue.length === 0 ? (
            <p className="text-sm py-4 text-center" style={{ color: MUTED }}>ยังไม่มีข้อมูล</p>
          ) : (
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
                          height: 4,
                          background: PRIMARY,
                          transition: "width 500ms",
                        }}
                      />
                    </div>
                    <p className="text-xs mt-1" style={{ color: MUTED }}>
                      {s.count} ครั้ง · เฉลี่ย {s.count > 0 ? fmt(Math.round(s.total / s.count)) : "—"}/ครั้ง
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Additional insights */}
        <div className="rounded-2xl bg-white p-5" style={{ border: `1.5px solid ${BORDER}` }}>
          <h2 className="font-medium text-sm mb-4" style={{ color: TEXT }}>ข้อมูลเชิงลึก</h2>
          <div className="space-y-6">
            <div>
              <p className="text-xs mb-1" style={{ color: MUTED }}>ราคาเฉลี่ยต่อครั้ง</p>
              <p className="text-2xl font-bold" style={{ color: TEXT }}>
                {thisMonthCount > 0 ? fmt(avgTicket) : "—"}
              </p>
              {thisMonthCount > 0 && (
                <p className="text-xs mt-0.5" style={{ color: MUTED }}>จาก {thisMonthCount} รายการ</p>
              )}
            </div>
            <div>
              <p className="text-xs mb-1" style={{ color: MUTED }}>รายการเสร็จสิ้นเดือนนี้</p>
              <p className="text-2xl font-bold" style={{ color: TEXT }}>{thisMonthCount}</p>
              <p className="text-xs mt-0.5" style={{ color: MUTED }}>{thisMonthRangeLabel}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
