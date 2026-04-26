"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";
import {
  UserPlus, Pencil, Search, ChevronDown, ChevronUp,
  X, Save, Phone, Mail, Calendar, Hash,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MembershipTier { name: string; nameTh: string; color: string }
interface MembershipInfo { points: number; tier: MembershipTier }

interface Customer {
  id:         string;
  name:       string;
  phone:      string;
  email:      string | null;
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

function fmt(satang: number) {
  return `฿${(satang / 100).toLocaleString("th-TH")}`;
}

// Generate a consistent pastel background from name
function avatarBg(name: string) {
  const palette = ["#F0E4D8","#E4EEF0","#EAE4F0","#E4F0E9","#F0EAE4"];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return palette[Math.abs(h) % palette.length];
}

// ─── Portal wrapper ───────────────────────────────────────────────────────────

function Modal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}

// ─── Customer form modal (add + edit) ─────────────────────────────────────────

interface CustomerFormProps {
  initial?: Customer;
  onClose: () => void;
  onSaved: (c: Customer) => void;
}

function CustomerFormModal({ initial, onClose, onSaved }: CustomerFormProps) {
  const isEdit = !!initial;
  const [name,  setName]  = useState(initial?.name  ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  async function handleSave() {
    if (!name.trim())  { setError("กรุณากรอกชื่อ"); return; }
    if (!phone.trim()) { setError("กรุณากรอกเบอร์โทร"); return; }

    setSaving(true);
    setError("");
    try {
      const url    = isEdit ? `/api/admin/customers/${initial!.id}` : "/api/admin/customers";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim(), email: email.trim() || null }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "เกิดข้อผิดพลาด");
      const saved = await res.json();
      onSaved(saved);
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
        <div
          className="w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          style={{ background: "white" }}
        >
          {/* header */}
          <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: BORDER }}>
            <h2 className="font-semibold text-sm" style={{ color: TEXT }}>
              {isEdit ? "แก้ไขข้อมูลลูกค้า" : "เพิ่มลูกค้าใหม่"}
            </h2>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
              <X size={17} color={MUTED} />
            </button>
          </div>

          {/* body */}
          <div className="px-6 py-5 space-y-4">
            <div>
              <label className="block text-xs mb-1 font-medium" style={{ color: MUTED }}>ชื่อ-นามสกุล *</label>
              <input
                autoFocus
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="เช่น สมชาย ใจดี"
                className="w-full px-3 py-2 text-sm rounded-xl border"
                style={{ borderColor: BORDER, color: TEXT }}
              />
            </div>

            <div>
              <label className="block text-xs mb-1 font-medium" style={{ color: MUTED }}>เบอร์โทรศัพท์ *</label>
              <input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="0812345678"
                type="tel"
                className="w-full px-3 py-2 text-sm rounded-xl border"
                style={{ borderColor: BORDER, color: TEXT }}
              />
            </div>

            <div>
              <label className="block text-xs mb-1 font-medium" style={{ color: MUTED }}>อีเมล (ไม่บังคับ)</label>
              <input
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="example@email.com"
                type="email"
                className="w-full px-3 py-2 text-sm rounded-xl border"
                style={{ borderColor: BORDER, color: TEXT }}
              />
            </div>

            {/* Line LIFF placeholder */}
            {isEdit && initial?.lineUserId && (
              <div>
                <label className="block text-xs mb-1 font-medium" style={{ color: MUTED }}>Line User ID</label>
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
                  style={{ background: "#F0FFF4", border: "1px solid #BBF7D0", color: "#166534" }}
                >
                  {/* Line icon approximation */}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="#06C755">
                    <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
                  </svg>
                  <span className="font-mono truncate">{initial.lineUserId}</span>
                  <span className="ml-auto text-green-700 font-medium">เชื่อมต่อแล้ว</span>
                </div>
              </div>
            )}

            {isEdit && !initial?.lineUserId && (
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
                style={{ background: "#F9F3EE", border: `1px solid ${BORDER}`, color: MUTED }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill={MUTED}>
                  <path d="M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
                </svg>
                Line ยังไม่ได้เชื่อมต่อ — จะเชื่อมอัตโนมัติเมื่อลูกค้าล็อกอินผ่าน Line LIFF
              </div>
            )}

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

// ─── Expanded booking history panel ──────────────────────────────────────────

function BookingHistory({ customerId }: { customerId: string }) {
  const [bookings, setBookings] = useState<BookingRecord[] | null>(null);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    fetch(`/api/admin/customers/${customerId}/bookings`)
      .then(r => r.json())
      .then(data => { setBookings(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [customerId]);

  if (loading) return <p className="text-xs py-3 text-center" style={{ color: MUTED }}>กำลังโหลด...</p>;
  if (!bookings || bookings.length === 0)
    return <p className="text-xs py-3 text-center" style={{ color: MUTED }}>ยังไม่มีประวัติการจอง</p>;

  return (
    <div className="space-y-2">
      {bookings.map(b => {
        const sc = STATUS_STYLE[b.status] ?? STATUS_STYLE.PENDING;
        const dateStr = new Date(b.date + (b.date.length === 10 ? "T12:00:00" : ""))
          .toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
        return (
          <div
            key={b.id}
            className="flex items-center justify-between gap-3 py-2 border-b last:border-0 text-xs"
            style={{ borderColor: BORDER }}
          >
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate" style={{ color: TEXT }}>
                {b.service.nameTh || b.service.name}
              </p>
              <p style={{ color: MUTED }}>
                {dateStr} · {b.startTime}–{b.endTime}
                {b.staff && ` · ${b.staff.name}`} · {b.branch.name}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="px-2 py-0.5 rounded-full font-medium" style={{ background: sc.bg, color: sc.color }}>
                {STATUS_LABEL[b.status] ?? b.status}
              </span>
              <span className="font-semibold" style={{ color: PRIMARY }}>{fmt(b.totalPrice)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Customer row card ────────────────────────────────────────────────────────

function CustomerCard({
  customer,
  onEdit,
  initialExpanded,
  highlightRef,
}: {
  customer: Customer;
  onEdit: () => void;
  initialExpanded?: boolean;
  highlightRef?: (el: HTMLDivElement | null) => void;
}) {
  const [expanded, setExpanded] = useState(initialExpanded ?? false);
  const bg = avatarBg(customer.name);

  const joinDate = new Date(customer.createdAt).toLocaleDateString("th-TH", {
    day: "numeric", month: "short", year: "numeric",
  });

  return (
    <div
      ref={highlightRef}
      className="rounded-2xl overflow-hidden bg-white transition-all"
      style={{ border: `1.5px solid ${initialExpanded ? "#8B1D24" : BORDER}` }}
    >
      {/* main row */}
      <div className="flex items-center gap-4 px-5 py-4">
        {/* avatar */}
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0"
          style={{ background: bg, color: "#6B5245" }}
        >
          {customer.name[0]?.toUpperCase()}
        </div>

        {/* info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-sm" style={{ color: TEXT }}>{customer.name}</p>
            {customer.membership?.tier && (
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{
                  background: customer.membership.tier.color + "22",
                  color: customer.membership.tier.color,
                }}
              >
                {customer.membership.tier.nameTh}
                {customer.membership.points > 0 && ` · ${customer.membership.points} pts`}
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

        {/* stats + actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="text-right hidden sm:block mr-2">
            <p className="text-xs font-medium" style={{ color: TEXT }}>{customer._count.bookings} การจอง</p>
            <p className="text-xs" style={{ color: MUTED }}>{joinDate}</p>
          </div>
          <button
            onClick={onEdit}
            className="p-2 rounded-xl hover:bg-blue-50 transition-colors"
            title="แก้ไข"
          >
            <Pencil size={14} color="#2563EB" />
          </button>
          <button
            onClick={() => setExpanded(x => !x)}
            className="p-2 rounded-xl hover:bg-gray-50 transition-colors"
            title="ประวัติการจอง"
          >
            {expanded
              ? <ChevronUp size={15} color={MUTED} />
              : <ChevronDown size={15} color={MUTED} />
            }
          </button>
        </div>
      </div>

      {/* expanded: booking history */}
      {expanded && (
        <div className="border-t px-5 py-4" style={{ borderColor: BORDER, background: BG }}>
          <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: MUTED }}>
            ประวัติการจอง
          </p>
          <BookingHistory customerId={customer.id} />
        </div>
      )}
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const focusId = searchParams.get("id");

  const [customers, setCustomers] = useState<Customer[]>(initial);
  const [showAdd,   setShowAdd]   = useState(false);
  const [editing,   setEditing]   = useState<Customer | null>(null);
  const [search,    setSearch]    = useState("");
  const [sort,      setSort]      = useState<SortKey>("newest");

  // Scroll to & briefly highlight the focused customer (linked from a booking)
  const focusCardRef = (el: HTMLDivElement | null) => {
    if (!el) return;
    setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.style.boxShadow = "0 0 0 4px rgba(139,29,36,0.15)";
      setTimeout(() => { el.style.boxShadow = ""; }, 2000);
    }, 100);
  };

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

      {/* summary */}
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

      {/* Line LIFF notice */}
      <div
        className="flex items-start gap-3 px-4 py-3 rounded-2xl mb-5 text-xs"
        style={{ background: "#F0FFF4", border: "1px solid #BBF7D0", color: "#166534" }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="#06C755" className="flex-shrink-0 mt-0.5">
          <path d="M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
        </svg>
        <div>
          <p className="font-semibold mb-0.5">Line LIFF Integration (เร็วๆ นี้)</p>
          <p style={{ color: "#15803D" }}>
            เมื่อลูกค้าล็อกอินผ่าน Line LIFF ระบบจะเชื่อม Line User ID เข้ากับโปรไฟล์ลูกค้าอัตโนมัติ
            พร้อมดึงชื่อและรูปโปรไฟล์จาก Line
          </p>
        </div>
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
              onEdit={() => setEditing(c)}
              initialExpanded={c.id === focusId}
              highlightRef={c.id === focusId ? focusCardRef : undefined}
            />
          ))}
        </div>
      )}

      {/* Add modal */}
      {showAdd && (
        <CustomerFormModal
          onClose={() => setShowAdd(false)}
          onSaved={handleSaved}
        />
      )}

      {/* Edit modal */}
      {editing && (
        <CustomerFormModal
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
