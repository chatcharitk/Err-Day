"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Pencil, Phone, Mail, User, Sparkles, Package as PackageIcon,
  Loader2, AlertCircle, Check, Clock, MapPin, Camera, Plus, Trash2, X,
  Receipt, Info, FileImage, NotebookPen, Cake, ChevronRight,
} from "lucide-react";
import LineLinkButton from "@/components/LineLinkButton";

const PACKAGE_OPTIONS: { sku: string; nameTh: string; price: number }[] = [
  { sku: "svc-buffet", nameTh: "Buffet 30 วัน",   price: 3500 },
  { sku: "svc-pkg5",   nameTh: "แพ็กเกจ 5 ครั้ง", price: 1600 },
];

function todayPlusDays(days: number): string {
  const d = new Date(); d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isoDateInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const PRIMARY = "#8B1D24";
const TEXT    = "#3B2A24";
const MUTED   = "#A08070";
const BORDER  = "#E8D8CC";

interface Membership {
  id:                string;
  label:             string;
  activatedAt:       string;
  expiresAt:         string | null;
  usagesUsed:        number;
  usagesAllowed:     number;
  pendingActivation: boolean;
}

interface Package {
  id:                string;
  sku:               string;
  nameTh:            string;
  startedAt:         string;
  expiresAt:         string;
  usagesUsed:        number;
  usageLimit:        number;
  usagesLeft:        number | null;
  pendingActivation: boolean;
  /** Branch it was bought at: "S1" | "S2" | null (unknown / manual entry). */
  branchCode:        string | null;
}

type Status = "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED" | "NO_SHOW";

interface BookingRow {
  id:          string;
  date:        string;
  startTime:   string;
  endTime:     string;
  status:      Status;
  totalPrice:  number;
  branchName:  string;
  serviceName: string;
}

interface MembershipCycle {
  id:            string;
  startedAt:     string;
  endedAt:       string;
  closedAt:      string | null;
  paidAmount:    number;
  paymentMethod: string | null;
  bookingsUsed:  number;
  /** Branch it was bought at: "S1" | "S2" | null (unknown / manual entry). */
  branchCode:    string | null;
  notes:         string | null;
}

interface Customer {
  id:            string;
  name:          string;
  nickname:      string | null;
  phone:         string;
  email:         string | null;
  gender:        string | null;
  dateOfBirth:   string | null;
  lineUserId:    string | null;
  pictureUrl:    string | null;
  notes:         string | null;
  photoUrls:     string | null;   // JSON-encoded string[]
  bookingsCount: number;
  membership:    Membership | null;
  membershipCycles: MembershipCycle[];
  packages:      Package[];
  recentBookings: BookingRow[];
}

const STATUS_TH: Record<Status, string> = {
  PENDING: "รอยืนยัน", CONFIRMED: "ยืนยัน", CANCELLED: "ยกเลิก", COMPLETED: "เสร็จ", NO_SHOW: "ไม่มา",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hour12: false });
  return `${date} · ${time}`;
}

function fmtPrice(satang: number) {
  return `฿${(satang / 100).toLocaleString()}`;
}

function paymentLabel(method: string | null): string {
  switch (method) {
    case "POS":       return "ขายผ่าน POS";
    case "PromptPay": return "PromptPay";
    case "Manual":    return "บันทึกด้วยตนเอง";
    default:          return method ?? "—";
  }
}

