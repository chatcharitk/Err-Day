"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createPortal } from "react-dom";
import { Pencil, X, Save, Search, ChevronDown, ExternalLink } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Branch  { id: string; name: string }
interface StaffItem { id: string; name: string; branchId: string }
interface ServiceItem { id: string; name: string; nameTh: string }

interface SaleRecord {
  id: string;
  date: string;           // ISO
  startTime: string;
  endTime: string;
  status: string;
  totalPrice: number;     // satang
  notes: string | null;
  branchId: string;
  serviceId: string;
  branch:   { id: string; name: string };
  service:  { name: string; nameTh: string };
  staff:    { id: string; name: string } | null;
  customer: { id: string; name: string; phone: string };
}

interface Props {
  sales: SaleRecord[];
  branches: Branch[];
  allStaff: StaffItem[];
  allServices: ServiceItem[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIMARY = "#8B1D24";
const BG      = "#FDF7F2";
const BORDER  = "#E8D8CC";
const TEXT    = "#3B2A24";
const MUTED   = "#A08070";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "รอยืนยัน", CONFIRMED: "ยืนยันแล้ว",
  COMPLETED: "เสร็จสิ้น", CANCELLED: "ยกเลิก", NO_SHOW: "ไม่มา",
};
const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  PENDING:   { bg: "#FFF8E8", color: "#B45309" },
  CONFIRMED: { bg: "#ECFDF5", color: "#065F46" },
  COMPLETED: { bg: "#F0F4FF", color: "#1D4ED8" },
  CANCELLED: { bg: "#FEF2F2", color: "#991B1B" },
  NO_SHOW:   { bg: "#F5F3FF", color: "#6D28D9" },
};
const ALL_STATUSES = ["PENDING","CONFIRMED","COMPLETED","CANCELLED","NO_SHOW"];

function fmt(satang: number) {
  return `฿${(satang / 100).toLocaleString("th-TH")}`;
}

function toLocalStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

// ─── Portal ───────────────────────────────────────────────────────────────────

function Modal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────

interface EditModalProps {
  sale: SaleRecord;
  allStaff: StaffItem[];
  allServices: ServiceItem[];
  onClose: () => void;
  onSaved: (updated: SaleRecord) => void;
}

