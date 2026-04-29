"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";
import {
  UserPlus, Pencil, Search, ChevronDown, X, Save, Phone, Mail, Calendar,
  User as UserIcon, CreditCard, Clock, MapPin, Plus, Zap, Trash2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MembershipInfo {
  label:         string;
  points:        number;
  activatedAt:   string;
  expiresAt:     string | null;
  usagesUsed:    number;
  usagesAllowed: number;
}

interface Customer {
  id:         string;
  name:       string;
  nickname:   string | null;
  phone:      string;
  email:      string | null;
  gender:     string | null;
  pictureUrl: string | null;
  lineUserId: string | null;
  createdAt:  string;
  membership: MembershipInfo | null;
  _count:     { bookings: number };
}

interface BookingRecord {
  id:        string;
  date:      string;
  startTime: string;
  endTime:   string;
  status:    string;
  totalPrice: number;
  branch:    { name: string };
  service:   { name: string; nameTh: string };
  staff:     { name: string } | null;
}

interface Props {
  customers: Customer[];
}

// ─── Styling constants ────────────────────────────────────────────────────────

const PRIMARY = "#8B1D24";
const BORDER  = "#E8D8CC";
const TEXT    = "#3B2A24";
const MUTED   = "#A08070";
const BG      = "#FDF7F2";

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  PENDING:   { bg: "#FFF8E8", color: "#B45309" },
  CONFIRMED: { bg: "#ECFDF5", color: "#065F46" },
  COMPLETED: { bg: "#F0F4FF", color: "#1D4ED8" },
  CANCELLED: { bg: "#FEF2F2", color: "#991B1B" },
  NO_SHOW:   { bg: "#F5F3FF", color: "#6D28D9" },
};
const STATUS_LABEL: Record<string, string> = {
  PENDING: "รอยืนยัน", CONFIRMED: "ยืนยันแล้ว",
  COMPLETED: "เสร็จสิ้น", CANCELLED: "ยกเลิก", NO_SHOW: "ไม่มา",
};

const GENDER_LABEL: Record<string, string> = {
  MALE:   "ชาย",
  FEMALE: "หญิง",
  OTHER:  "อื่นๆ",
};

function fmt(satang: number) {
  return `฿${(satang / 100).toLocaleString("th-TH")}`;
}

function avatarBg(name: string) {
  const palette = ["#F0E4D8","#E4EEF0","#EAE4F0","#E4F0E9","#F0EAE4"];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return palette[Math.abs(h) % palette.length];
}

// ─── Portal ───────────────────────────────────────────────────────────────────

function Modal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}

// ─── Customer Avatar ──────────────────────────────────────────────────────────

function Avatar({ customer, size = 40 }: { customer: { name: string; pictureUrl: string | null }; size?: number }) {
  const bg = avatarBg(customer.name);
  if (customer.pictureUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={customer.pictureUrl}
        alt={customer.name}
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-full flex items-center justify-center font-semibold flex-shrink-0"
      style={{
        width: size,
        height: size,
        background: bg,
        color: "#6B5245",
        fontSize: size * 0.4,
      }}
    >
      {customer.name[0]?.toUpperCase()}
    </div>
  );
}

// ─── Quick add customer modal (only for "+ เพิ่มลูกค้า" — minimal form) ────────

