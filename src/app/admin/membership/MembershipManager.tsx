"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Users, CheckCircle, XCircle, Clock, Hourglass, History as HistoryIcon, Search, ShoppingCart, Pencil, Trash2, Save, X } from "lucide-react";

const PRIMARY = "#8B1D24";
const BORDER  = "#E8D8CC";
const TEXT    = "#3B2A24";
const MUTED   = "#A08070";
const BG      = "#FDF7F2";

// ─── Helpers: product source parsing ─────────────────────────────────────────

/** Maps a pdpaSource string like "liff-buffet" to a { label, addSku } pair. */
function parseProductSource(source: string): { label: string; addSku: string } {
  if (source === "liff-buffet"  || source === "buffet")  return { label: "Buffet 30 วัน",     addSku: "svc-buffet" };
  if (source === "liff-5pack"   || source === "5pack")   return { label: "แพ็กเกจ 5 ครั้ง",   addSku: "svc-pkg5"   };
  // "liff-membership", "liff", "signup", "staff", or anything else → membership
  return { label: "สมาชิก 30 วัน", addSku: "svc-membership-30d" };
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface MemberTier {
  id: string;
  name: string;
  discountPercent: number;
}

interface MembershipInfo {
  id: string;
  label: string | null;
  isValid: boolean;
  expired: boolean;
  usedUp: boolean;
  expiresAt: string | null;
  activatedAt: string | null;
  usagesAllowed: number;
  usagesUsed: number;
  points: number;
  tier: MemberTier | null;
}

interface MemberRow {
  id: string;
  name: string;
  phone: string | null;
  membership: MembershipInfo;
  cycleBookings: number;
  totalBookings: number;
}

interface PendingRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  consentedAt: string | null;
  source: string;
}

interface CycleRow {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string | null;
  startedAt: string;
  endedAt: string;
  closedAt: string | null;
  paidAmount: number;
  paymentMethod: string | null;
  bookingsUsed: number;
}

interface ApiResponse {
  members: MemberRow[];
  pending: PendingRow[];
  history: CycleRow[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("th-TH", {
    timeZone: "Asia/Bangkok",
    day:   "numeric",
    month: "short",
    year:  "2-digit",
  });
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const date = d.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short" });
  const time = d.toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hour12: false });
  return `${date} · ${time}`;
}

function fmtBaht(satang: number): string {
  return `฿${(satang / 100).toLocaleString("th-TH")}`;
}

function daysLeft(iso: string | null): number | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// ─── Member card ──────────────────────────────────────────────────────────────