export default function CustomerDetail({ customer: initial }: { customer: Customer }) {
  const router = useRouter();
  const [c, setC] = useState(initial);
  const [editing, setEditing] = useState(false);

  const [name,        setName]        = useState(c.name);
  const [nickname,    setNickname]    = useState(c.nickname ?? "");
  const [phone,       setPhone]       = useState(c.phone);
  const [email,       setEmail]       = useState(c.email ?? "");
  const [gender,      setGender]      = useState(c.gender ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(isoDateInput(c.dateOfBirth));
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  // Membership / package edit state
  const [editingMembership, setEditingMembership] = useState(false);
  const [editingPkgId,      setEditingPkgId]      = useState<string | null>(null);
  const [showAddMembership, setShowAddMembership] = useState(false);
  const [showAddPackage,    setShowAddPackage]    = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyError, setBusyError] = useState("");

  // Notes state
  const [notes,       setNotes]       = useState(c.notes ?? "");
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSaved,  setNotesSaved]  = useState(false);

  // Photo gallery state
  const [photos, setPhotos] = useState<string[]>(() => {
    try { return JSON.parse(c.photoUrls ?? "[]"); } catch { return []; }
  });
  const [photoUploading, setPhotoUploading] = useState(false);
  const [lightboxUrl,    setLightboxUrl]    = useState<string | null>(null);

  // Membership status (inclusive expiry)
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  let memberStatus: "active" | "pending" | "expired" | null = null;
  if (c.membership) {
    const m = c.membership;
    const expired = m.expiresAt != null && new Date(m.expiresAt) < today;
    const usedUp  = m.usagesAllowed > 0 && m.usagesUsed >= m.usagesAllowed;
    if      (m.pendingActivation) memberStatus = "pending";
    else if (expired || usedUp)   memberStatus = "expired";
    else                          memberStatus = "active";
  }

  const startEdit = () => {
    setName(c.name);
    setNickname(c.nickname ?? "");
    setPhone(c.phone);
    setEmail(c.email ?? "");
    setGender(c.gender ?? "");
    setDateOfBirth(isoDateInput(c.dateOfBirth));
    setError("");
    setEditing(true);
  };

  // ── Membership management ───────────────────────────────────────────────────
  const refreshFromServer = () => router.refresh();

  const saveMembership = async (data: { expiresAt?: string | null; usagesAllowed?: number; label?: string; pendingActivation?: boolean; activate?: boolean }) => {
    setBusy(true); setBusyError("");
    try {
      const res = await fetch(`/api/admin/customers/${c.id}/membership`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) { setBusyError("บันทึกไม่สำเร็จ"); return false; }
      const m = await res.json();
      setC(prev => ({ ...prev, membership: prev.membership ? {
        ...prev.membership,
        expiresAt: m.expiresAt ?? null,
        usagesAllowed: m.usagesAllowed,
        label: m.label,
        pendingActivation: m.pendingActivation,
      } : null }));
      return true;
    } finally { setBusy(false); }
  };

  const deleteMembership = async () => {
    if (!confirm("ลบสมาชิกของลูกค้านี้?")) return;
    setBusy(true); setBusyError("");
    try {
      const res = await fetch(`/api/admin/customers/${c.id}/membership`, { method: "DELETE" });
      if (!res.ok) { setBusyError("ลบไม่สำเร็จ"); return; }
      setC(prev => ({ ...prev, membership: null }));
    } finally { setBusy(false); }
  };

  const createMembership = async (expiresAt: string, usagesAllowed: number, pendingActivation: boolean) => {
    setBusy(true); setBusyError("");
    try {
      const res = await fetch(`/api/admin/customers/${c.id}/membership`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expiresAt, usagesAllowed, pendingActivation, label: "สมาชิก" }),
      });
      if (!res.ok) { setBusyError("สร้างไม่สำเร็จ"); return false; }
      refreshFromServer();
      return true;
    } finally { setBusy(false); }
  };

  // ── Package management ──────────────────────────────────────────────────────
  const savePackage = async (pkgId: string, data: { expiresAt?: string; usagesUsed?: number; activate?: boolean }) => {
    setBusy(true); setBusyError("");
    try {
      const res = await fetch(`/api/admin/customers/${c.id}/packages/${pkgId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) { setBusyError("บันทึกไม่สำเร็จ"); return false; }
      refreshFromServer();
      return true;
    } finally { setBusy(false); }
  };

  const deletePackage = async (pkgId: string) => {
    if (!confirm("ลบแพ็กเกจนี้?")) return;
    setBusy(true); setBusyError("");
    try {
      const res = await fetch(`/api/admin/customers/${c.id}/packages/${pkgId}`, { method: "DELETE" });
      if (!res.ok) { setBusyError("ลบไม่สำเร็จ"); return; }
      setC(prev => ({ ...prev, packages: prev.packages.filter(p => p.id !== pkgId) }));
    } finally { setBusy(false); }
  };

  const deleteCustomer = async () => {
    if (!confirm(`ลบลูกค้า "${c.name}" และข้อมูลทั้งหมด (การจอง, สมาชิก, แพ็กเกจ)?\nการกระทำนี้ไม่สามารถย้อนกลับได้`)) return;
    setBusy(true); setBusyError("");
    try {
      const res = await fetch(`/api/admin/customers/${c.id}`, { method: "DELETE" });
      if (!res.ok) { setBusyError("ลบไม่สำเร็จ"); return; }
      router.push("/admin/m/customers");
    } finally { setBusy(false); }
  };

  const createPackage = async (sku: string, expiresAt: string, pendingActivation: boolean) => {
    setBusy(true); setBusyError("");
    try {
      const res = await fetch(`/api/admin/customers/${c.id}/packages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku, expiresAt, pendingActivation }),
      });
      if (!res.ok) { setBusyError("สร้างไม่สำเร็จ"); return false; }
      refreshFromServer();
      return true;
    } finally { setBusy(false); }
  };

  // ── Notes ──────────────────────────────────────────────────────────────────
  const saveNotes = async () => {
    setNotesSaving(true);
    try {
      await fetch(`/api/admin/customers/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2000);
    } finally { setNotesSaving(false); }
  };

  // ── Photos ─────────────────────────────────────────────────────────────────
  const addPhotos = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;
    input.onchange = async (e) => {
      const files = Array.from((e.target as HTMLInputElement).files ?? []);
      if (!files.length) return;
      setPhotoUploading(true);
      try {
        const newUrls: string[] = [];
        for (const file of files) {
          const fd = new FormData();
          fd.append("file", file);
          const res  = await fetch(`/api/upload?kind=customer-photo&ref=${c.id}`, { method: "POST", body: fd });
          const data = await res.json();
          if (res.ok) newUrls.push(data.url);
        }
        const all = [...photos, ...newUrls];
        await fetch(`/api/admin/customers/${c.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photoUrls: JSON.stringify(all) }),
        });
        setPhotos(all);
      } finally { setPhotoUploading(false); }
    };
    input.click();
  };

  const removePhoto = async (url: string) => {
    if (!confirm("ลบรูปนี้?")) return;
    const next = photos.filter(p => p !== url);
    await fetch(`/api/admin/customers/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoUrls: JSON.stringify(next) }),
    });
    setPhotos(next);
  };

  const handleSave = async () => {
    if (!name.trim() || !phone.trim()) { setError("กรุณาระบุชื่อและเบอร์โทร"); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/customers/${c.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ name, nickname, phone, email, gender, dateOfBirth: dateOfBirth || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "บันทึกไม่สำเร็จ");
        setSaving(false);
        return;
      }
      setC(prev => ({ ...prev, name, nickname: nickname || null, phone, email: email || null, gender: gender || null, dateOfBirth: dateOfBirth || null }));
      setEditing(false);
      setSaving(false);
      router.refresh();
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
      setSaving(false);
    }
  };

  return (
    <main className="pb-32">
      <header className="sticky top-0 z-20 bg-white" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <div className="px-4 py-3 flex items-center gap-2">
          <button onClick={() => router.back()} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ color: TEXT }}>
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-base font-medium flex-1 truncate" style={{ color: TEXT }}>{c.name}</h1>
          {!editing && (
            <button
              onClick={startEdit}
              className="flex items-center gap-1 px-3 h-9 rounded-full text-xs font-medium"
              style={{ border: `1px solid ${BORDER}`, color: TEXT }}
            >
              <Pencil size={13} /> แก้ไข
            </button>
          )}
        </div>
      </header>

      {/* Profile card */}
      <section className="px-4 py-4">
        <div className="flex items-center gap-3 mb-3">
          <ProfileAvatar
            pictureUrl={c.pictureUrl}
            name={c.name}
            customerId={c.id}
            onPictureChange={(url) => setC(prev => ({ ...prev, pictureUrl: url }))}
          />
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold" style={{ color: TEXT }}>{c.name}</p>
            {c.nickname && <p className="text-sm" style={{ color: MUTED }}>{c.nickname}</p>}
            <p className="text-xs mt-0.5" style={{ color: MUTED }}>{c.bookingsCount} การจอง</p>
          </div>
        </div>

        {!editing && (
          <div className="mb-3">
            <LineLinkButton customerId={c.id} linked={!!c.lineUserId} />
          </div>
        )}

        {editing ? (
          <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: BORDER, background: "#FAFAFA" }}>
            <p className="text-sm font-semibold" style={{ color: TEXT }}>แก้ไขข้อมูลลูกค้า</p>
            <div>
              <label className="block text-xs mb-1 font-medium" style={{ color: MUTED }}>ชื่อ-นามสกุล *</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                style={{ borderColor: BORDER, color: TEXT }} />
            </div>
            <div>
              <label className="block text-xs mb-1 font-medium" style={{ color: MUTED }}>ชื่อเล่น</label>
              <input type="text" value={nickname} onChange={e => setNickname(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                style={{ borderColor: BORDER, color: TEXT }} />
            </div>
            <div>
              <label className="block text-xs mb-1 font-medium" style={{ color: MUTED }}>เบอร์โทร *</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                style={{ borderColor: BORDER, color: TEXT }} />
            </div>
            <div>
              <label className="block text-xs mb-1 font-medium" style={{ color: MUTED }}>อีเมล</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                style={{ borderColor: BORDER, color: TEXT }} />
            </div>
            <div>
              <label className="block text-xs mb-1 font-medium" style={{ color: MUTED }}>เพศ</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { v: "FEMALE", t: "หญิง" },
                  { v: "MALE",   t: "ชาย" },
                  { v: "OTHER",  t: "อื่น ๆ" },
                ].map(g => (
                  <button key={g.v} type="button"
                    onClick={() => setGender(gender === g.v ? "" : g.v)}
                    className="py-2 rounded-lg text-sm font-medium"
                    style={{
                      background: gender === g.v ? PRIMARY : "white",
                      color:      gender === g.v ? "white" : TEXT,
                      border:     `1.5px solid ${gender === g.v ? PRIMARY : BORDER}`,
                    }}
                  >{g.t}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs mb-1 font-medium" style={{ color: MUTED }}>วันเกิด</label>
              <input type="date" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                style={{ borderColor: BORDER, color: dateOfBirth ? TEXT : MUTED }} />
            </div>
            {error && (
              <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm" style={{ background: "#FEF2F2", color: "#991b1b" }}>
                <AlertCircle size={14} /> {error}
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button onClick={() => setEditing(false)}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium"
                style={{ border: `1px solid ${BORDER}`, color: MUTED, background: "white" }}>
                ยกเลิก
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-1.5"
                style={{ background: PRIMARY }}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                {saving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border" style={{ borderColor: BORDER }}>
            <div className="px-3 py-2.5 flex items-center gap-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
              <Phone size={14} style={{ color: MUTED }} />
              <span className="text-sm" style={{ color: TEXT }}>{c.phone}</span>
            </div>
            <div className="px-3 py-2.5 flex items-center gap-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
              <Mail size={14} style={{ color: MUTED }} />
              <span className="text-sm" style={{ color: c.email ? TEXT : MUTED }}>{c.email ?? "—"}</span>
            </div>
            <div className="px-3 py-2.5 flex items-center gap-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
              <User size={14} style={{ color: MUTED }} />
              <span className="text-sm" style={{ color: c.gender ? TEXT : MUTED }}>
                {c.gender === "FEMALE" ? "หญิง" : c.gender === "MALE" ? "ชาย" : c.gender === "OTHER" ? "อื่น ๆ" : "—"}
              </span>
            </div>
            <div className="px-3 py-2.5 flex items-center gap-3">
              <Cake size={14} style={{ color: MUTED }} />
              <span className="text-sm" style={{ color: c.dateOfBirth ? TEXT : MUTED }}>
                {c.dateOfBirth
                  ? new Date(c.dateOfBirth).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })
                  : "—"}
              </span>
            </div>
          </div>
        )}
      </section>

      {/* Membership */}
      <section className="px-4 pb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium uppercase tracking-widest" style={{ color: MUTED }}>สมาชิก</p>
          {!c.membership && !showAddMembership && (
            <button onClick={() => setShowAddMembership(true)} className="text-xs flex items-center gap-1" style={{ color: PRIMARY }}>
              <Plus size={12} /> เพิ่มสมาชิก
            </button>
          )}
        </div>

        {showAddMembership && !c.membership && (
          <MembershipForm
            initialExpiresAt={todayPlusDays(29)}
            initialUsagesAllowed={0}
            initialPending={false}
            busy={busy}
            onCancel={() => { setShowAddMembership(false); setBusyError(""); }}
            onSave={async (data) => {
              const ok = await createMembership(data.expiresAt, data.usagesAllowed, data.pendingActivation);
              if (ok) setShowAddMembership(false);
            }}
            submitLabel="สร้างสมาชิก"
          />
        )}

        {c.membership && memberStatus && !editingMembership && (
          <div className="rounded-xl p-3" style={{
            background:
              memberStatus === "active"  ? "#F0FDF4" :
              memberStatus === "pending" ? "#FFF7ED" :
              "#F3F4F6",
            border: `1px solid ${
              memberStatus === "active"  ? "#86EFAC" :
              memberStatus === "pending" ? "#FED7AA" :
              "#E5E7EB"
            }`,
          }}>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={14} style={{ color:
                memberStatus === "active"  ? "#16a34a" :
                memberStatus === "pending" ? "#9A3412" :
                "#6B7280"
              }} />
              <p className="text-sm font-semibold flex-1" style={{ color:
                memberStatus === "active"  ? "#166534" :
                memberStatus === "pending" ? "#9A3412" :
                "#6B7280"
              }}>
                {c.membership.label}
                {memberStatus === "active"  && " — ใช้งานได้"}
                {memberStatus === "pending" && " — รอเปิดใช้งาน"}
                {memberStatus === "expired" && " — หมดอายุ / ใช้ครบ"}
              </p>
              <button onClick={() => setEditingMembership(true)} className="p-1" style={{ color: MUTED }}>
                <Pencil size={12} />
              </button>
            </div>
            <p className="text-xs" style={{ color: TEXT }}>
              {c.membership.expiresAt ? `หมดอายุ: ${fmtDate(c.membership.expiresAt)}` : "ตลอดชีพ"}
              {c.membership.usagesAllowed > 0 && ` · ใช้ ${c.membership.usagesUsed}/${c.membership.usagesAllowed} ครั้ง`}
            </p>
            <p className="text-[11px] mt-1.5 flex items-start gap-1" style={{ color: MUTED }}>
              <Info size={10} className="flex-shrink-0 mt-0.5" />
              <span>ต่ออายุ: ขายบริการ &quot;สมาชิก 30 วัน&quot; ที่ POS</span>
            </p>
            <div className="flex gap-2 mt-2">
              {memberStatus === "pending" && (
                <button
                  onClick={async () => { const ok = await saveMembership({ activate: true }); if (ok) router.refresh(); }}
                  disabled={busy}
                  className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                  style={{ background: PRIMARY }}
                >
                  เปิดใช้งาน (เริ่ม 30 วันวันนี้)
                </button>
              )}
              <button
                onClick={deleteMembership}
                disabled={busy}
                className="px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
                style={{ background: "white", color: "#991B1B", border: `1px solid ${BORDER}` }}
              >
                <Trash2 size={11} className="inline" /> ลบ
              </button>
            </div>
          </div>
        )}

        {c.membership && editingMembership && (
          <MembershipForm
            initialExpiresAt={isoDateInput(c.membership.expiresAt)}
            initialUsagesAllowed={c.membership.usagesAllowed}
            initialPending={c.membership.pendingActivation}
            busy={busy}
            onCancel={() => { setEditingMembership(false); setBusyError(""); }}
            onSave={async (data) => {
              const ok = await saveMembership(data);
              if (ok) setEditingMembership(false);
            }}
            submitLabel="บันทึก"
          />
        )}

        {busyError && <p className="text-xs text-red-600 mt-1">{busyError}</p>}
      </section>

      {/* Membership purchase history */}
      {c.membershipCycles.length > 0 && (
        <section className="px-4 pb-4">
          <p className="text-xs mb-2 font-medium uppercase tracking-widest" style={{ color: MUTED }}>
            ประวัติการซื้อสมาชิก
          </p>
          <div className="space-y-2">
            {c.membershipCycles.map((cy, i) => {
              const isOpen = cy.closedAt == null;
              // Show live count for the open cycle, snapshotted count for closed ones
              const usageCount = isOpen ? (c.membership?.usagesUsed ?? 0) : cy.bookingsUsed;
              return (
                <div
                  key={cy.id}
                  className="rounded-xl p-3"
                  style={{
                    background: isOpen ? "#F0FDF4" : "white",
                    border:     `1px solid ${isOpen ? "#86EFAC" : BORDER}`,
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Receipt size={13} style={{ color: isOpen ? "#16a34a" : MUTED }} />
                    <p className="text-sm font-semibold flex-1" style={{ color: TEXT }}>สมาชิก 30 วัน</p>
                    {cy.branchCode && (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                        style={{ background: "#F0E4D8", color: PRIMARY }}
                        title="สาขาที่ซื้อ"
                      >
                        {cy.branchCode}
                      </span>
                    )}
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                      style={
                        isOpen
                          ? { background: "#DCFCE7", color: "#166534" }
                          : { background: "#F3F4F6", color: "#6B7280" }
                      }
                    >
                      {isOpen ? "ใช้งานอยู่" : "ปิดแล้ว"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]" style={{ color: TEXT }}>
                    <div>
                      <span style={{ color: MUTED }}>ซื้อเมื่อ</span>
                      <p className="font-medium">{fmtDateTime(cy.startedAt)}</p>
                    </div>
                    <div>
                      <span style={{ color: MUTED }}>หมดอายุ</span>
                      <p className="font-medium">{fmtDate(cy.endedAt)}</p>
                    </div>
                    <div>
                      <span style={{ color: MUTED }}>ชำระ</span>
                      <p className="font-medium">
                        {cy.paidAmount > 0 ? fmtPrice(cy.paidAmount) : "—"}
                        <span className="font-normal" style={{ color: MUTED }}> · {paymentLabel(cy.paymentMethod)}</span>
                      </p>
                    </div>
                    <div>
                      <span style={{ color: MUTED }}>ใช้</span>
                      <p className="font-medium">
                        {usageCount} ครั้ง
                        {!isOpen && cy.closedAt && <span className="font-normal" style={{ color: MUTED }}> · ปิด {fmtDate(cy.closedAt)}</span>}
                      </p>
                    </div>
                  </div>
                  {cy.notes && (
                    <p className="text-[10px] italic mt-2 pt-2 border-t" style={{ color: MUTED, borderColor: "#F5EFE9" }}>
                      &ldquo;{cy.notes}&rdquo;
                    </p>
                  )}
                  {i === 0 && isOpen && (
                    <p className="text-[10px] mt-2 pt-2 border-t flex items-start gap-1" style={{ color: MUTED, borderColor: "#DCFCE7" }}>
                      <Info size={10} className="flex-shrink-0 mt-0.5" />
                      <span>รอบนี้กำลังใช้งานอยู่ — ยอดใช้งานจะถูกบันทึกเมื่อต่ออายุ</span>
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Packages */}
      <section className="px-4 pb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium uppercase tracking-widest" style={{ color: MUTED }}>แพ็กเกจ</p>
          {!showAddPackage && (
            <button onClick={() => setShowAddPackage(true)} className="text-xs flex items-center gap-1" style={{ color: PRIMARY }}>
              <Plus size={12} /> เพิ่มแพ็กเกจ
            </button>
          )}
        </div>

        {showAddPackage && (
          <PackageCreateForm
            busy={busy}
            onCancel={() => { setShowAddPackage(false); setBusyError(""); }}
            onSave={async (data) => {
              const ok = await createPackage(data.sku, data.expiresAt, data.pendingActivation);
              if (ok) setShowAddPackage(false);
            }}
          />
        )}

        {c.packages.length > 0 && (
          <div className="space-y-2 mt-2">
            {c.packages.map(p => (
              editingPkgId === p.id ? (
                <PackageEditForm
                  key={p.id}
                  initialExpiresAt={isoDateInput(p.expiresAt)}
                  initialUsagesUsed={p.usagesUsed}
                  busy={busy}
                  onCancel={() => { setEditingPkgId(null); setBusyError(""); }}
                  onSave={async (data) => {
                    const ok = await savePackage(p.id, data);
                    if (ok) setEditingPkgId(null);
                  }}
                />
              ) : (
                <div key={p.id} className="rounded-xl p-3" style={{
                  background: p.pendingActivation ? "#FFF7ED" : "#EFF6FF",
                  border:     `1px solid ${p.pendingActivation ? "#FED7AA" : "#BFDBFE"}`,
                }}>
                  <div className="flex items-center gap-2 mb-1">
                    <PackageIcon size={14} style={{ color: p.pendingActivation ? "#9A3412" : "#1D4ED8" }} />
                    <p className="text-sm font-semibold flex-1" style={{ color: p.pendingActivation ? "#9A3412" : "#1D4ED8" }}>
                      {p.nameTh}
                      {p.pendingActivation && " — รอเปิดใช้งาน"}
                    </p>
                    {p.branchCode && (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                        style={{ background: "#F0E4D8", color: PRIMARY }}
                        title="สาขาที่ซื้อ"
                      >
                        {p.branchCode}
                      </span>
                    )}
                    <button onClick={() => setEditingPkgId(p.id)} className="p-1" style={{ color: MUTED }}>
                      <Pencil size={12} />
                    </button>
                  </div>
                  <p className="text-xs" style={{ color: TEXT }}>
                    หมดอายุ: {fmtDate(p.expiresAt)}
                    {p.usagesLeft != null && ` · ยังใช้ได้อีก ${p.usagesLeft} ครั้ง จากทั้งหมด ${p.usageLimit} ครั้ง (ใช้ไปแล้ว ${p.usagesUsed})`}
                  </p>
                  <div className="flex gap-2 mt-2">
                    {p.pendingActivation && (
                      <button
                        onClick={() => savePackage(p.id, { activate: true })}
                        disabled={busy}
                        className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                        style={{ background: PRIMARY }}
                      >
                        เปิดใช้งาน
                      </button>
                    )}
                    <button
                      onClick={() => deletePackage(p.id)}
                      disabled={busy}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
                      style={{ background: "white", color: "#991B1B", border: `1px solid ${BORDER}` }}
                    >
                      <Trash2 size={11} className="inline" /> ลบ
                    </button>
                  </div>
                </div>
              )
            ))}
          </div>
        )}
      </section>

      {/* Recent bookings */}
      {c.recentBookings.length > 0 && (
        <section className="px-4 pb-4">
          <p className="text-xs mb-2 font-medium uppercase tracking-widest" style={{ color: MUTED }}>ประวัติการจองและการขาย</p>
          <div className="space-y-2">
            {c.recentBookings.map(b => (
              <Link key={b.id} href={`/admin/m/${b.id}`}
                className="block rounded-xl p-3 active:opacity-70"
                style={{ border: `1px solid ${BORDER}`, background: "white" }}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium" style={{ color: TEXT }}>{b.serviceName}</p>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{
                      background: b.status === "COMPLETED" ? "#F0FDF4" : b.status === "CANCELLED" ? "#F3F4F6" : "#FFF8F4",
                      color:      b.status === "COMPLETED" ? "#166534" : b.status === "CANCELLED" ? "#6B7280" : "#9A3412",
                    }}>
                      {STATUS_TH[b.status]}
                    </span>
                    <ChevronRight size={14} style={{ color: MUTED }} />
                  </div>
                </div>
                <p className="text-[11px] flex items-center gap-2" style={{ color: MUTED }}>
                  <span className="inline-flex items-center gap-1"><Clock size={10} />{fmtDate(b.date)} {b.startTime}</span>
                  <span className="inline-flex items-center gap-1"><MapPin size={10} />{b.branchName}</span>
                </p>
                <p className="text-xs mt-1" style={{ color: TEXT }}>{fmtPrice(b.totalPrice)}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Notes */}
      <section className="px-4 pb-4">
        <div className="flex items-center gap-2 mb-2">
          <NotebookPen size={13} style={{ color: MUTED }} />
          <p className="text-xs font-medium uppercase tracking-widest flex-1" style={{ color: MUTED }}>บันทึกภายใน</p>
        </div>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="เพิ่มโน้ตเกี่ยวกับลูกค้า..."
          rows={3}
          className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none resize-none"
          style={{ borderColor: BORDER, color: TEXT, background: "white", lineHeight: "1.5" }}
        />
        <div className="flex justify-end mt-1.5">
          <button
            onClick={saveNotes}
            disabled={notesSaving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
            style={{
              background: notesSaved ? "#F0FDF4" : PRIMARY,
              color:      notesSaved ? "#16a34a" : "white",
            }}
          >
            {notesSaving ? <Loader2 size={11} className="animate-spin" /> : notesSaved ? <Check size={11} /> : null}
            {notesSaving ? "กำลังบันทึก..." : notesSaved ? "บันทึกแล้ว" : "บันทึก"}
          </button>
        </div>
      </section>

      {/* Photo gallery */}
      <section className="px-4 pb-6">
        <div className="flex items-center gap-2 mb-2">
          <FileImage size={13} style={{ color: MUTED }} />
          <p className="text-xs font-medium uppercase tracking-widest flex-1" style={{ color: MUTED }}>รูปภาพ</p>
          <button
            onClick={addPhotos}
            disabled={photoUploading}
            className="text-xs flex items-center gap-1 disabled:opacity-50"
            style={{ color: PRIMARY }}
          >
            {photoUploading ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
            {photoUploading ? "กำลังอัปโหลด..." : "เพิ่มรูป"}
          </button>
        </div>
        {photos.length === 0 ? (
          <button
            onClick={addPhotos}
            disabled={photoUploading}
            className="w-full py-6 rounded-xl border-2 border-dashed flex flex-col items-center gap-1.5 disabled:opacity-50"
            style={{ borderColor: BORDER }}
          >
            <Camera size={20} style={{ color: MUTED }} />
            <p className="text-xs" style={{ color: MUTED }}>แตะเพื่อเพิ่มรูปภาพ</p>
          </button>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            {photos.map((url, i) => (
              <div key={i} className="relative aspect-square rounded-xl overflow-hidden group" style={{ border: `1px solid ${BORDER}` }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`photo-${i}`}
                  className="w-full h-full object-cover"
                  onClick={() => setLightboxUrl(url)}
                />
                <button
                  onClick={(e) => { e.stopPropagation(); removePhoto(url); }}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(0,0,0,0.55)" }}
                >
                  <X size={10} className="text-white" />
                </button>
              </div>
            ))}
            <button
              onClick={addPhotos}
              disabled={photoUploading}
              className="aspect-square rounded-xl flex items-center justify-center disabled:opacity-50"
              style={{ border: `2px dashed ${BORDER}` }}
            >
              <Plus size={18} style={{ color: MUTED }} />
            </button>
          </div>
        )}
      </section>

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.85)" }}
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.15)" }}
            onClick={() => setLightboxUrl(null)}
          >
            <X size={18} className="text-white" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxUrl}
            alt="preview"
            className="max-w-full max-h-full object-contain rounded-xl"
            style={{ maxWidth: "92vw", maxHeight: "85vh" }}
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}

      {/* Danger zone: delete customer */}
      <section className="px-4 pb-8 pt-4">
        <button
          onClick={deleteCustomer}
          disabled={busy}
          className="w-full py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
          style={{ background: "white", color: "#991B1B", border: `1px solid #FECACA` }}
        >
          <Trash2 size={14} /> ลบลูกค้านี้
        </button>
      </section>

    </main>
  );
}