function AddCustomerModal({ onClose, onSaved }: {
  onClose: () => void;
  onSaved: (c: Customer) => void;
}) {
  const [name,     setName]     = useState("");
  const [nickname, setNickname] = useState("");
  const [phone,    setPhone]    = useState("");
  const [email,    setEmail]    = useState("");
  const [gender,   setGender]   = useState("");
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState("");

  async function handleSave() {
    if (!name.trim())  { setError("กรุณากรอกชื่อ"); return; }
    if (!phone.trim()) { setError("กรุณากรอกเบอร์โทร"); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/customers", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          name:     name.trim(),
          nickname: nickname.trim() || null,
          phone:    phone.trim(),
          email:    email.trim() || null,
          gender:   gender || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "เกิดข้อผิดพลาด");
      onSaved(await res.json());
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal>
      <div
        className="fixed inset-0 flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.45)", zIndex: 99999 }}
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden flex flex-col" style={{ background: "white" }}>
          <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: BORDER }}>
            <h2 className="font-semibold text-sm" style={{ color: TEXT }}>เพิ่มลูกค้าใหม่</h2>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
              <X size={17} color={MUTED} />
            </button>
          </div>

          <div className="px-6 py-5 space-y-4">
            <div>
              <label className="block text-xs mb-1 font-medium" style={{ color: MUTED }}>ชื่อ-นามสกุล *</label>
              <input
                autoFocus value={name}
                onChange={e => setName(e.target.value)}
                placeholder="เช่น สมชาย ใจดี"
                className="w-full px-3 py-2 text-sm rounded-xl border"
                style={{ borderColor: BORDER, color: TEXT }}
              />
            </div>
            <div>
              <label className="block text-xs mb-1 font-medium" style={{ color: MUTED }}>ชื่อเล่น (ไม่บังคับ)</label>
              <input
                value={nickname}
                onChange={e => setNickname(e.target.value)}
                placeholder="เช่น แอม, บิ๊ก, นุ้ย"
                className="w-full px-3 py-2 text-sm rounded-xl border"
                style={{ borderColor: BORDER, color: TEXT }}
              />
            </div>
            <div>
              <label className="block text-xs mb-1 font-medium" style={{ color: MUTED }}>เบอร์โทรศัพท์ *</label>
              <input
                value={phone} type="tel"
                onChange={e => setPhone(e.target.value)}
                placeholder="0812345678"
                className="w-full px-3 py-2 text-sm rounded-xl border"
                style={{ borderColor: BORDER, color: TEXT }}
              />
            </div>
            <div>
              <label className="block text-xs mb-1 font-medium" style={{ color: MUTED }}>อีเมล (ไม่บังคับ)</label>
              <input
                value={email} type="email"
                onChange={e => setEmail(e.target.value)}
                placeholder="example@email.com"
                className="w-full px-3 py-2 text-sm rounded-xl border"
                style={{ borderColor: BORDER, color: TEXT }}
              />
            </div>
            <div>
              <label className="block text-xs mb-1 font-medium" style={{ color: MUTED }}>เพศ (ไม่บังคับ)</label>
              <div className="grid grid-cols-3 gap-2">
                {["MALE","FEMALE","OTHER"].map(g => (
                  <button
                    key={g} type="button"
                    onClick={() => setGender(gender === g ? "" : g)}
                    className="px-3 py-2 text-sm rounded-xl border font-medium"
                    style={
                      gender === g
                        ? { background: PRIMARY, color: "white", borderColor: PRIMARY }
                        : { background: "white", color: MUTED, borderColor: BORDER }
                    }
                  >
                    {GENDER_LABEL[g]}
                  </button>
                ))}
              </div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>

          <div className="px-6 py-4 border-t flex justify-end gap-3" style={{ borderColor: BORDER }}>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-xl border font-medium"
              style={{ borderColor: BORDER, color: MUTED }}
            >ยกเลิก</button>
            <button
              onClick={handleSave} disabled={saving}
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

// ─── Membership section (used inside CustomerDetailModal) ─────────────────────

