"use client";

import { useState, useEffect, useMemo, Fragment } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createPortal } from "react-dom";
import { Pencil, Trash2, X, Save, Search, ChevronDown, ExternalLink, Calendar, Download } from "lucide-react";

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
  completedAt: string | null; // ISO UTC — when the service finished
  paidAt:      string | null; // ISO UTC — when payment was received (null = ยังไม่ชำระ)
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
  /** Number of trailing months the server loaded, or null when showing all. */
  windowMonths: number | null;
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

/** Quote a CSV cell (RFC-4180). Numbers stay unquoted so spreadsheets treat
 *  them as numeric; strings are quoted with embedded quotes doubled. */
function csvCell(v: string | number): string {
  if (typeof v === "number") return String(v);
  return `"${String(v ?? "").replace(/"/g, '""')}"`;
}

/** Convert UTC ISO → "YYYY-MM-DDTHH:mm" in Bangkok time (for datetime-local input) */
function utcToBkkInput(iso: string): string {
  const ms = new Date(iso).getTime() + 7 * 60 * 60 * 1000;
  return new Date(ms).toISOString().slice(0, 16);
}

/** Convert "YYYY-MM-DDTHH:mm" Bangkok time → UTC ISO string */
function bkkInputToUtc(local: string): string {
  return new Date(local + ":00+07:00").toISOString();
}

/** Format a UTC ISO string as Bangkok local date+time, e.g. "28 เม.ย. 14:36 น." */
function fmtInvoiceTime(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("th-TH", {
    timeZone: "Asia/Bangkok", day: "numeric", month: "short",
  });
  const time = d.toLocaleTimeString("th-TH", {
    timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hour12: false,
  });
  return `${date} · ${time} น.`;
}

function toLocalStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

