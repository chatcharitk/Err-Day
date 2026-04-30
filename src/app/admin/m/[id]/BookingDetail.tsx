"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Phone, Clock, User, Plus, Trash2, Check, X,
  CheckCircle2, XCircle, Calendar, Pencil, Loader2, CreditCard,
  AlertCircle, Sparkles, RefreshCw,
} from "lucide-react";

const PRIMARY = "#8B1D24";
const TEXT    = "#3B2A24";
const MUTED   = "#A08070";
const BORDER  = "#E8D8CC";

type Status = "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED" | "NO_SHOW";

interface Booking {
  id:            string;
  branchId:      string;
  branchName:    string;
  serviceId:     string;
  serviceName:   string;
  staffId:       string | null;
  staffName:     string | null;
  customerName:  string;
  customerNickname: string | null;
  customerPhone: string;
  date:          string;
  startTime:     string;
  endTime:       string;
  status:        Status;
  totalPrice:    number;
  notes:         string | null;
  addons: { id: string; addonId: string; name: string; price: number }[];
}

interface Service {
  id:       string;
  nameTh:   string;
  price:    number;
  duration: number;
}

interface Staff { id: string; name: string; }

interface Addon { id: string; nameTh: string; price: number; }

interface Props {
  booking:        Booking;
  branchServices: Service[];
  branchStaff:    Staff[];
  allAddons:      Addon[];
}

const STATUS_META: Record<Status, { label: string; bg: string; fg: string }> = {
  PENDING:   { label: "รอยืนยัน",    bg: "#FFF7ED", fg: "#9A3412" },
  CONFIRMED: { label: "ยืนยันแล้ว",   bg: "#EFF6FF", fg: "#1D4ED8" },
  COMPLETED: { label: "เสร็จสิ้น",    bg: "#F0FDF4", fg: "#166534" },
  CANCELLED: { label: "ยกเลิก",        bg: "#F3F4F6", fg: "#6B7280" },
  NO_SHOW:   { label: "ไม่มา",          bg: "#FEF2F2", fg: "#991B1B" },
};