interface AvatarProps {
  pictureUrl:      string | null;
  name:            string;
  customerId:      string;
  onPictureChange: (url: string | null) => void;
}

function ProfileAvatar({ pictureUrl, name, customerId, onPictureChange }: AvatarProps) {
  const [busy, setBusy] = useState(false);
  const [err,  setErr]  = useState("");

  const onPick = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setBusy(true); setErr("");
      try {
        const fd = new FormData();
        fd.append("file", file);
        const upRes = await fetch(`/api/upload?kind=profile&ref=${customerId}`, { method: "POST", body: fd });
        const up    = await upRes.json();
        if (!upRes.ok) { setErr(up.error ?? "อัปโหลดไม่สำเร็จ"); setBusy(false); return; }
        const patchRes = await fetch(`/api/admin/customers/${customerId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pictureUrl: up.url }),
        });
        if (!patchRes.ok) { setErr("บันทึกไม่สำเร็จ"); setBusy(false); return; }
        onPictureChange(up.url);
      } catch { setErr("เกิดข้อผิดพลาด"); }
      finally { setBusy(false); }
    };
    input.click();
  };

  return (
    <button
      type="button"
      onClick={onPick}
      disabled={busy}
      title={err || "แตะเพื่อเปลี่ยนรูป"}
      className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-semibold text-white flex-shrink-0 relative overflow-hidden disabled:opacity-50"
      style={{ background: PRIMARY }}
    >
      {pictureUrl
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={pictureUrl} alt={name} className="w-full h-full object-cover" />
        : name.charAt(0)
      }
      <span className="absolute bottom-0 right-0 w-5 h-5 rounded-full flex items-center justify-center bg-white" style={{ border: `1px solid ${BORDER}` }}>
        {busy ? <Loader2 size={10} className="animate-spin" style={{ color: PRIMARY }} /> : <Camera size={9} style={{ color: PRIMARY }} />}
      </span>
    </button>
  );
}

// ── Inline form components ────────────────────────────────────────────────────

function FormShell({ title, busy, onCancel, onSave, submitLabel, children }: {
  title:       string;
  busy:        boolean;
  onCancel:    () => void;
  onSave:      () => void;
  submitLabel: string;
  children:    React.ReactNode;
}) {
  return (
    <div className="rounded-xl p-3 space-y-2" style={{ border: `1px solid ${BORDER}`, background: "#FAFAFA" }}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold" style={{ color: TEXT }}>{title}</p>
        <button onClick={onCancel} className="p-1" style={{ color: MUTED }}><X size={12} /></button>
      </div>
      {children}
      <div className="flex gap-2 pt-1">
        <button
          onClick={onCancel}
          disabled={busy}
          className="flex-1 py-2 rounded-lg text-xs font-medium disabled:opacity-50"
          style={{ background: "white", color: TEXT, border: `1px solid ${BORDER}` }}
        >
          ยกเลิก
        </button>
        <button
          onClick={onSave}
          disabled={busy}
          className="flex-1 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
          style={{ background: PRIMARY }}
        >
          {busy ? "กำลังบันทึก..." : submitLabel}
        </button>
      </div>
    </div>
  );
}

function MembershipForm({ initialExpiresAt, initialUsagesAllowed, initialPending, busy, onCancel, onSave, submitLabel }: {
  initialExpiresAt:     string;
  initialUsagesAllowed: number;
  initialPending:       boolean;
  busy:                 boolean;
  onCancel:             () => void;
  onSave:               (data: { expiresAt: string; usagesAllowed: number; pendingActivation: boolean }) => void;
  submitLabel:          string;
}) {
  const [expiresAt, setExpiresAt]         = useState(initialExpiresAt);
  const [usagesAllowed, setUsagesAllowed] = useState(initialUsagesAllowed);
  const [pending, setPending]             = useState(initialPending);

  return (
    <FormShell title="สมาชิก" busy={busy} onCancel={onCancel} onSave={() => onSave({ expiresAt, usagesAllowed, pendingActivation: pending })} submitLabel={submitLabel}>
      <div>
        <label className="block text-[10px] uppercase tracking-widest mb-1" style={{ color: MUTED }}>วันหมดอายุ</label>
        <input
          type="date"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
          style={{ borderColor: BORDER, color: TEXT, background: "white" }}
        />
      </div>
      <div>
        <label className="block text-[10px] uppercase tracking-widest mb-1" style={{ color: MUTED }}>จำนวนครั้งที่ใช้ได้ (0 = ไม่จำกัด)</label>
        <input
          type="number" min={0}
          value={usagesAllowed}
          onChange={(e) => setUsagesAllowed(Math.max(0, Number(e.target.value)))}
          className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
          style={{ borderColor: BORDER, color: TEXT, background: "white" }}
        />
      </div>
      <label className="flex items-center gap-2 text-xs" style={{ color: TEXT }}>
        <input type="checkbox" checked={pending} onChange={(e) => setPending(e.target.checked)} />
        รอเปิดใช้งาน
      </label>
    </FormShell>
  );
}

function PackageEditForm({ initialExpiresAt, initialUsagesUsed, busy, onCancel, onSave }: {
  initialExpiresAt:  string;
  initialUsagesUsed: number;
  busy:              boolean;
  onCancel:          () => void;
  onSave:            (data: { expiresAt: string; usagesUsed: number }) => void;
}) {
  const [expiresAt, setExpiresAt]     = useState(initialExpiresAt);
  const [usagesUsed, setUsagesUsed]   = useState(initialUsagesUsed);

  return (
    <FormShell title="แก้ไขแพ็กเกจ" busy={busy} onCancel={onCancel} onSave={() => onSave({ expiresAt, usagesUsed })} submitLabel="บันทึก">
      <div>
        <label className="block text-[10px] uppercase tracking-widest mb-1" style={{ color: MUTED }}>วันหมดอายุ</label>
        <input
          type="date"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
          style={{ borderColor: BORDER, color: TEXT, background: "white" }}
        />
      </div>
      <div>
        <label className="block text-[10px] uppercase tracking-widest mb-1" style={{ color: MUTED }}>จำนวนครั้งที่ใช้แล้ว</label>
        <input
          type="number" min={0}
          value={usagesUsed}
          onChange={(e) => setUsagesUsed(Math.max(0, Number(e.target.value)))}
          className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
          style={{ borderColor: BORDER, color: TEXT, background: "white" }}
        />
      </div>
    </FormShell>
  );
}

function PackageCreateForm({ busy, onCancel, onSave }: {
  busy:     boolean;
  onCancel: () => void;
  onSave:   (data: { sku: string; expiresAt: string; pendingActivation: boolean }) => void;
}) {
  const [sku, setSku]                 = useState(PACKAGE_OPTIONS[0].sku);
  const [expiresAt, setExpiresAt]     = useState(todayPlusDays(29));
  const [pending, setPending]         = useState(false);

  return (
    <FormShell title="เพิ่มแพ็กเกจ" busy={busy} onCancel={onCancel} onSave={() => onSave({ sku, expiresAt, pendingActivation: pending })} submitLabel="สร้างแพ็กเกจ">
      <div>
        <label className="block text-[10px] uppercase tracking-widest mb-1" style={{ color: MUTED }}>ประเภท</label>
        <select
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
          style={{ borderColor: BORDER, color: TEXT, background: "white" }}
        >
          {PACKAGE_OPTIONS.map(o => (
            <option key={o.sku} value={o.sku}>{o.nameTh} — ฿{o.price.toLocaleString()}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-[10px] uppercase tracking-widest mb-1" style={{ color: MUTED }}>วันหมดอายุ</label>
        <input
          type="date"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
          style={{ borderColor: BORDER, color: TEXT, background: "white" }}
        />
      </div>
      <label className="flex items-center gap-2 text-xs" style={{ color: TEXT }}>
        <input type="checkbox" checked={pending} onChange={(e) => setPending(e.target.checked)} />
        รอเปิดใช้งาน (ลูกค้ายังไม่เริ่มใช้)
      </label>
    </FormShell>
  );
}