/** YYYY-MM-DD in Bangkok time from a UTC ISO string. */
function bkkDateStr(iso: string): string {
  const ms = new Date(iso).getTime() + 7 * 60 * 60 * 1000;
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Date used for filtering and grouping in Sales History.
 *
 * Sales History is an accounting view, so for COMPLETED bookings we use the
 * payment timestamp (`paidAt`) — that's when the cash arrived. Unpaid-but-
 * finished bookings fall back to the completion time, and everything else
 * (pending / confirmed / cancelled / no-show) to the appointment date.
 */
function effectiveDateOf(s: SaleRecord): string {
  if (s.status === "COMPLETED") {
    const t = s.paidAt ?? s.completedAt;
    if (t) return bkkDateStr(t);
  }
  return s.date.slice(0, 10);
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
  const [status,      setStatus]      = useState(sale.status);
  const [date,        setDate]        = useState(sale.date.slice(0, 10));
  const [paidAt,      setPaidAt]      = useState(sale.paidAt ? utcToBkkInput(sale.paidAt) : "");
  const [price,       setPrice]       = useState(String(sale.totalPrice / 100));
  const [staffId,     setStaffId]     = useState(sale.staff?.id ?? "");
  const [notes,       setNotes]       = useState(sale.notes ?? "");
  const [startTime,   setStartTime]   = useState(sale.startTime);
  const [endTime,     setEndTime]     = useState(sale.endTime);
  const [serviceId,   setServiceId]   = useState(sale.serviceId);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState("");

  const branchStaff = allStaff.filter(s => s.branchId === sale.branchId);

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      // Only send paidAt when the admin actually edited the field — the modal
      // state can be stale (page revalidates every 30s; POS / slip confirm can
      // pay the booking while this tab is open), and an explicit paidAt in the
      // PATCH body always wins, so an untouched field must stay omitted.
      const initialPaidAt = sale.paidAt ? utcToBkkInput(sale.paidAt) : "";
      const res = await fetch(`/api/bookings/${sale.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          date,
          ...(paidAt !== initialPaidAt ? { paidAt: paidAt ? bkkInputToUtc(paidAt) : null } : {}),
          totalPrice: Math.round(Number(price) * 100),
          staffId: staffId || null,
          internalNotes: notes || null,
          startTime,
          endTime,
          serviceId,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "บันทึกไม่สำเร็จ");
      const updated = await res.json();
      onSaved({
        ...sale,
        status:      updated.status,
        date:        updated.date,
        completedAt: updated.completedAt,
        paidAt:      updated.paidAt,
        totalPrice:  updated.totalPrice,
        staff:       updated.staff ? { id: updated.staff.id, name: updated.staff.name } : null,
        notes:       updated.internalNotes,
        startTime:   updated.startTime,
        endTime:     updated.endTime,
        serviceId:   updated.serviceId,
        service:     { name: updated.service.name, nameTh: updated.service.nameTh },
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

            {/* Date + Time */}
            <div>
              <label className="block text-xs mb-1 font-medium" style={{ color: MUTED }}>วันที่นัด</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border"
                style={{ borderColor: BORDER, color: TEXT }}
              />
            </div>

            {/* Payment timestamp */}
            <div>
              <label className="block text-xs mb-1 font-medium" style={{ color: MUTED }}>
                💳 วันเวลาชำระเงิน <span className="font-normal">(เวลาไทย)</span>
              </label>
              <input
                type="datetime-local"
                value={paidAt}
                onChange={e => setPaidAt(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border"
                style={{ borderColor: BORDER, color: paidAt ? TEXT : MUTED }}
              />
              {!paidAt && (
                <p className="text-xs mt-1" style={{ color: MUTED }}>ว่างไว้ = ยังไม่ได้ชำระ</p>
              )}
            </div>
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
  const unpaid     = completed.filter(s => !s.paidAt);
  const unpaidSum  = unpaid.reduce((sum, s) => sum + s.totalPrice, 0);
  const pending    = sales.filter(s => s.status === "PENDING" || s.status === "CONFIRMED").length;
  const cancelled  = sales.filter(s => s.status === "CANCELLED" || s.status === "NO_SHOW").length;

  const cards: { label: string; value: string; color: string; sub?: string }[] = [
    { label: "รายได้รวม (เสร็จสิ้น)", value: fmt(revenue), color: PRIMARY,
      sub: unpaid.length > 0 ? `ยังไม่ชำระ ${fmt(unpaidSum)} · ${unpaid.length} รายการ` : undefined },
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
          {c.sub && <p className="text-[11px] mt-1 font-medium" style={{ color: "#B45309" }}>{c.sub}</p>}
        </div>
      ))}
    </div>
  );
}

// ─── Date range presets ───────────────────────────────────────────────────────

type DatePreset =
  | "today"
  | "yesterday"
  | "last7"
  | "last30"
  | "week"
  | "month"
  | "last_month"
  | "year"
  | "all"
  | "custom";

function getRange(
  preset: DatePreset,
  customFrom?: string,
  customTo?: string,
): { from: string; to: string } | null {
  const now   = new Date();
  const today = toLocalStr(now);

  if (preset === "today") return { from: today, to: today };

  if (preset === "yesterday") {
    const d = new Date(now); d.setDate(now.getDate() - 1);
    const y = toLocalStr(d);
    return { from: y, to: y };
  }

  if (preset === "last7") {
    const d = new Date(now); d.setDate(now.getDate() - 6); // inclusive of today = 7 days
    return { from: toLocalStr(d), to: today };
  }

  if (preset === "last30") {
    const d = new Date(now); d.setDate(now.getDate() - 29);
    return { from: toLocalStr(d), to: today };
  }

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
    const d    = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const last = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: toLocalStr(d), to: toLocalStr(last) };
  }

  if (preset === "year") {
    return { from: `${now.getFullYear()}-01-01`, to: today };
  }

  if (preset === "custom") {
    if (!customFrom && !customTo) return null;
    const from = customFrom || "1970-01-01";
    const to   = customTo   || today;
    // Normalize so from <= to
    return from <= to ? { from, to } : { from: to, to: from };
  }

  return null; // "all"
}

const PRESET_LABELS: Record<DatePreset, string> = {
  today:      "วันนี้",
  yesterday:  "เมื่อวาน",
  last7:      "7 วันล่าสุด",
  last30:     "30 วันล่าสุด",
  week:       "สัปดาห์นี้",
  month:      "เดือนนี้",
  last_month: "เดือนที่แล้ว",
  year:       "ปีนี้",
  all:        "ทั้งหมด",
  custom:     "กำหนดเอง",
};

// ─── Main component ───────────────────────────────────────────────────────────

export default function SalesHistory({ sales: initial, branches, allStaff, allServices, windowMonths }: Props) {
  const router = useRouter();

  const [sales,      setSales]      = useState<SaleRecord[]>(initial);
  const [editing,    setEditing]    = useState<SaleRecord | null>(null);
  const [deleteId,   setDeleteId]   = useState<string | null>(null);
  const [deleting,   setDeleting]   = useState(false);

  // filters
  const [branchId,  setBranchId]  = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [preset,    setPreset]    = useState<DatePreset>("month");
  const [search,    setSearch]    = useState("");

  // Custom range state — defaults to month-to-date when first opened.
  const [customFrom, setCustomFrom] = useState<string>(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [customTo, setCustomTo] = useState<string>(() => toLocalStr(new Date()));

  // apply filters
  const filtered = useMemo(() => {
    const range = getRange(preset, customFrom, customTo);
    return sales.filter(s => {
      if (branchId && s.branchId !== branchId) return false;
      if (statusFilter && s.status !== statusFilter) return false;
      if (range) {
        const d = effectiveDateOf(s);
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
  }, [sales, branchId, statusFilter, preset, search, customFrom, customTo]);

  /** Export the currently-filtered rows to a CSV (opens in Excel / Sheets).
   *  UTF-8 BOM so Excel renders Thai; amounts as plain numbers (in baht). */
  function handleExport() {
    if (filtered.length === 0) return;
    const headers = ["วันที่", "เวลา", "สาขา", "ลูกค้า", "เบอร์โทร", "บริการ", "ช่าง", "สถานะ", "ยอด (บาท)", "ชำระเมื่อ", "หมายเหตุ", "รหัส"];
    const rows = filtered.map(s => [
      effectiveDateOf(s),
      `${s.startTime}-${s.endTime}`,
      s.branch.name,
      s.customer.name,
      s.customer.phone,
      s.service.nameTh || s.service.name,
      s.staff?.name ?? "-",
      STATUS_LABEL[s.status] ?? s.status,
      s.totalPrice / 100,
      s.paidAt ? utcToBkkInput(s.paidAt).replace("T", " ") : "",
      (s.notes ?? "").replace(/\s+/g, " ").trim(),
      s.id,
    ]);
    const csv = "﻿" + [headers, ...rows].map(r => r.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `errday-sales-${toLocalStr(new Date())}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function handleSaved(updated: SaleRecord) {
    setSales(prev => prev.map(s => s.id === updated.id ? updated : s));
    router.refresh();
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await fetch(`/api/bookings/${deleteId}`, { method: "DELETE" });
      setSales(prev => prev.filter(s => s.id !== deleteId));
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  }

  // group by effective date (payment date for completed sales, else appointment date)
  const byDate = useMemo(() => {
    const map = new Map<string, SaleRecord[]>();
    for (const s of filtered) {
      const d = effectiveDateOf(s);
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(s);
    }
    return Array.from(map.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [filtered]);

  return (
    <div className="px-6 py-8 max-w-7xl">
      {/* header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
        <p className="text-xs uppercase tracking-widest mb-1" style={{ color: MUTED }}>Sales History</p>
        <h1 className="text-2xl font-medium" style={{ color: TEXT }}>ประวัติการขาย</h1>
        <p className="text-xs mt-1" style={{ color: MUTED }}>
          💡 คลิกที่แถวเพื่อแก้ไขรายการ หรือใช้ปุ่ม &ldquo;แก้ไข&rdquo; / &ldquo;ลบ&rdquo; ด้านขวา
        </p>
        <p className="text-xs mt-1" style={{ color: MUTED }}>
          {windowMonths != null ? (
            <>
              📅 แสดงข้อมูล {windowMonths} เดือนล่าสุด ·{" "}
              <Link href="?range=all" prefetch={false} className="underline" style={{ color: PRIMARY }}>
                ดูทั้งหมด
              </Link>
            </>
          ) : (
            <>
              📅 แสดงข้อมูลทั้งหมด ·{" "}
              <Link href="?" prefetch={false} className="underline" style={{ color: PRIMARY }}>
                แสดง 12 เดือนล่าสุด
              </Link>
            </>
          )}
        </p>
        </div>
        <button
          onClick={handleExport}
          disabled={filtered.length === 0}
          className="flex-shrink-0 inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-xl text-white disabled:opacity-40"
          style={{ background: PRIMARY }}
          title="ส่งออกรายการที่กรองไว้เป็นไฟล์ Excel/CSV"
        >
          <Download size={15} /> ส่งออก Excel ({filtered.length})
        </button>
      </div>

      {/* summary */}
      <SummaryBar sales={filtered} />

      {/* filters */}
      <div className="space-y-3 mb-6">
        {/* date presets */}
        <div className="flex gap-2 flex-wrap">
          {(Object.keys(PRESET_LABELS) as DatePreset[]).map(p => {
            const isCustom = p === "custom";
            return (
              <button
                key={p}
                onClick={() => setPreset(p)}
                className="text-sm px-4 py-1.5 rounded-full border transition-colors flex items-center gap-1.5"
                style={
                  preset === p
                    ? { background: PRIMARY, borderColor: PRIMARY, color: "white" }
                    : { background: "white", borderColor: BORDER, color: "#6B5245" }
                }
              >
                {isCustom && <Calendar size={12} />}
                {PRESET_LABELS[p]}
              </button>
            );
          })}
        </div>

        {/* Custom date range — visible only when "custom" preset is active */}
        {preset === "custom" && (
          <div
            className="flex items-center gap-3 flex-wrap rounded-xl px-4 py-3"
            style={{ background: BG, border: `1px solid ${BORDER}` }}
          >
            <span className="text-xs font-medium" style={{ color: MUTED }}>ช่วงวันที่:</span>
            <div className="flex items-center gap-2">
              <label className="text-xs" style={{ color: MUTED }}>จาก</label>
              <input
                type="date"
                value={customFrom}
                onChange={e => setCustomFrom(e.target.value)}
                max={customTo || undefined}
                className="px-3 py-1.5 text-sm rounded-lg border bg-white"
                style={{ borderColor: BORDER, color: TEXT }}
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs" style={{ color: MUTED }}>ถึง</label>
              <input
                type="date"
                value={customTo}
                onChange={e => setCustomTo(e.target.value)}
                min={customFrom || undefined}
                className="px-3 py-1.5 text-sm rounded-lg border bg-white"
                style={{ borderColor: BORDER, color: TEXT }}
              />
            </div>
            {(() => {
              if (!customFrom || !customTo) return null;
              const from = new Date(customFrom + "T00:00:00");
              const to   = new Date(customTo   + "T00:00:00");
              const days = Math.abs(Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))) + 1;
              return (
                <span className="text-xs ml-auto" style={{ color: MUTED }}>
                  {days} วัน
                </span>
              );
            })()}
          </div>
        )}

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

      {/* table */}
      {byDate.length === 0 ? (
        <div className="text-center py-16 rounded-2xl bg-white" style={{ border: `1.5px solid ${BORDER}` }}>
          <p className="text-sm" style={{ color: MUTED }}>ไม่พบรายการ</p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-x-auto" style={{ border: `1.5px solid ${BORDER}` }}>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr style={{ background: "#F9F0EA", borderBottom: `1.5px solid ${BORDER}` }}>
                {["เวลา","ลูกค้า","บริการ","ช่าง","สาขา","สถานะ","ยอด","การจัดการ"].map(h => (
                  <th
                    key={h}
                    className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-widest whitespace-nowrap"
                    style={{ color: MUTED }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {byDate.map(([date, rows]) => {
                const dateRevenue = rows.filter(r => r.status === "COMPLETED").reduce((s, r) => s + r.totalPrice, 0);
                const dateLabel = new Date(date + "T12:00:00").toLocaleDateString("th-TH", {
                  weekday: "short", day: "numeric", month: "short", year: "numeric",
                });
                return (
                  <Fragment key={`grp-${date}`}>
                    {/* Day separator row */}
                    <tr style={{ background: "#F9F0EA", borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` }}>
                      <td colSpan={6} className="px-4 py-1.5">
                        <span className="text-xs font-semibold" style={{ color: TEXT }}>{dateLabel}</span>
                      </td>
                      <td className="px-4 py-1.5 text-right whitespace-nowrap">
                        {dateRevenue > 0 && (
                          <span className="text-xs font-bold" style={{ color: PRIMARY }}>{fmt(dateRevenue)}</span>
                        )}
                      </td>
                      <td />
                    </tr>

                    {/* Sale rows */}
                    {rows.map((sale, ri) => {
                      const sc = STATUS_STYLE[sale.status] ?? STATUS_STYLE.PENDING;
                      return (
                        <tr
                          key={sale.id}
                          onClick={() => setEditing(sale)}
                          className="transition-colors hover:bg-amber-50/60 cursor-pointer"
                          title="คลิกเพื่อแก้ไขรายการ"
                          style={{
                            background: ri % 2 === 0 ? "white" : "#FDFAF8",
                            borderBottom: `1px solid ${BORDER}`,
                          }}
                        >
                          {/* Time */}
                          <td className="px-4 py-3 whitespace-nowrap align-top">
                            <p className="text-xs font-semibold" style={{ color: PRIMARY }}>
                              {sale.startTime}
                            </p>
                            <p className="text-[10px]" style={{ color: MUTED }}>{sale.endTime}</p>
                            {sale.paidAt ? (
                              <p className="text-[10px] mt-0.5" style={{ color: "#16a34a" }}>
                                💳 {fmtInvoiceTime(sale.paidAt)}
                              </p>
                            ) : sale.status === "COMPLETED" ? (
                              <p className="text-[10px] mt-0.5 font-semibold" style={{ color: "#B45309" }}>
                                ยังไม่ชำระ
                              </p>
                            ) : null}
                          </td>

                          {/* Customer */}
                          <td className="px-4 py-3 align-top">
                            <Link
                              href={`/admin/customers?id=${sale.customer.id}`}
                              onClick={e => e.stopPropagation()}
                              className="font-semibold text-sm hover:underline block"
                              style={{ color: TEXT }}
                            >
                              {sale.customer.name}
                            </Link>
                            <p className="text-[11px]" style={{ color: MUTED }}>{sale.customer.phone}</p>
                            {effectiveDateOf(sale) !== sale.date.slice(0, 10) && (
                              <p className="text-[10px] mt-0.5" style={{ color: MUTED }}>
                                📅 นัด {new Date(sale.date).toLocaleDateString("th-TH", {
                                  timeZone: "Asia/Bangkok", day: "numeric", month: "short",
                                })}
                              </p>
                            )}
                          </td>

                          {/* Service */}
                          <td className="px-4 py-3 align-top">
                            <p className="text-sm" style={{ color: "#6B5245" }}>
                              {sale.service.nameTh || sale.service.name}
                            </p>
                            {sale.notes && (
                              <p className="text-[11px] italic mt-0.5" style={{ color: MUTED }}>
                                &ldquo;{sale.notes}&rdquo;
                              </p>
                            )}
                          </td>

                          {/* Staff */}
                          <td className="px-4 py-3 whitespace-nowrap align-top">
                            <p className="text-sm" style={{ color: TEXT }}>
                              {sale.staff?.name ?? <span style={{ color: MUTED }}>—</span>}
                            </p>
                          </td>

                          {/* Branch */}
                          <td className="px-4 py-3 whitespace-nowrap align-top">
                            <p className="text-xs" style={{ color: MUTED }}>{sale.branch.name}</p>
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3 whitespace-nowrap align-top">
                            <span
                              className="text-xs px-2 py-0.5 rounded-full font-medium"
                              style={{ background: sc.bg, color: sc.color }}
                            >
                              {STATUS_LABEL[sale.status] ?? sale.status}
                            </span>
                          </td>

                          {/* Price */}
                          <td className="px-4 py-3 whitespace-nowrap text-right align-top">
                            <p className="font-semibold text-sm" style={{ color: PRIMARY }}>{fmt(sale.totalPrice)}</p>
                            <p className="text-[10px] font-mono" style={{ color: "#C4B0A4" }}>
                              #{sale.id.slice(-6).toUpperCase()}
                            </p>
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3 whitespace-nowrap align-top">
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={e => { e.stopPropagation(); setEditing(sale); }}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors hover:bg-blue-50"
                                style={{ color: "#2563EB", border: "1.5px solid #BFDBFE", background: "#F0F7FF" }}
                              >
                                <Pencil size={12} /> แก้ไข
                              </button>
                              <button
                                onClick={e => { e.stopPropagation(); setDeleteId(sale.id); }}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors hover:bg-red-50"
                                style={{ color: "#DC2626", border: "1.5px solid #FECACA", background: "#FEF5F5" }}
                              >
                                <Trash2 size={12} /> ลบ
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
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

      {/* Delete confirm modal */}
      {deleteId && (
        <Modal>
          <div
            className="fixed inset-0 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.45)", zIndex: 99999 }}
            onClick={() => { if (!deleting) setDeleteId(null); }}
          >
            <div
              className="w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden"
              style={{ background: "white" }}
              onClick={e => e.stopPropagation()}
            >
              <div className="px-6 py-5">
                <div className="w-10 h-10 rounded-full flex items-center justify-center mb-4" style={{ background: "#FEF2F2" }}>
                  <Trash2 size={18} color="#DC2626" />
                </div>
                <h2 className="font-semibold text-base mb-1" style={{ color: TEXT }}>ลบรายการนี้?</h2>
                <p className="text-sm" style={{ color: MUTED }}>
                  รายการจะถูกลบออกจากระบบถาวร ไม่สามารถกู้คืนได้
                </p>
              </div>
              <div className="px-6 pb-5 flex gap-3">
                <button
                  onClick={() => setDeleteId(null)}
                  disabled={deleting}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium border"
                  style={{ borderColor: BORDER, color: MUTED }}
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-60"
                  style={{ background: "#DC2626" }}
                >
                  {deleting ? "กำลังลบ..." : "ยืนยันลบ"}
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