function formatPrice(satang: number) { return `฿${(satang / 100).toLocaleString()}`; }

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export default function BookingDetail({ booking: initial, branchServices, branchStaff, allAddons }: Props) {
  const router = useRouter();
  const [b, setB] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState("");
  const [isRefreshing, startRefresh] = useTransition();
  const handleRefresh = () => startRefresh(() => router.refresh());

  const [showAddonSheet, setShowAddonSheet] = useState(false);
  const [showStaffSheet, setShowStaffSheet] = useState(false);
  const [showServiceSheet, setShowServiceSheet] = useState(false);
  const [showTimeEditor, setShowTimeEditor] = useState(false);

  const [editStart, setEditStart] = useState(b.startTime);
  const [notesDraft, setNotesDraft] = useState(b.notes ?? "");
  const [savingNotes, setSavingNotes] = useState(false);

  const meta = STATUS_META[b.status];
  const isClosed = b.status === "COMPLETED" || b.status === "CANCELLED" || b.status === "NO_SHOW";

  /** Patch a booking field via the existing PATCH /api/bookings/[id] route. */
  const patch = async (data: Record<string, unknown>) => {
    setBusy(true); setErr("");
    try {
      const res = await fetch(`/api/bookings/${b.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) { setErr(json.error ?? "Failed"); return null; }
      return json;
    } finally { setBusy(false); }
  };

  /** Optimistic-ish: refresh from server after status change to capture related computed fields. */
  const setStatus = async (status: Status) => {
    const updated = await patch({ status });
    if (!updated) return;
    setB((x) => ({ ...x, status }));
  };

  const setStaff = async (staffId: string | null) => {
    const updated = await patch({ staffId });
    if (!updated) return;
    const newStaff = staffId ? branchStaff.find((s) => s.id === staffId) : null;
    setB((x) => ({ ...x, staffId, staffName: newStaff?.name ?? null }));
    setShowStaffSheet(false);
  };

  const setService = async (svcId: string) => {
    const svc = branchServices.find((s) => s.id === svcId);
    if (!svc) return;
    const newEnd = addMinutes(b.startTime, svc.duration);
    // Recompute price = service base + sum of addons
    const addonsTotal = b.addons.reduce((s, a) => s + a.price, 0);
    const newTotal    = svc.price + addonsTotal;
    const updated = await patch({
      serviceId: svcId,
      endTime:   newEnd,
      totalPrice: newTotal,
    });
    if (!updated) return;
    setB((x) => ({
      ...x,
      serviceId:  svcId,
      serviceName: svc.nameTh,
      endTime:    newEnd,
      totalPrice: newTotal,
    }));
    setShowServiceSheet(false);
  };

  const updateTime = async () => {
    if (!editStart) return;
    // duration = current end - current start; preserve duration
    const [sh, sm] = b.startTime.split(":").map(Number);
    const [eh, em] = b.endTime.split(":").map(Number);
    const dur = (eh * 60 + em) - (sh * 60 + sm);
    const newEnd = addMinutes(editStart, dur);
    const updated = await patch({ startTime: editStart, endTime: newEnd });
    if (!updated) return;
    setB((x) => ({ ...x, startTime: editStart, endTime: newEnd }));
    setShowTimeEditor(false);
  };

  const addAddon = async (addonId: string) => {
    setBusy(true); setErr("");
    try {
      const res = await fetch(`/api/admin/bookings/${b.id}/addons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addonId }),
      });
      const json = await res.json();
      if (!res.ok) { setErr(json.error ?? "Failed"); return; }
      const addon = allAddons.find((a) => a.id === addonId);
      if (!addon) return;
      setB((x) => ({
        ...x,
        addons: [...x.addons, { id: json.addons.find((aa: { addonId: string }) => aa.addonId === addonId)?.id ?? "", addonId, name: addon.nameTh, price: addon.price }],
        totalPrice: x.totalPrice + addon.price,
      }));
      setShowAddonSheet(false);
      router.refresh();
    } finally { setBusy(false); }
  };

  const removeAddon = async (bookingAddonId: string) => {
    setBusy(true); setErr("");
    try {
      const res = await fetch(`/api/admin/bookings/${b.id}/addons/${bookingAddonId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) { setErr(json.error ?? "Failed"); return; }
      const removed = b.addons.find((a) => a.id === bookingAddonId);
      setB((x) => ({
        ...x,
        addons: x.addons.filter((a) => a.id !== bookingAddonId),
        totalPrice: x.totalPrice - (removed?.price ?? 0),
      }));
      router.refresh();
    } finally { setBusy(false); }
  };

  const saveNotes = async () => {
    setSavingNotes(true);
    await patch({ notes: notesDraft });
    setSavingNotes(false);
    setB((x) => ({ ...x, notes: notesDraft }));
  };

  const goToPos = () => {
    const url = `/admin/pos?customerPhone=${encodeURIComponent(b.customerPhone)}&customerName=${encodeURIComponent(b.customerName)}&bookingId=${b.id}`;
    router.push(url);
  };

  return (
    <main className="pb-32">
      {/* ── Header ── */}
      <header className="sticky top-0 z-20 bg-white" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <div className="px-4 py-3 flex items-center gap-2">
          <button onClick={() => router.back()} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ color: TEXT }}>
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-xs" style={{ color: MUTED }}>การจอง</p>
            <p className="text-sm font-medium truncate" style={{ color: TEXT }}>
              {b.customerNickname || b.customerName}
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            aria-label="รีเฟรช"
            className="w-9 h-9 rounded-full flex items-center justify-center disabled:opacity-60"
            style={{ color: TEXT }}
          >
            <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
          </button>
          <span
            className="text-[10px] px-2 py-1 rounded-full font-medium"
            style={{ background: meta.bg, color: meta.fg }}
          >
            {meta.label}
          </span>
        </div>
      </header>

      {err && (
        <div className="mx-4 mt-3 p-3 rounded-xl flex items-center gap-2 text-xs" style={{ background: "#FEF2F2", color: "#991b1b" }}>
          <AlertCircle size={14} /> {err}
        </div>
      )}

      {/* ── Quick status actions ── */}
      <section className="px-4 pt-4">
        <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: MUTED }}>เปลี่ยนสถานะ</p>
        <div className="grid grid-cols-2 gap-2">
          <ActionPill
            label="ยืนยันแล้ว"
            icon={<Check size={14} />}
            active={b.status === "CONFIRMED"}
            color="#1D4ED8"
            disabled={busy}
            onClick={() => setStatus("CONFIRMED")}
          />
          <ActionPill
            label="เสร็จสิ้น"
            icon={<CheckCircle2 size={14} />}
            active={b.status === "COMPLETED"}
            color="#166534"
            disabled={busy}
            onClick={() => setStatus("COMPLETED")}
          />
          <ActionPill
            label="ไม่มา"
            icon={<XCircle size={14} />}
            active={b.status === "NO_SHOW"}
            color="#991B1B"
            disabled={busy}
            onClick={() => setStatus("NO_SHOW")}
          />
          <ActionPill
            label="ยกเลิก"
            icon={<X size={14} />}
            active={b.status === "CANCELLED"}
            color="#6B7280"
            disabled={busy}
            onClick={() => setStatus("CANCELLED")}
          />
        </div>

        {/* POS shortcut */}
        {!isClosed && (
          <button
            onClick={goToPos}
            className="w-full mt-2 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium text-white"
            style={{ background: PRIMARY }}
          >
            <CreditCard size={16} />
            ไปหน้า POS เพื่อรับชำระ
          </button>
        )}
      </section>

      {/* ── Booking details rows ── */}
      <section className="px-4 mt-5">
        <div className="rounded-2xl bg-white" style={{ border: `1px solid ${BORDER}` }}>
          <Row label="ลูกค้า">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium" style={{ color: TEXT }}>
                {b.customerName}
                {b.customerNickname && <span className="font-normal" style={{ color: MUTED }}> · {b.customerNickname}</span>}
              </p>
              <a href={`tel:${b.customerPhone}`} className="text-xs flex items-center gap-1 mt-0.5" style={{ color: PRIMARY }}>
                <Phone size={11} /> {b.customerPhone}
              </a>
            </div>
          </Row>

          <Divider />

          <Row label="เวลา" onClick={() => { setEditStart(b.startTime); setShowTimeEditor(true); }}>
            <div className="flex items-center justify-between flex-1">
              <p className="text-sm flex items-center gap-1.5" style={{ color: TEXT }}>
                <Clock size={13} style={{ color: MUTED }} />
                {b.startTime} — {b.endTime}
              </p>
              <Pencil size={13} style={{ color: MUTED }} />
            </div>
          </Row>

          <Divider />

          <Row label="วันที่">
            <div className="flex-1">
              <p className="text-sm flex items-center gap-1.5" style={{ color: TEXT }}>
                <Calendar size={13} style={{ color: MUTED }} />
                {formatDateThai(b.date)}
              </p>
            </div>
          </Row>

          <Divider />

          <Row label="สาขา">
            <p className="text-sm flex-1" style={{ color: TEXT }}>{b.branchName}</p>
          </Row>

          <Divider />

          <Row label="บริการ" onClick={() => setShowServiceSheet(true)}>
            <div className="flex items-center justify-between flex-1">
              <p className="text-sm" style={{ color: TEXT }}>{b.serviceName}</p>
              <Pencil size={13} style={{ color: MUTED }} />
            </div>
          </Row>

          <Divider />

          <Row label="ช่าง" onClick={() => setShowStaffSheet(true)}>
            <div className="flex items-center justify-between flex-1">
              <p className="text-sm flex items-center gap-1.5" style={{ color: TEXT }}>
                <User size={13} style={{ color: MUTED }} />
                {b.staffName ?? <span style={{ color: MUTED }}>ไม่ระบุ</span>}
              </p>
              <Pencil size={13} style={{ color: MUTED }} />
            </div>
          </Row>
        </div>
      </section>

      {/* ── Add-ons ── */}
      <section className="px-4 mt-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>บริการเสริม</p>
          <button
            onClick={() => setShowAddonSheet(true)}
            className="text-xs flex items-center gap-1 font-medium"
            style={{ color: PRIMARY }}
          >
            <Plus size={12} /> เพิ่ม
          </button>
        </div>
        {b.addons.length === 0 ? (
          <p className="text-xs px-4 py-3 rounded-xl bg-white text-center" style={{ color: MUTED, border: `1px dashed ${BORDER}` }}>
            ยังไม่มีบริการเสริม
          </p>
        ) : (
          <ul className="space-y-1.5">
            {b.addons.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between rounded-xl bg-white px-4 py-2.5"
                style={{ border: `1px solid ${BORDER}` }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Sparkles size={12} style={{ color: PRIMARY }} />
                  <p className="text-sm truncate" style={{ color: TEXT }}>{a.name}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-sm font-medium" style={{ color: PRIMARY }}>+{formatPrice(a.price)}</span>
                  <button
                    onClick={() => removeAddon(a.id)}
                    aria-label="ลบ"
                    className="p-1"
                    style={{ color: MUTED }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Total ── */}
      <section className="px-4 mt-5">
        <div className="rounded-2xl px-4 py-3 flex items-center justify-between" style={{ background: "#FFF8F4", border: `1px solid ${BORDER}` }}>
          <p className="text-sm font-medium" style={{ color: TEXT }}>ยอดรวม</p>
          <p className="text-xl font-bold" style={{ color: PRIMARY }}>{formatPrice(b.totalPrice)}</p>
        </div>
      </section>

      {/* ── Notes ── */}
      <section className="px-4 mt-5">
        <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: MUTED }}>หมายเหตุ</p>
        <textarea
          value={notesDraft}
          onChange={(e) => setNotesDraft(e.target.value)}
          placeholder="พิมพ์หมายเหตุ..."
          rows={3}
          className="w-full rounded-xl px-4 py-3 text-sm outline-none bg-white"
          style={{ border: `1px solid ${BORDER}`, color: TEXT, resize: "none" }}
        />
        {notesDraft !== (b.notes ?? "") && (
          <button
            onClick={saveNotes}
            disabled={savingNotes}
            className="mt-2 w-full py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: PRIMARY }}
          >
            {savingNotes && <Loader2 size={14} className="animate-spin" />}
            บันทึกหมายเหตุ
          </button>
        )}
      </section>

      {/* ── Bottom sheets ── */}
      {showAddonSheet && (
        <BottomSheet title="เพิ่มบริการเสริม" onClose={() => setShowAddonSheet(false)}>
          {allAddons.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: MUTED }}>ยังไม่มีบริการเสริมในระบบ</p>
          ) : (
            <ul className="p-3 max-h-96 overflow-y-auto space-y-1">
              {allAddons.map((a) => {
                const already = b.addons.some((x) => x.addonId === a.id);
                return (
                  <li key={a.id}>
                    <button
                      onClick={() => !already && addAddon(a.id)}
                      disabled={already || busy}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-left disabled:opacity-50"
                      style={{ background: already ? "#F0FDF4" : "transparent", color: TEXT }}
                    >
                      <span className="text-sm">{a.nameTh}</span>
                      <span className="flex items-center gap-2 text-sm font-medium" style={{ color: already ? "#166534" : PRIMARY }}>
                        +{formatPrice(a.price)} {already && <Check size={14} />}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </BottomSheet>
      )}

      {showStaffSheet && (
        <BottomSheet title="เลือกช่าง" onClose={() => setShowStaffSheet(false)}>
          <ul className="p-3 max-h-96 overflow-y-auto space-y-1">
            <li>
              <button
                onClick={() => setStaff(null)}
                disabled={busy}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-left"
                style={{ background: b.staffId === null ? "#FFF8F4" : "transparent", color: TEXT }}
              >
                <span className="text-sm" style={{ color: MUTED }}>ไม่ระบุ</span>
                {b.staffId === null && <Check size={14} style={{ color: PRIMARY }} />}
              </button>
            </li>
            {branchStaff.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => setStaff(s.id)}
                  disabled={busy}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-left"
                  style={{ background: b.staffId === s.id ? "#FFF8F4" : "transparent", color: TEXT }}
                >
                  <span className="text-sm">{s.name}</span>
                  {b.staffId === s.id && <Check size={14} style={{ color: PRIMARY }} />}
                </button>
              </li>
            ))}
          </ul>
        </BottomSheet>
      )}

      {showServiceSheet && (
        <BottomSheet title="เปลี่ยนบริการหลัก" onClose={() => setShowServiceSheet(false)}>
          <ul className="p-3 max-h-96 overflow-y-auto space-y-1">
            {branchServices.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => setService(s.id)}
                  disabled={busy}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-left"
                  style={{ background: b.serviceId === s.id ? "#FFF8F4" : "transparent", color: TEXT }}
                >
                  <span className="text-sm">{s.nameTh}</span>
                  <span className="text-sm font-medium" style={{ color: PRIMARY }}>{formatPrice(s.price)}</span>
                </button>
              </li>
            ))}
          </ul>
        </BottomSheet>
      )}

      {showTimeEditor && (
        <BottomSheet title="เปลี่ยนเวลา" onClose={() => setShowTimeEditor(false)}>
          <div className="p-5">
            <p className="text-xs mb-2" style={{ color: MUTED }}>เวลาเริ่ม (รักษาระยะเวลาเดิม)</p>
            <input
              type="time"
              value={editStart}
              onChange={(e) => setEditStart(e.target.value)}
              className="w-full border rounded-xl px-4 py-3 text-base outline-none"
              style={{ borderColor: BORDER, color: TEXT }}
            />
            <button
              onClick={updateTime}
              disabled={busy || !editStart}
              className="mt-4 w-full py-3 rounded-xl text-white font-semibold disabled:opacity-50"
              style={{ background: PRIMARY }}
            >
              บันทึก
            </button>
          </div>
        </BottomSheet>
      )}
    </main>
  );
}

/* Helpers ─────────────────────────────────────────────────────── */

function ActionPill(
  { label, icon, active, color, onClick, disabled }: {
    label: string; icon: React.ReactNode;
    active: boolean; color: string;
    onClick: () => void; disabled?: boolean;
  },
) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-medium disabled:opacity-50"
      style={{
        background: active ? color : "white",
        color:      active ? "white" : color,
        border:     `1.5px solid ${color}`,
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function Row({ label, children, onClick }: { label: string; children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3.5 text-left disabled:opacity-100 disabled:cursor-default"
      disabled={!onClick}
      style={{ minHeight: 56 }}
    >
      <span className="text-xs flex-shrink-0 w-12" style={{ color: MUTED }}>{label}</span>
      {children}
    </button>
  );
}

function Divider() {
  return <div className="mx-4" style={{ borderTop: `1px solid #F5EFE9` }} />;
}

function BottomSheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-t-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${BORDER}` }}>
          <p className="font-medium" style={{ color: TEXT }}>{title}</p>
          <button onClick={onClose} className="p-1" style={{ color: MUTED }}>
            <X size={18} />
          </button>
        </div>
        {children}
        <div className="h-4" />
      </div>
    </div>
  );
}

/** "2026-04-30" → "พฤ. 30 เม.ย." */
function formatDateThai(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("th-TH", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });
}