function EditModal({ sale, allStaff, allServices, onClose, onSaved }: EditModalProps) {
  const [status,    setStatus]    = useState(sale.status);
  const [price,     setPrice]     = useState(String(sale.totalPrice / 100));
  const [staffId,   setStaffId]   = useState(sale.staff?.id ?? "");
  const [notes,     setNotes]     = useState(sale.notes ?? "");
  const [startTime, setStartTime] = useState(sale.startTime);
  const [endTime,   setEndTime]   = useState(sale.endTime);
  const [serviceId, setServiceId] = useState(sale.serviceId);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState("");

  const branchStaff = allStaff.filter(s => s.branchId === sale.branchId);

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/bookings/${sale.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          totalPrice: Math.round(Number(price) * 100),
          staffId: staffId || null,
          notes: notes || null,
          startTime,
          endTime,
          serviceId,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "บันทึกไม่สำเร็จ");
      const updated = await res.json();
      onSaved({
        ...sale,
        status: updated.status,
        totalPrice: updated.totalPrice,
        staff: updated.staff ? { id: updated.staff.id, name: updated.staff.name } : null,
        notes: updated.notes,
        startTime: updated.startTime,
        endTime: updated.endTime,
        serviceId: updated.serviceId,
        service: { name: updated.service.name, nameTh: updated.service.nameTh },
      });
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setSaving(false);
    }
  }

  const dateLabel = new Date(sale.date).toLocaleDateString("th-TH", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  return (
    <Modal>
      <div
        className="fixed inset-0 flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.45)", zIndex: 99999 }}
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col" style={{ background: "white", maxHeight: "90vh" }}>
          {/* header */}
          <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: BORDER }}>
            <div>
              <h2 className="font-semibold text-sm" style={{ color: TEXT }}>แก้ไขรายการ</h2>
              <p className="text-xs mt-0.5" style={{ color: MUTED }}>
                {sale.customer.name} · #{sale.id.slice(-6).toUpperCase()}
              </p>
            </div>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
              <X size={18} color={MUTED} />
            </button>
          </div>

          {/* body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            {/* Customer quick link */}
            <Link
              href={`/admin/customers?id=${sale.customer.id}`}
              className="flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl hover:bg-blue-50 transition-colors"
              style={{ border: "1px solid #BFDBFE", background: "#EFF6FF", color: "#1D4ED8" }}
              onClick={onClose}
            >
              <span className="text-sm font-medium">ดูข้อมูลลูกค้า: {sale.customer.name}</span>
              <ExternalLink size={14} />
            </Link>

            {/* read-only info */}
            <div className="rounded-xl p-3 text-xs space-y-1" style={{ background: BG }}>
              <p style={{ color: MUTED }}>{dateLabel}</p>
              <p style={{ color: TEXT }}>{sale.branch.name} · {sale.customer.phone}</p>
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs mb-1 font-medium" style={{ color: MUTED }}>สถานะ</label>
              <div className="grid grid-cols-3 gap-2">
                {ALL_STATUSES.map(s => {
                  const st = STATUS_STYLE[s] ?? STATUS_STYLE.PENDING;
                  const active = status === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatus(s)}
                      className="px-2 py-1.5 rounded-xl text-xs font-medium border transition-all"
                      style={{
                        background: active ? st.bg : "white",
                        color: active ? st.color : MUTED,
                        borderColor: active ? st.color : BORDER,
                        fontWeight: active ? 600 : 400,
                      }}
                    >
                      {STATUS_LABEL[s]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Service */}
            <div>
              <label className="block text-xs mb-1 font-medium" style={{ color: MUTED }}>บริการ</label>
              <select
                value={serviceId}
                onChange={e => setServiceId(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border"
                style={{ borderColor: BORDER, color: TEXT }}
              >
                {allServices.map(s => (
                  <option key={s.id} value={s.id}>{s.nameTh || s.name}</option>
                ))}
              </select>
            </div>

            {/* Time */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs mb-1 font-medium" style={{ color: MUTED }}>เวลาเริ่ม</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border"
                  style={{ borderColor: BORDER, color: TEXT }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1 font-medium" style={{ color: MUTED }}>เวลาสิ้นสุด</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border"
                  style={{ borderColor: BORDER, color: TEXT }}
                />
              </div>
            </div>

            {/* Staff */}
            <div>
              <label className="block text-xs mb-1 font-medium" style={{ color: MUTED }}>ช่าง / พนักงาน</label>
              <select
                value={staffId}
                onChange={e => setStaffId(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border"
                style={{ borderColor: BORDER, color: TEXT }}
              >
                <option value="">— ไม่ระบุ —</option>
                {branchStaff.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Price */}
            <div>
              <label className="block text-xs mb-1 font-medium" style={{ color: MUTED }}>ยอดรวม (฿)</label>
              <input
                type="number"
                min="0"
                step="50"
                value={price}
                onChange={e => setPrice(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border"
                style={{ borderColor: BORDER, color: TEXT }}
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs mb-1 font-medium" style={{ color: MUTED }}>หมายเหตุ</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                placeholder="หมายเหตุเพิ่มเติม..."
                className="w-full px-3 py-2 text-sm rounded-xl border resize-none"
                style={{ borderColor: BORDER, color: TEXT }}
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>

          {/* footer */}
          <div className="px-6 py-4 border-t flex justify-end gap-3" style={{ borderColor: BORDER }}>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-xl border font-medium"
              style={{ borderColor: BORDER, color: MUTED }}
            >ยกเลิก</button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 text-sm rounded-xl font-medium text-white"
              style={{ background: saving ? MUTED : PRIMARY }}
            >
              <Save size={14} />
              {saving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─── Summary cards ────────────────────────────────────────────────────────────

function SummaryBar({ sales }: { sales: SaleRecord[] }) {
  const completed  = sales.filter(s => s.status === "COMPLETED");
  const revenue    = completed.reduce((sum, s) => sum + s.totalPrice, 0);
  const pending    = sales.filter(s => s.status === "PENDING" || s.status === "CONFIRMED").length;
  const cancelled  = sales.filter(s => s.status === "CANCELLED" || s.status === "NO_SHOW").length;

  const cards = [
    { label: "รายได้รวม (เสร็จสิ้น)", value: fmt(revenue), color: PRIMARY },
    { label: "รายการเสร็จสิ้น",       value: String(completed.length), color: "#1D4ED8" },
    { label: "รอดำเนินการ",           value: String(pending),          color: "#B45309" },
    { label: "ยกเลิก / ไม่มา",       value: String(cancelled),        color: "#991B1B" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {cards.map(c => (
        <div key={c.label} className="rounded-2xl p-4" style={{ background: "white", border: `1.5px solid ${BORDER}` }}>
          <p className="text-xs mb-1" style={{ color: MUTED }}>{c.label}</p>
          <p className="text-xl font-semibold" style={{ color: c.color }}>{c.value}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Date range presets ───────────────────────────────────────────────────────

type DatePreset = "today" | "week" | "month" | "last_month" | "all";

function getRange(preset: DatePreset): { from: string; to: string } | null {
  const now   = new Date();
  const today = toLocalStr(now);

  if (preset === "today") return { from: today, to: today };

  if (preset === "week") {
    const dow = now.getDay();
    const mon = new Date(now);
    mon.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
    return { from: toLocalStr(mon), to: today };
  }

  if (preset === "month") {
    return { from: `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01`, to: today };
  }

  if (preset === "last_month") {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const last = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: toLocalStr(d), to: toLocalStr(last) };
  }

  return null; // "all"
}

const PRESET_LABELS: Record<DatePreset, string> = {
  today:      "วันนี้",
  week:       "สัปดาห์นี้",
  month:      "เดือนนี้",
  last_month: "เดือนที่แล้ว",
  all:        "ทั้งหมด",
};

// ─── Main component ───────────────────────────────────────────────────────────

export default function SalesHistory({ sales: initial, branches, allStaff, allServices }: Props) {
  const router = useRouter();

  const [sales,      setSales]      = useState<SaleRecord[]>(initial);
  const [editing,    setEditing]    = useState<SaleRecord | null>(null);

  // filters
  const [branchId,  setBranchId]  = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [preset,    setPreset]    = useState<DatePreset>("month");
  const [search,    setSearch]    = useState("");

  // apply filters
  const filtered = useMemo(() => {
    const range = getRange(preset);
    return sales.filter(s => {
      if (branchId && s.branchId !== branchId) return false;
      if (statusFilter && s.status !== statusFilter) return false;
      if (range) {
        const d = s.date.slice(0, 10);
        if (d < range.from || d > range.to) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        if (
          !s.customer.name.toLowerCase().includes(q) &&
          !s.customer.phone.includes(q) &&
          !s.service.nameTh.toLowerCase().includes(q) &&
          !s.service.name.toLowerCase().includes(q) &&
          !s.id.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [sales, branchId, statusFilter, preset, search]);

  function handleSaved(updated: SaleRecord) {
    setSales(prev => prev.map(s => s.id === updated.id ? updated : s));
    router.refresh();
  }

  // group by date
  const byDate = useMemo(() => {
    const map = new Map<string, SaleRecord[]>();
    for (const s of filtered) {
      const d = s.date.slice(0, 10);
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(s);
    }
    return Array.from(map.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [filtered]);

  return (
    <div className="px-6 py-8 max-w-4xl">
      {/* header */}
      <div className="mb-6">
        <p className="text-xs uppercase tracking-widest mb-1" style={{ color: MUTED }}>Sales History</p>
        <h1 className="text-2xl font-medium" style={{ color: TEXT }}>ประวัติการขาย</h1>
      </div>

      {/* summary */}
      <SummaryBar sales={filtered} />

      {/* filters */}
      <div className="space-y-3 mb-6">
        {/* date presets */}
        <div className="flex gap-2 flex-wrap">
          {(Object.keys(PRESET_LABELS) as DatePreset[]).map(p => (
            <button
              key={p}
              onClick={() => setPreset(p)}
              className="text-sm px-4 py-1.5 rounded-full border transition-colors"
              style={
                preset === p
                  ? { background: PRIMARY, borderColor: PRIMARY, color: "white" }
                  : { background: "white", borderColor: BORDER, color: "#6B5245" }
              }
            >
              {PRESET_LABELS[p]}
            </button>
          ))}
        </div>

        <div className="flex gap-3 flex-wrap items-center">
          {/* branch */}
          <div className="relative">
            <select
              value={branchId}
              onChange={e => setBranchId(e.target.value)}
              className="appearance-none pl-3 pr-8 py-1.5 text-sm rounded-xl border"
              style={{ borderColor: BORDER, color: TEXT, background: "white" }}
            >
              <option value="">ทุกสาขา</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-2 top-2 pointer-events-none" color={MUTED} />
          </div>

          {/* status */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="appearance-none pl-3 pr-8 py-1.5 text-sm rounded-xl border"
              style={{ borderColor: BORDER, color: TEXT, background: "white" }}
            >
              <option value="">ทุกสถานะ</option>
              {ALL_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-2 top-2 pointer-events-none" color={MUTED} />
          </div>

          {/* search */}
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-2.5" color={MUTED} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="ค้นหาชื่อ, เบอร์, บริการ..."
              className="w-full pl-8 pr-3 py-1.5 text-sm rounded-xl border"
              style={{ borderColor: BORDER, color: TEXT }}
            />
          </div>

          <p className="text-xs ml-auto" style={{ color: MUTED }}>{filtered.length} รายการ</p>
        </div>
      </div>

      {/* list */}
      {byDate.length === 0 ? (
        <div className="text-center py-16 rounded-2xl bg-white" style={{ border: `1.5px solid ${BORDER}` }}>
          <p className="text-sm" style={{ color: MUTED }}>ไม่พบรายการ</p>
        </div>
      ) : (
        <div className="space-y-6">
          {byDate.map(([date, rows]) => {
            const dateRevenue = rows.filter(r => r.status === "COMPLETED").reduce((s, r) => s + r.totalPrice, 0);
            const dateLabel = new Date(date + "T12:00:00").toLocaleDateString("th-TH", {
              weekday: "long", day: "numeric", month: "long", year: "numeric",
            });
            return (
              <div key={date}>
                {/* date header */}
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: MUTED }}>
                    {dateLabel}
                  </p>
                  {dateRevenue > 0 && (
                    <p className="text-xs font-semibold" style={{ color: PRIMARY }}>{fmt(dateRevenue)}</p>
                  )}
                </div>

                {/* rows */}
                <div className="rounded-2xl overflow-hidden bg-white" style={{ border: `1.5px solid ${BORDER}` }}>
                  <div className="divide-y" style={{ borderColor: "#F5EFE9" }}>
                    {rows.map(sale => {
                      const sc = STATUS_STYLE[sale.status] ?? STATUS_STYLE.PENDING;
                      return (
                        <div key={sale.id} className="px-5 py-4 flex items-start justify-between gap-4 hover:bg-amber-50/30 transition-colors">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                              <Link
                                href={`/admin/customers?id=${sale.customer.id}`}
                                className="font-semibold text-sm hover:underline"
                                style={{ color: TEXT }}
                                title="ดูข้อมูลลูกค้า"
                              >
                                {sale.customer.name}
                              </Link>
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: sc.bg, color: sc.color }}>
                                {STATUS_LABEL[sale.status] ?? sale.status}
                              </span>
                            </div>
                            <p className="text-sm" style={{ color: "#6B5245" }}>
                              {sale.service.nameTh || sale.service.name}
                            </p>
                            <p className="text-xs mt-0.5" style={{ color: MUTED }}>
                              {sale.startTime}–{sale.endTime}
                              {sale.staff && ` · ${sale.staff.name}`}
                              {" · "}{sale.branch.name}
                            </p>
                            <p className="text-xs" style={{ color: MUTED }}>{sale.customer.phone}</p>
                            {sale.notes && (
                              <p className="text-xs mt-1 italic" style={{ color: MUTED }}>"{sale.notes}"</p>
                            )}
                          </div>

                          <div className="flex flex-col items-end gap-2 flex-shrink-0">
                            <p className="font-semibold text-sm" style={{ color: PRIMARY }}>{fmt(sale.totalPrice)}</p>
                            <p className="text-xs font-mono" style={{ color: "#C4B0A4" }}>#{sale.id.slice(-6).toUpperCase()}</p>
                            <button
                              onClick={() => setEditing(sale)}
                              className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium transition-colors hover:bg-blue-50"
                              style={{ color: "#2563EB", border: "1px solid #BFDBFE" }}
                            >
                              <Pencil size={11} />
                              แก้ไข
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <EditModal
          sale={editing}
          allStaff={allStaff}
          allServices={allServices}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