function CustomerCard({
  row,
  onRenew,
  renewing,
}: {
  row: MemberRow;
  onRenew: (id: string) => void;
  renewing: boolean;
}) {
  const m    = row.membership;
  const days = daysLeft(m.expiresAt);

  let statusColor = "#166534";
  let statusBg    = "#F0FFF4";
  let statusText  = "ใช้งานได้";

  if (m.expired) {
    statusColor = "#991b1b"; statusBg = "#FEF2F2"; statusText = "หมดอายุ";
  } else if (m.usedUp) {
    statusColor = "#92400e"; statusBg = "#FFFBEB"; statusText = "ใช้ครบแล้ว";
  } else if (days !== null && days <= 5) {
    statusColor = "#b45309"; statusBg = "#FFFBEB"; statusText = `เหลือ ${days} วัน`;
  }

  const hasCycleLimit = m.usagesAllowed > 0;
  const cycleUsedPct  = hasCycleLimit ? Math.min(100, Math.round((row.cycleBookings / m.usagesAllowed) * 100)) : null;

  return (
    <div
      className="rounded-2xl bg-white p-4 flex flex-col gap-3"
      style={{ border: `1.5px solid ${m.isValid ? BORDER : "#FECACA"}` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
            style={{ backgroundColor: m.isValid ? PRIMARY : MUTED }}
          >
            {row.name.charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate" style={{ color: TEXT }}>{row.name}</p>
            {row.phone && <p className="text-xs" style={{ color: MUTED }}>{row.phone}</p>}
          </div>
        </div>

        <span
          className="text-xs px-2.5 py-1 rounded-full font-semibold flex-shrink-0 flex items-center gap-1"
          style={{ backgroundColor: statusBg, color: statusColor }}
        >
          {m.isValid ? <CheckCircle size={11} /> : m.expired ? <XCircle size={11} /> : <Clock size={11} />}
          {statusText}
        </span>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {m.label && (
          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "#F9F0E8", color: PRIMARY }}>
            {m.label}
          </span>
        )}
        {m.points > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#EFF6FF", color: "#1d4ed8" }}>
            {m.points} แต้ม
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <p style={{ color: MUTED }}>หมดอายุ</p>
          <p className="font-medium mt-0.5" style={{ color: m.expired ? "#991b1b" : TEXT }}>
            {fmtDate(m.expiresAt)}
          </p>
        </div>
        <div>
          <p style={{ color: MUTED }}>ครั้งที่ใช้ (รอบนี้)</p>
          <p className="font-medium mt-0.5" style={{ color: TEXT }}>
            {row.cycleBookings}
            {hasCycleLimit && ` / ${m.usagesAllowed} ครั้ง`}
          </p>
        </div>
        <div>
          <p style={{ color: MUTED }}>เริ่มรอบปัจจุบัน</p>
          <p className="font-medium mt-0.5" style={{ color: TEXT }}>{fmtDate(m.activatedAt)}</p>
        </div>
        <div>
          <p style={{ color: MUTED }}>ทั้งหมด (ตลอดกาล)</p>
          <p className="font-medium mt-0.5" style={{ color: TEXT }}>{row.totalBookings} ครั้ง</p>
        </div>
      </div>

      {hasCycleLimit && cycleUsedPct !== null && (
        <div>
          <div className="flex items-center justify-between text-xs mb-1" style={{ color: MUTED }}>
            <span>การใช้งานรอบนี้</span>
            <span style={{ color: cycleUsedPct >= 100 ? "#991b1b" : TEXT }}>{cycleUsedPct}%</span>
          </div>
          <div className="w-full h-1.5 rounded-full" style={{ background: BORDER }}>
            <div
              className="h-1.5 rounded-full transition-all"
              style={{
                width: `${cycleUsedPct}%`,
                backgroundColor: cycleUsedPct >= 100 ? "#ef4444" : cycleUsedPct >= 80 ? "#f59e0b" : "#22c55e",
              }}
            />
          </div>
        </div>
      )}

      <button
        onClick={() => onRenew(row.id)}
        disabled={renewing}
        className="w-full py-2 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
        style={{
          background: m.isValid ? BG : PRIMARY,
          color:      m.isValid ? PRIMARY : "white",
          border:     m.isValid ? `1px solid ${BORDER}` : "none",
        }}
        title="ใช้สำหรับกรณีพิเศษ — ปกติต่ออายุผ่าน POS"
      >
        <RefreshCw size={12} className={renewing ? "animate-spin" : ""} />
        {renewing ? "กำลังต่ออายุ..." : "ต่ออายุ (Manual)"}
      </button>
    </div>
  );
}

// ─── Pending card ─────────────────────────────────────────────────────────────

function PendingCard({
  row,
  onEdit,
  onDelete,
  deleting,
}: {
  row:      PendingRow;
  onEdit:   (id: string, data: { name: string; phone: string; email: string; pdpaSource: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  deleting: boolean;
}) {
  const router = useRouter();
  const [editing,   setEditing]   = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [editName,  setEditName]  = useState(row.name);
  const [editPhone, setEditPhone] = useState(row.phone ?? "");
  const [editEmail, setEditEmail] = useState(row.email ?? "");
  const [editSource, setEditSource] = useState(row.source);
  const [err, setErr] = useState("");

  async function handleSave() {
    if (!editName.trim() || !editPhone.trim()) { setErr("ชื่อและเบอร์โทรจำเป็น"); return; }
    setSaving(true);
    setErr("");
    await onEdit(row.id, { name: editName.trim(), phone: editPhone.trim(), email: editEmail.trim(), pdpaSource: editSource });
    setSaving(false);
    setEditing(false);
  }

  return (
    <div
      className="rounded-2xl bg-white p-4 space-y-3"
      style={{ border: `1.5px dashed ${BORDER}` }}
    >
      {/* Header row */}
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
          style={{ backgroundColor: "#f59e0b" }}
        >
          <Hourglass size={16} />
        </div>
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="space-y-1.5">
              <input
                value={editName}
                onChange={e => setEditName(e.target.value)}
                placeholder="ชื่อ *"
                className="w-full border rounded-lg px-2.5 py-1.5 text-sm outline-none"
                style={{ borderColor: BORDER, color: TEXT }}
              />
              <input
                value={editPhone}
                onChange={e => setEditPhone(e.target.value)}
                placeholder="เบอร์โทร *"
                className="w-full border rounded-lg px-2.5 py-1.5 text-sm outline-none"
                style={{ borderColor: BORDER, color: TEXT }}
              />
              <input
                value={editEmail}
                onChange={e => setEditEmail(e.target.value)}
                placeholder="อีเมล (ไม่บังคับ)"
                className="w-full border rounded-lg px-2.5 py-1.5 text-sm outline-none"
                style={{ borderColor: BORDER, color: TEXT }}
              />
              {/* Product selector */}
              <div>
                <p className="text-[10px] mb-1 font-medium" style={{ color: MUTED }}>รายการที่ต้องการซื้อ</p>
                <div className="flex gap-1.5 flex-wrap">
                  {([
                    { src: "liff-membership", label: "สมาชิก 30 วัน" },
                    { src: "liff-buffet",     label: "Buffet 30 วัน" },
                    { src: "liff-5pack",      label: "แพ็กเกจ 5 ครั้ง" },
                  ] as const).map(opt => (
                    <button
                      key={opt.src}
                      type="button"
                      onClick={() => setEditSource(opt.src)}
                      className="text-[10px] px-2 py-1 rounded-full font-semibold transition-colors"
                      style={{
                        background: parseProductSource(editSource).label === opt.label ? PRIMARY : "#FFF0E8",
                        color:      parseProductSource(editSource).label === opt.label ? "white"  : PRIMARY,
                        border:     `1px solid ${parseProductSource(editSource).label === opt.label ? PRIMARY : BORDER}`,
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              {err && <p className="text-xs text-red-600">{err}</p>}
            </div>
          ) : (
            <>
              <p className="font-semibold text-sm" style={{ color: TEXT }}>{row.name}</p>
              <div className="flex items-center gap-2 text-xs mt-0.5 flex-wrap" style={{ color: MUTED }}>
                {row.phone && <span>{row.phone}</span>}
                {row.email && <span>· {row.email}</span>}
              </div>
              <p className="text-xs mt-0.5" style={{ color: MUTED }}>
                ลงทะเบียน {fmtDateTime(row.consentedAt)}
              </p>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                {/* Product badge */}
                <span
                  className="inline-block text-[10px] px-2 py-0.5 rounded-full font-semibold"
                  style={{ background: "#FFF0E8", color: PRIMARY }}
                >
                  {parseProductSource(row.source).label}
                </span>
                {/* Ref code */}
                <span
                  className="inline-block text-[10px] px-2 py-0.5 rounded-full font-mono font-bold tracking-widest"
                  style={{ background: "#F3F4F6", color: "#374151" }}
                >
                  #{row.id.slice(-8).toUpperCase()}
                </span>
              </div>
            </>
          )}
        </div>
        <span
          className="text-xs px-2.5 py-1 rounded-full font-semibold flex-shrink-0"
          style={{ backgroundColor: "#FFFBEB", color: "#92400e" }}
        >
          รอชำระ
        </span>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {editing ? (
          <>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-50"
              style={{ background: PRIMARY }}
            >
              <Save size={12} />
              {saving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
            <button
              onClick={() => { setEditing(false); setEditName(row.name); setEditPhone(row.phone ?? ""); setEditEmail(row.email ?? ""); setErr(""); }}
              className="px-3 py-2 rounded-xl text-xs border"
              style={{ borderColor: BORDER, color: MUTED }}
            >
              <X size={12} />
            </button>
          </>
        ) : (
          <>
            {/* Go to POS — opens POS with this customer pre-selected + correct product pre-added */}
            <button
              onClick={() => {
                const { addSku } = parseProductSource(row.source);
                router.push(
                  `/admin/pos?customerPhone=${encodeURIComponent(row.phone ?? "")}&customerName=${encodeURIComponent(row.name)}&addSku=${encodeURIComponent(addSku)}`
                );
              }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-white"
              style={{ background: PRIMARY }}
            >
              <ShoppingCart size={12} />
              ไปยัง POS ชำระเงิน
            </button>
            <button
              onClick={() => setEditing(true)}
              className="px-3 py-2 rounded-xl text-xs border hover:bg-stone-50 transition-colors"
              style={{ borderColor: BORDER, color: MUTED }}
              title="แก้ไขข้อมูล"
            >
              <Pencil size={12} />
            </button>
            <button
              onClick={() => {
                if (confirm(`ลบ ${row.name} ออกจากรายการรอชำระ?`)) onDelete(row.id);
              }}
              disabled={deleting}
              className="px-3 py-2 rounded-xl text-xs border hover:bg-red-50 transition-colors disabled:opacity-50"
              style={{ borderColor: "#FECACA", color: "#991b1b" }}
              title="ลบ"
            >
              <Trash2 size={12} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── History row ──────────────────────────────────────────────────────────────

function HistoryRow({ row }: { row: CycleRow }) {
  const isOpen = !row.closedAt;
  return (
    <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
      <td className="px-3 py-2.5">
        <p className="text-sm font-medium" style={{ color: TEXT }}>{row.customerName}</p>
        {row.customerPhone && <p className="text-xs" style={{ color: MUTED }}>{row.customerPhone}</p>}
      </td>
      <td className="px-3 py-2.5 text-xs" style={{ color: TEXT }}>
        {fmtDate(row.startedAt)} → {fmtDate(row.endedAt)}
      </td>
      <td className="px-3 py-2.5 text-right text-sm font-medium" style={{ color: TEXT }}>
        {fmtBaht(row.paidAmount)}
      </td>
      <td className="px-3 py-2.5 text-xs" style={{ color: MUTED }}>
        {row.paymentMethod ?? "—"}
      </td>
      <td className="px-3 py-2.5 text-center text-sm" style={{ color: TEXT }}>
        {row.bookingsUsed}
      </td>
      <td className="px-3 py-2.5">
        {isOpen ? (
          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "#F0FFF4", color: "#166534" }}>
            กำลังใช้
          </span>
        ) : (
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: BG, color: MUTED }}>
            ปิดรอบ
          </span>
        )}
      </td>
    </tr>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type Tab = "members" | "pending" | "history";

export default function MembershipManager() {
  const [data,     setData]     = useState<ApiResponse>({ members: [], pending: [], history: [] });
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  const [renewing,  setRenewing]  = useState<string | null>(null);
  const [deletingP, setDeletingP] = useState<string | null>(null);
  const [tab,       setTab]       = useState<Tab>("members");
  const [filter,    setFilter]    = useState<"all" | "active" | "expired">("all");
  const [search,    setSearch]    = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/membership/customers");
      const json: ApiResponse = await res.json();
      setData(json);
    } catch {
      setError("โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleRenew(customerId: string) {
    if (!confirm("ต่ออายุสมาชิก 30 วัน (Manual)? ใช้สำหรับกรณีพิเศษเท่านั้น — ปกติควรต่ออายุผ่าน POS")) return;
    setRenewing(customerId);
    try {
      const res = await fetch(
        `/api/admin/membership/customers/${customerId}/renew`,
        { method: "POST" }
      );
      if (!res.ok) throw new Error();
      await load();
    } catch {
      setError("ต่ออายุไม่สำเร็จ");
    } finally {
      setRenewing(null);
    }
  }

  async function handlePendingEdit(customerId: string, data: { name: string; phone: string; email: string; pdpaSource: string }) {
    try {
      const res = await fetch(`/api/admin/customers/${customerId}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ name: data.name, phone: data.phone, email: data.email, pdpaSource: data.pdpaSource }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "แก้ไขไม่สำเร็จ");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "แก้ไขไม่สำเร็จ");
    }
  }

  async function handlePendingDelete(customerId: string) {
    setDeletingP(customerId);
    try {
      const res = await fetch(`/api/admin/customers/${customerId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      await load();
    } catch {
      setError("ลบไม่สำเร็จ");
    } finally {
      setDeletingP(null);
    }
  }

  // ── Members filter / search ──
  const memberFiltered = data.members.filter(c => {
    if (filter === "active"  && !c.membership.isValid)  return false;
    if (filter === "expired" &&  c.membership.isValid)  return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return c.name.toLowerCase().includes(q) || (c.phone ?? "").includes(q);
    }
    return true;
  });

  const activeCount  = data.members.filter(c =>  c.membership.isValid).length;
  const expiredCount = data.members.filter(c => !c.membership.isValid).length;

  const pendingFiltered = data.pending.filter(p => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || (p.phone ?? "").includes(q);
  });

  const historyFiltered = data.history.filter(h => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return h.customerName.toLowerCase().includes(q) || (h.customerPhone ?? "").includes(q);
  });

  const totalRevenue = data.history.reduce((s, h) => s + h.paidAmount, 0);

  return (
    <div className="px-6 py-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: MUTED }}>Admin</p>
          <h1 className="text-2xl font-medium" style={{ color: TEXT }}>สมาชิก</h1>
          <p className="text-sm mt-0.5" style={{ color: MUTED }}>
            จัดการสมาชิก ดูผู้รอชำระ และประวัติรอบสมาชิก
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm border transition-colors hover:bg-stone-50"
          style={{ borderColor: BORDER, color: MUTED }}
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          รีเฟรช
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "ใช้งานได้",        value: activeCount,            color: "#166534" },
          { label: "หมดอายุ / ใช้ครบ", value: expiredCount,           color: "#991b1b" },
          { label: "รอชำระ",           value: data.pending.length,    color: "#92400e" },
          { label: "รายได้รวม (ประวัติ)", value: fmtBaht(totalRevenue), color: PRIMARY,   isText: true },
        ].map(s => (
          <div key={s.label} className="rounded-2xl p-4 bg-white" style={{ border: `1.5px solid ${BORDER}` }}>
            <p className="text-xs mb-1" style={{ color: MUTED }}>{s.label}</p>
            <p className={s.isText ? "text-base font-semibold" : "text-xl font-semibold"} style={{ color: s.color }}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl mb-5" style={{ background: BG, width: "fit-content" }}>
        {([
          { id: "members", label: "สมาชิกปัจจุบัน", icon: Users,        count: data.members.length },
          { id: "pending", label: "รอชำระ",       icon: Hourglass,     count: data.pending.length },
          { id: "history", label: "ประวัติรอบ",    icon: HistoryIcon,   count: data.history.length },
        ] as const).map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              style={{
                background: tab === t.id ? PRIMARY : "transparent",
                color:      tab === t.id ? "white" : MUTED,
              }}
            >
              <Icon size={14} />
              {t.label}
              <span
                className="text-xs px-1.5 rounded-full"
                style={{
                  background: tab === t.id ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.05)",
                  color:      tab === t.id ? "white" : MUTED,
                }}
              >
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search + filter (filter only on members tab) */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        {tab === "members" && (
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: BG }}>
            {(["all", "active", "expired"] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{
                  background: filter === f ? PRIMARY : "transparent",
                  color:      filter === f ? "white" : MUTED,
                }}
              >
                {f === "all" ? "ทั้งหมด" : f === "active" ? "ใช้งานได้" : "หมดอายุ"}
              </button>
            ))}
          </div>
        )}

        <div
          className="flex-1 min-w-48 flex items-center gap-2 px-3 py-2 rounded-xl border bg-white"
          style={{ borderColor: BORDER }}
        >
          <Search size={14} style={{ color: MUTED }} />
          <input
            type="text"
            placeholder="ค้นหาชื่อ / เบอร์..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 text-sm outline-none bg-transparent"
            style={{ color: TEXT }}
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {/* Tab content */}
      {loading ? (
        <div className="text-center py-16" style={{ color: MUTED }}>กำลังโหลด...</div>
      ) : (
        <>
          {/* MEMBERS TAB */}
          {tab === "members" && (
            memberFiltered.length === 0 ? (
              <div className="text-center py-16 flex flex-col items-center gap-3" style={{ color: MUTED }}>
                <Users size={36} style={{ color: BORDER }} />
                <p className="text-sm">ไม่พบสมาชิก</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {memberFiltered.map(row => (
                  <CustomerCard
                    key={row.id}
                    row={row}
                    onRenew={handleRenew}
                    renewing={renewing === row.id}
                  />
                ))}
              </div>
            )
          )}

          {/* PENDING TAB */}
          {tab === "pending" && (
            pendingFiltered.length === 0 ? (
              <div className="text-center py-16 flex flex-col items-center gap-3" style={{ color: MUTED }}>
                <Hourglass size={36} style={{ color: BORDER }} />
                <p className="text-sm">ยังไม่มีคนรอชำระสมาชิก</p>
              </div>
            ) : (
              <>
                <div className="rounded-xl p-3 mb-4 text-xs flex items-start gap-2" style={{ background: "#FFFBEB", color: "#92400e" }}>
                  <Hourglass size={14} className="flex-shrink-0 mt-0.5" />
                  <p>
                    คนเหล่านี้ลงทะเบียนผ่านหน้าเว็บแล้ว แต่ยังไม่ชำระเงิน — กดปุ่ม &ldquo;ไปยัง POS&rdquo;
                    ระบบจะเปิด POS พร้อมเลือกลูกค้าและรายการที่ถูกต้องให้อัตโนมัติ
                  </p>
                </div>
                <div className="space-y-2">
                  {pendingFiltered.map(p => (
                    <PendingCard
                      key={p.id}
                      row={p}
                      onEdit={handlePendingEdit}
                      onDelete={handlePendingDelete}
                      deleting={deletingP === p.id}
                    />
                  ))}
                </div>
              </>
            )
          )}

          {/* HISTORY TAB */}
          {tab === "history" && (
            historyFiltered.length === 0 ? (
              <div className="text-center py-16 flex flex-col items-center gap-3" style={{ color: MUTED }}>
                <HistoryIcon size={36} style={{ color: BORDER }} />
                <p className="text-sm">ยังไม่มีประวัติรอบสมาชิก</p>
              </div>
            ) : (
              <div className="rounded-2xl bg-white overflow-hidden" style={{ border: `1.5px solid ${BORDER}` }}>
                <table className="w-full">
                  <thead>
                    <tr style={{ background: BG }}>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: MUTED }}>ลูกค้า</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: MUTED }}>รอบ</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide" style={{ color: MUTED }}>จำนวน</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: MUTED }}>วิธีชำระ</th>
                      <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide" style={{ color: MUTED }}>ใช้ไป</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: MUTED }}>สถานะ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyFiltered.map(h => (
                      <HistoryRow key={h.id} row={h} />
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </>
      )}
    </div>
  );
}