function MembershipSection({
  customer,
  onUpdated,
}: {
  customer: Customer;
  onUpdated: (c: Customer) => void;
}) {
  const m = customer.membership;

  // View vs edit state
  const [editing,       setEditing]       = useState(false);
  const [expiresAt,     setExpiresAt]     = useState(m?.expiresAt ? m.expiresAt.slice(0, 10) : "");
  const [noExpiry,      setNoExpiry]      = useState(!m?.expiresAt);
  const [usagesAllowed, setUsagesAllowed] = useState(m?.usagesAllowed ?? 0);
  const [saving,        setSaving]        = useState(false);
  const [error,         setError]         = useState("");

  // Reset form whenever a different customer opens
  useEffect(() => {
    setExpiresAt(m?.expiresAt ? m.expiresAt.slice(0, 10) : "");
    setNoExpiry(!m?.expiresAt);
    setUsagesAllowed(m?.usagesAllowed ?? 0);
    setEditing(false);
    setError("");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer.id]);

  async function refetch() {
    const res = await fetch(`/api/admin/customers/${customer.id}`);
    if (res.ok) onUpdated(await res.json());
  }

  async function handleRegister() {
    setSaving(true);
    setError("");
    try {
      const payload = {
        activatedAt:  new Date().toISOString().slice(0, 10),
        expiresAt:    noExpiry ? null : (expiresAt || null),
        usagesAllowed,
      };
      const res = await fetch(`/api/admin/customers/${customer.id}/membership`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "เกิดข้อผิดพลาด");
      await refetch();
      setEditing(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEdit() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/customers/${customer.id}/membership`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          expiresAt:    noExpiry ? null : (expiresAt || null),
          usagesAllowed,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "เกิดข้อผิดพลาด");
      await refetch();
      setEditing(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("ต้องการยกเลิกสมาชิกใช่ไหม?")) return;
    await fetch(`/api/admin/customers/${customer.id}/membership`, { method: "DELETE" });
    await refetch();
  }

  // Derived status
  const now = new Date();
  const isExpired = m?.expiresAt ? new Date(m.expiresAt) < now : false;
  const isUsagesExhausted = (m?.usagesAllowed ?? 0) > 0 && m ? m.usagesUsed >= m.usagesAllowed : false;
  const isActive = !!m && !isExpired && !isUsagesExhausted;

  const expiresLabel = m?.expiresAt
    ? new Date(m.expiresAt).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })
    : "ไม่หมดอายุ";

  const activeColor = isActive ? PRIMARY : "#EF4444";

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest" style={{ color: PRIMARY }}>
          สถานะสมาชิก
        </h3>
        {m ? (
          <div className="flex gap-1">
            <button
              onClick={() => { setEditing(v => !v); setError(""); }}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium"
              style={{ color: "#2563EB", background: "#EFF6FF", border: "1px solid #BFDBFE" }}
            >
              <Pencil size={11} /> {editing ? "ยกเลิก" : "แก้ไข"}
            </button>
            <button onClick={handleDelete} className="p-1 rounded-lg hover:bg-red-50" title="ยกเลิกสมาชิก">
              <Trash2 size={13} color="#EF4444" />
            </button>
          </div>
        ) : !editing ? (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-white"
            style={{ background: PRIMARY }}
          >
            <Plus size={11} /> ลงทะเบียนสมาชิก
          </button>
        ) : null}
      </div>

      {/* ── Current membership card (view mode) ── */}
      {m && !editing && (
        <div
          className="rounded-xl border p-4"
          style={{
            borderColor: activeColor + "44",
            background:  activeColor + "10",
          }}
        >
          <div className="flex items-center gap-3 mb-3">
            <CreditCard size={16} style={{ color: activeColor }} />
            <span className="font-semibold text-sm" style={{ color: activeColor }}>
              {m.label}
            </span>
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium ml-auto"
              style={
                isActive
                  ? { background: "#ECFDF5", color: "#065F46" }
                  : { background: "#FEF2F2", color: "#991B1B" }
              }
            >
              {isExpired ? "หมดอายุ" : isUsagesExhausted ? "ใช้ครบแล้ว" : "ใช้งานได้"}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs" style={{ color: MUTED }}>
            <span className="flex items-center gap-1.5">
              <Clock size={11} />
              <span>หมดอายุ</span>
              <strong style={{ color: isExpired ? "#EF4444" : TEXT }}>{expiresLabel}</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <UserIcon size={11} />
              ใช้แล้ว {m.usagesUsed}
              {m.usagesAllowed > 0 ? ` / ${m.usagesAllowed} ครั้ง` : " ครั้ง (ไม่จำกัด)"}
            </span>
            <span className="flex items-center gap-1.5">
              <CreditCard size={11} />
              {m.points} แต้มสะสม
            </span>
          </div>
        </div>
      )}

      {/* ── No membership ── */}
      {!m && !editing && (
        <div className="rounded-xl border-2 border-dashed p-4 text-center" style={{ borderColor: BORDER, color: MUTED }}>
          <p className="text-sm font-medium">ยังไม่ได้สมัครสมาชิก</p>
          <p className="text-xs mt-1">กด &quot;ลงทะเบียนสมาชิก&quot; เพื่อเริ่มต้น</p>
        </div>
      )}

      {/* ── Edit / register form ── */}
      {editing && (
        <div className="rounded-xl border p-4 space-y-4" style={{ borderColor: BORDER, background: "#FAFAFA" }}>
          <p className="text-sm font-semibold" style={{ color: TEXT }}>
            {m ? "แก้ไขข้อมูลสมาชิก" : "ลงทะเบียนสมาชิกใหม่"}
          </p>

          {/* Expiry */}
          <div>
            <label className="block text-xs mb-2 font-medium" style={{ color: MUTED }}>วันหมดอายุ</label>
            <div className="flex items-center gap-3 mb-2">
              <label className="flex items-center gap-1.5 text-sm cursor-pointer" style={{ color: TEXT }}>
                <input
                  type="checkbox"
                  checked={noExpiry}
                  onChange={e => setNoExpiry(e.target.checked)}
                  className="rounded"
                />
                ไม่หมดอายุ
              </label>
            </div>
            {!noExpiry && (
              <input
                type="date"
                value={expiresAt}
                onChange={e => setExpiresAt(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border"
                style={{ borderColor: BORDER, color: TEXT }}
              />
            )}
          </div>

          {/* Usages */}
          <div>
            <label className="block text-xs mb-1 font-medium" style={{ color: MUTED }}>
              จำนวนครั้งที่ใช้สิทธิ์ได้ (0 = ไม่จำกัด)
            </label>
            <input
              type="number" min={0}
              value={usagesAllowed}
              onChange={e => setUsagesAllowed(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm rounded-xl border"
              style={{ borderColor: BORDER, color: TEXT }}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setEditing(false); setError(""); }}
              className="px-4 py-2 text-sm rounded-xl border font-medium"
              style={{ borderColor: BORDER, color: MUTED }}
            >ยกเลิก</button>
            <button
              onClick={m ? handleSaveEdit : handleRegister}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 text-sm rounded-xl font-medium text-white"
              style={{ background: saving ? MUTED : PRIMARY }}
            >
              <Save size={14} />
              {saving ? "กำลังบันทึก..." : m ? "บันทึก" : "ลงทะเบียน"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

// ─── Customer Detail Modal — the big one ─────────────────────────────────────

function CustomerDetailModal({ customer: initial, onClose, onSaved, onDeleted }: {
  customer: Customer;
  onClose: () => void;
  onSaved: (c: Customer) => void;
  onDeleted: (id: string) => void;
}) {
  const [customer,  setCustomer]  = useState<Customer>(initial);
  const [editMode,  setEditMode]  = useState(false);
  const [bookings,  setBookings]  = useState<BookingRecord[] | null>(null);

  // editable fields
  const [name,     setName]     = useState(customer.name);
  const [nickname, setNickname] = useState(customer.nickname ?? "");
  const [phone,    setPhone]    = useState(customer.phone);
  const [email,    setEmail]    = useState(customer.email ?? "");
  const [gender,   setGender]   = useState(customer.gender ?? "");
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState("");

  // delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting,          setDeleting]          = useState(false);

  // Load booking history once on mount
  useEffect(() => {
    fetch(`/api/admin/customers/${customer.id}/bookings`)
      .then(r => r.json())
      .then(setBookings)
      .catch(() => setBookings([]));
  }, [customer.id]);

  // Split bookings into upcoming vs past
  const { upcoming, past } = useMemo(() => {
    if (!bookings) return { upcoming: [], past: [] };
    const today = new Date(); today.setHours(0,0,0,0);
    const up: BookingRecord[] = []; const ps: BookingRecord[] = [];
    for (const b of bookings) {
      const d = new Date(b.date);
      if (d >= today && (b.status === "PENDING" || b.status === "CONFIRMED")) up.push(b);
      else ps.push(b);
    }
    return { upcoming: up.sort((a, b) => a.date.localeCompare(b.date)), past: ps };
  }, [bookings]);

  const completedTotal = useMemo(() => {
    if (!bookings) return 0;
    return bookings.filter(b => b.status === "COMPLETED").reduce((sum, b) => sum + b.totalPrice, 0);
  }, [bookings]);

  async function handleSave() {
    if (!name.trim())  { setError("กรุณากรอกชื่อ"); return; }
    if (!phone.trim()) { setError("กรุณากรอกเบอร์โทร"); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/customers/${customer.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          name:     name.trim(),
          nickname: nickname.trim() || null,
          phone:    phone.trim(),
          email:    email.trim() || null,
          gender:   gender || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "บันทึกไม่สำเร็จ");
      const saved: Customer = await res.json();
      setCustomer(saved);
      onSaved(saved);
      setEditMode(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteCustomer() {
    setDeleting(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/customers/${customer.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error ?? "ลบไม่สำเร็จ");
      onDeleted(customer.id);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  const joinDate = new Date(customer.createdAt).toLocaleDateString("th-TH", {
    day: "numeric", month: "long", year: "numeric",
  });

  return (
    <Modal>
      <div
        className="fixed inset-0 flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.45)", zIndex: 99999 }}
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div
          className="w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col relative"
          style={{ background: "white", maxHeight: "92vh" }}
        >
          {/* ── Header with avatar + name + edit toggle ── */}
          <div className="px-6 pt-6 pb-5 border-b flex items-start gap-4 flex-shrink-0" style={{ borderColor: BORDER }}>
            <Avatar customer={customer} size={64} />

            <div className="flex-1 min-w-0">
              {editMode ? (
                <div className="space-y-1.5">
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="ชื่อ-นามสกุล *"
                    className="text-lg font-semibold w-full px-2 py-1 rounded-lg border"
                    style={{ borderColor: BORDER, color: TEXT }}
                  />
                  <input
                    value={nickname}
                    onChange={e => setNickname(e.target.value)}
                    placeholder="ชื่อเล่น (ไม่บังคับ)"
                    className="text-sm w-full px-2 py-1 rounded-lg border"
                    style={{ borderColor: BORDER, color: TEXT }}
                  />
                </div>
              ) : (
                <div>
                  <h2 className="text-xl font-semibold" style={{ color: TEXT }}>{customer.name}</h2>
                  {customer.nickname && (
                    <p className="text-sm" style={{ color: MUTED }}>ชื่อเล่น: {customer.nickname}</p>
                  )}
                </div>
              )}
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {customer.lineUserId && (
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background: "#F0FFF4", color: "#166534", border: "1px solid #BBF7D0" }}
                  >
                    Line ✓
                  </span>
                )}
                {customer.membership && (
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background: PRIMARY + "18", color: PRIMARY }}
                  >
                    {customer.membership.label}
                  </span>
                )}
                <span className="text-xs" style={{ color: MUTED }}>
                  สมาชิกตั้งแต่ {joinDate}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!editMode && (
                <>
                  <button
                    onClick={() => setEditMode(true)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors"
                    style={{ color: "#2563EB", border: "1px solid #BFDBFE", background: "#EFF6FF" }}
                  >
                    <Pencil size={12} /> แก้ไข
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors"
                    style={{ color: "#DC2626", border: "1px solid #FECACA", background: "#FEF2F2" }}
                    title="ลบลูกค้า"
                  >
                    <Trash2 size={12} /> ลบ
                  </button>
                </>
              )}
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X size={18} color={MUTED} />
              </button>
            </div>
          </div>

          {/* ── Scrollable body ── */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl p-3" style={{ background: BG, border: `1px solid ${BORDER}` }}>
                <p className="text-xs" style={{ color: MUTED }}>การจองทั้งหมด</p>
                <p className="text-lg font-semibold" style={{ color: TEXT }}>{customer._count.bookings}</p>
              </div>
              <div className="rounded-xl p-3" style={{ background: BG, border: `1px solid ${BORDER}` }}>
                <p className="text-xs" style={{ color: MUTED }}>กำลังจะมาถึง</p>
                <p className="text-lg font-semibold" style={{ color: "#1D4ED8" }}>{upcoming.length}</p>
              </div>
              <div className="rounded-xl p-3" style={{ background: BG, border: `1px solid ${BORDER}` }}>
                <p className="text-xs" style={{ color: MUTED }}>ยอดสะสม</p>
                <p className="text-lg font-semibold" style={{ color: PRIMARY }}>{fmt(completedTotal)}</p>
              </div>
            </div>

            {/* ── Personal Info ── */}
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: PRIMARY }}>
                ข้อมูลส่วนตัว
              </h3>
              <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: BORDER, background: "white" }}>
                {/* Phone */}
                <InfoRow icon={<Phone size={14} />} label="เบอร์โทรศัพท์">
                  {editMode ? (
                    <input
                      value={phone} type="tel"
                      onChange={e => setPhone(e.target.value)}
                      className="w-full px-2 py-1 text-sm rounded-lg border"
                      style={{ borderColor: BORDER, color: TEXT }}
                    />
                  ) : (
                    <span className="text-sm" style={{ color: TEXT }}>{customer.phone}</span>
                  )}
                </InfoRow>

                {/* Email */}
                <InfoRow icon={<Mail size={14} />} label="อีเมล">
                  {editMode ? (
                    <input
                      value={email} type="email"
                      onChange={e => setEmail(e.target.value)}
                      placeholder="example@email.com"
                      className="w-full px-2 py-1 text-sm rounded-lg border"
                      style={{ borderColor: BORDER, color: TEXT }}
                    />
                  ) : (
                    <span className="text-sm" style={{ color: customer.email ? TEXT : MUTED }}>
                      {customer.email || "—"}
                    </span>
                  )}
                </InfoRow>

                {/* Gender */}
                <InfoRow icon={<UserIcon size={14} />} label="เพศ">
                  {editMode ? (
                    <div className="flex gap-2">
                      {["MALE","FEMALE","OTHER"].map(g => (
                        <button
                          key={g} type="button"
                          onClick={() => setGender(gender === g ? "" : g)}
                          className="px-3 py-1 text-xs rounded-lg border font-medium"
                          style={
                            gender === g
                              ? { background: PRIMARY, color: "white", borderColor: PRIMARY }
                              : { background: "white", color: MUTED, borderColor: BORDER }
                          }
                        >
                          {GENDER_LABEL[g]}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <span className="text-sm" style={{ color: customer.gender ? TEXT : MUTED }}>
                      {customer.gender ? GENDER_LABEL[customer.gender] : "—"}
                    </span>
                  )}
                </InfoRow>
              </div>

              {editMode && (
                <div className="flex justify-end gap-2 mt-3">
                  {error && <p className="text-sm text-red-600 mr-auto">{error}</p>}
                  <button
                    onClick={() => {
                      setEditMode(false);
                      setName(customer.name);
                      setNickname(customer.nickname ?? "");
                      setPhone(customer.phone);
                      setEmail(customer.email ?? "");
                      setGender(customer.gender ?? "");
                      setError("");
                    }}
                    className="px-4 py-2 text-sm rounded-xl border font-medium"
                    style={{ borderColor: BORDER, color: MUTED }}
                  >ยกเลิก</button>
                  <button
                    onClick={handleSave} disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 text-sm rounded-xl font-medium text-white"
                    style={{ background: saving ? MUTED : PRIMARY }}
                  >
                    <Save size={13} />
                    {saving ? "กำลังบันทึก..." : "บันทึก"}
                  </button>
                </div>
              )}
            </section>

            {/* ── Membership Status ── */}
            <MembershipSection customer={customer} onUpdated={c => { setCustomer(c); onSaved(c); }} />

            {/* ── Upcoming Bookings ── */}
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: PRIMARY }}>
                การจองที่กำลังจะมาถึง ({upcoming.length})
              </h3>
              {bookings === null ? (
                <p className="text-xs text-center py-4" style={{ color: MUTED }}>กำลังโหลด...</p>
              ) : upcoming.length === 0 ? (
                <div className="rounded-xl border-2 border-dashed p-4 text-center" style={{ borderColor: BORDER, color: MUTED }}>
                  <p className="text-sm">ไม่มีการจองที่กำลังจะมาถึง</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {upcoming.map(b => <BookingRow key={b.id} booking={b} highlight />)}
                </div>
              )}
            </section>

            {/* ── Transaction History ── */}
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: PRIMARY }}>
                ประวัติการทำรายการ ({past.length})
              </h3>
              {past.length === 0 ? (
                <p className="text-xs py-4" style={{ color: MUTED }}>ยังไม่มีประวัติ</p>
              ) : (
                <div className="space-y-2">
                  {past.map(b => <BookingRow key={b.id} booking={b} />)}
                </div>
              )}
            </section>
          </div>

          {/* ── Delete confirmation overlay ── */}
          {showDeleteConfirm && (
            <div
              className="absolute inset-0 flex items-center justify-center p-6"
              style={{ background: "rgba(0,0,0,0.55)", zIndex: 10 }}
              onClick={(e) => { if (e.target === e.currentTarget && !deleting) setShowDeleteConfirm(false); }}
            >
              <div className="w-full max-w-sm rounded-2xl p-6" style={{ background: "white" }}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "#FEF2F2" }}>
                    <Trash2 size={20} color="#DC2626" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold" style={{ color: TEXT }}>ลบลูกค้า?</h3>
                    <p className="text-xs" style={{ color: MUTED }}>{customer.name}</p>
                  </div>
                </div>
                <p className="text-sm mb-2" style={{ color: TEXT }}>
                  การลบจะลบลูกค้ารายนี้ <b>พร้อมประวัติการจองทั้งหมด</b> ({bookings?.length ?? 0} รายการ)
                  {customer.membership && " และข้อมูลสมาชิก"} ถาวร
                </p>
                <p className="text-xs mb-5" style={{ color: "#DC2626" }}>
                  การกระทำนี้ไม่สามารถย้อนกลับได้
                </p>
                {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={deleting}
                    className="flex-1 py-2 rounded-xl border text-sm font-medium"
                    style={{ borderColor: BORDER, color: MUTED }}
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={handleDeleteCustomer}
                    disabled={deleting}
                    className="flex-1 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                    style={{ background: "#DC2626" }}
                  >
                    {deleting ? "กำลังลบ..." : "ลบถาวร"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ─── Reusable rows ───────────────────────────────────────────────────────────

function InfoRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 w-32 flex-shrink-0" style={{ color: MUTED }}>
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function BookingRow({ booking, highlight }: { booking: BookingRecord; highlight?: boolean }) {
  const sc = STATUS_STYLE[booking.status] ?? STATUS_STYLE.PENDING;
  const dateStr = new Date(booking.date + (booking.date.length === 10 ? "T12:00:00" : ""))
    .toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div
      className="rounded-xl border p-3 flex items-center justify-between gap-3"
      style={{
        borderColor: highlight ? "#BFDBFE" : BORDER,
        background:  highlight ? "#EFF6FF" : "white",
      }}
    >
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate" style={{ color: TEXT }}>
          {booking.service.nameTh || booking.service.name}
        </p>
        <div className="flex items-center gap-3 mt-0.5 text-xs flex-wrap" style={{ color: MUTED }}>
          <span className="flex items-center gap-1"><Calendar size={11} />{dateStr}</span>
          <span className="flex items-center gap-1"><Clock size={11} />{booking.startTime}–{booking.endTime}</span>
          <span className="flex items-center gap-1"><MapPin size={11} />{booking.branch.name}</span>
          {booking.staff && <span>· {booking.staff.name}</span>}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: sc.bg, color: sc.color }}>
          {STATUS_LABEL[booking.status] ?? booking.status}
        </span>
        <span className="text-sm font-semibold" style={{ color: PRIMARY }}>{fmt(booking.totalPrice)}</span>
      </div>
    </div>
  );
}

// ─── Customer card (list row) ────────────────────────────────────────────────

function CustomerCard({ customer, onClick, highlightRef }: {
  customer: Customer;
  onClick: () => void;
  highlightRef?: React.Ref<HTMLDivElement>;
}) {
  const joinDate = new Date(customer.createdAt).toLocaleDateString("th-TH", {
    day: "numeric", month: "short", year: "numeric",
  });

  return (
    <div
      ref={highlightRef}
      onClick={onClick}
      className="rounded-2xl bg-white px-5 py-4 flex items-center gap-4 cursor-pointer hover:shadow-md transition-all"
      style={{ border: `1.5px solid ${BORDER}` }}
    >
      <Avatar customer={customer} size={40} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-sm" style={{ color: TEXT }}>
            {customer.name}
            {customer.nickname && (
              <span className="font-normal text-xs ml-1.5" style={{ color: MUTED }}>({customer.nickname})</span>
            )}
          </p>
          {customer.membership && (
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: PRIMARY + "18", color: PRIMARY }}
            >
              {customer.membership.label}
            </span>
          )}
          {customer.lineUserId && (
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: "#F0FFF4", color: "#166534", border: "1px solid #BBF7D0" }}
            >
              Line ✓
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          <span className="flex items-center gap-1 text-xs" style={{ color: MUTED }}>
            <Phone size={11} />{customer.phone}
          </span>
          {customer.email && (
            <span className="flex items-center gap-1 text-xs" style={{ color: MUTED }}>
              <Mail size={11} />{customer.email}
            </span>
          )}
        </div>
      </div>

      <div className="text-right hidden sm:block">
        <p className="text-xs font-medium" style={{ color: TEXT }}>{customer._count.bookings} การจอง</p>
        <p className="text-xs" style={{ color: MUTED }}>{joinDate}</p>
      </div>
    </div>
  );
}

// ─── Summary bar ──────────────────────────────────────────────────────────────

function SummaryBar({ customers }: { customers: Customer[] }) {
  const withLine    = customers.filter(c => c.lineUserId).length;
  const withMember  = customers.filter(c => c.membership).length;
  const cards = [
    { label: "ลูกค้าทั้งหมด",    value: String(customers.length), color: TEXT },
    { label: "มีสมาชิก",         value: String(withMember),       color: PRIMARY },
    { label: "เชื่อมต่อ Line",   value: String(withLine),         color: "#166534" },
  ];
  return (
    <div className="grid grid-cols-3 gap-3 mb-6">
      {cards.map(c => (
        <div key={c.label} className="rounded-2xl p-4 bg-white" style={{ border: `1.5px solid ${BORDER}` }}>
          <p className="text-xs mb-1" style={{ color: MUTED }}>{c.label}</p>
          <p className="text-xl font-semibold" style={{ color: c.color }}>{c.value}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type SortKey = "newest" | "oldest" | "name" | "bookings";

export default function CustomersManager({ customers: initial }: Props) {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const [customers, setCustomers] = useState<Customer[]>(initial);
  const [showAdd,   setShowAdd]   = useState(false);
  const [openId,    setOpenId]    = useState<string | null>(null);
  const [search,    setSearch]    = useState("");
  const [sort,      setSort]      = useState<SortKey>("newest");

  const focusRef = useRef<HTMLDivElement | null>(null);

  // Open the modal automatically when navigated with ?id=xxx or ?phone=xxx (from POS)
  useEffect(() => {
    const id    = searchParams.get("id");
    const phone = searchParams.get("phone");
    if (id && customers.some(c => c.id === id)) {
      setOpenId(id);
      setTimeout(() => {
        focusRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 200);
    } else if (phone) {
      const match = customers.find(c => c.phone === phone);
      if (match) setOpenId(match.id);
      else setSearch(phone); // pre-fill search if not found
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleDeleted(id: string) {
    setCustomers(prev => prev.filter(c => c.id !== id));
    router.refresh();
  }

  function handleSaved(saved: Customer) {
    setCustomers(prev => {
      const idx = prev.findIndex(c => c.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
    router.refresh();
  }

  const filtered = useMemo(() => {
    let list = customers;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.email ?? "").toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) => {
      if (sort === "newest")   return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sort === "oldest")   return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sort === "name")     return a.name.localeCompare(b.name, "th");
      if (sort === "bookings") return b._count.bookings - a._count.bookings;
      return 0;
    });
  }, [customers, search, sort]);

  const focusId   = searchParams.get("id");
  const openedCustomer = customers.find(c => c.id === openId) ?? null;

  return (
    <div className="px-6 py-8 max-w-3xl">
      {/* header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: MUTED }}>CRM</p>
          <h1 className="text-2xl font-medium" style={{ color: TEXT }}>ลูกค้า</h1>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white"
          style={{ background: PRIMARY }}
        >
          <UserPlus size={16} />
          เพิ่มลูกค้า
        </button>
      </div>

      <SummaryBar customers={customers} />

      {/* search + sort */}
      <div className="flex gap-3 mb-5 items-center flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-2.5" color={MUTED} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="ค้นหาชื่อ, เบอร์, อีเมล..."
            className="w-full pl-8 pr-3 py-2 text-sm rounded-xl border"
            style={{ borderColor: BORDER, color: TEXT }}
          />
        </div>
        <div className="relative">
          <select
            value={sort}
            onChange={e => setSort(e.target.value as SortKey)}
            className="appearance-none pl-3 pr-8 py-2 text-sm rounded-xl border"
            style={{ borderColor: BORDER, color: TEXT, background: "white" }}
          >
            <option value="newest">ใหม่สุด</option>
            <option value="oldest">เก่าสุด</option>
            <option value="name">ชื่อ A–Z</option>
            <option value="bookings">การจองมากสุด</option>
          </select>
          <ChevronDown size={13} className="absolute right-2 top-2.5 pointer-events-none" color={MUTED} />
        </div>
        <p className="text-xs" style={{ color: MUTED }}>{filtered.length} คน</p>
      </div>

      {/* customer list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 rounded-2xl bg-white" style={{ border: `1.5px solid ${BORDER}` }}>
          <p className="text-sm" style={{ color: MUTED }}>
            {search ? "ไม่พบลูกค้าที่ค้นหา" : "ยังไม่มีลูกค้า"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => (
            <CustomerCard
              key={c.id}
              customer={c}
              onClick={() => setOpenId(c.id)}
              highlightRef={c.id === focusId ? focusRef : undefined}
            />
          ))}
        </div>
      )}

      {/* Add new customer */}
      {showAdd && (
        <AddCustomerModal
          onClose={() => setShowAdd(false)}
          onSaved={handleSaved}
        />
      )}

      {/* Customer detail modal */}
      {openedCustomer && (
        <CustomerDetailModal
          customer={openedCustomer}
          onClose={() => setOpenId(null)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}
