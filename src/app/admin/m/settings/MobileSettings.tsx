"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, MapPin, Phone, Clock } from "lucide-react";

const PRIMARY = "#8B1D24";
const TEXT    = "#3B2A24";
const MUTED   = "#A08070";
const BORDER  = "#E8D8CC";
const BG      = "#FDF8F3";

interface Branch {
  id:             string;
  name:           string;
  address:        string;
  phone:          string;
  openTime:       string | null;
  closeTime:      string | null;
  mapUrl:         string | null;
  bookingEnabled: boolean;
  onlineCap:      number | null;
}
interface Props { branches: Branch[] }

// 30-min slots 06:00 → 22:00 — same range as the desktop settings page.
const TIME_SLOTS = (() => {
  const out: string[] = [];
  for (let h = 6; h <= 22; h++)
    for (const m of [0, 30])
      out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  return out;
})();


export default function MobileSettings({ branches }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeBranch = branches.find(b => b.id === activeId) ?? null;

  return (
    <main className="min-h-screen pb-12" style={{ background: BG }}>
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <div className="px-4 py-3 flex items-center gap-3">
          <Link href={activeBranch ? "#" : "/admin/m"}
            onClick={(e) => {
              if (activeBranch) { e.preventDefault(); setActiveId(null); }
            }}
            className="w-9 h-9 flex items-center justify-center rounded-full" style={{ color: TEXT }}>
            <ArrowLeft size={20} />
          </Link>
          <div>
            <p className="text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>Settings</p>
            <h1 className="text-base font-semibold leading-tight" style={{ color: TEXT }}>
              {activeBranch ? activeBranch.name : "ตั้งค่าร้าน"}
            </h1>
          </div>
        </div>
      </header>

      {/* Body */}
      {!activeBranch ? (
        <section className="px-4 pt-4 space-y-2">
          <p className="text-xs px-1 mb-1" style={{ color: MUTED }}>เลือกสาขาเพื่อแก้ไข</p>
          {branches.map(b => (
            <button key={b.id} onClick={() => setActiveId(b.id)}
              className="w-full bg-white rounded-xl px-4 py-4 text-left active:scale-[0.99] transition-transform"
              style={{ border: `1px solid ${BORDER}` }}>
              <p className="text-base font-semibold" style={{ color: TEXT }}>{b.name}</p>
              <p className="text-xs mt-1 flex items-start gap-1.5" style={{ color: MUTED }}>
                <MapPin size={11} className="flex-shrink-0 mt-0.5" />
                <span className="truncate">{b.address}</span>
              </p>
              <p className="text-xs flex items-center gap-1.5 mt-0.5" style={{ color: MUTED }}>
                <Phone size={11} />
                {b.phone}
              </p>
              <p className="text-xs flex items-center gap-1.5 mt-0.5" style={{ color: MUTED }}>
                <Clock size={11} />
                {b.openTime ?? "08:00"} – {b.closeTime ?? "21:00"}
                <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                  style={{
                    background: b.bookingEnabled ? "#F0FDF4" : "#F4F4F5",
                    color:      b.bookingEnabled ? "#166534" : "#52525B",
                  }}>
                  {b.bookingEnabled ? "เปิดจอง" : "ปิดจอง"}
                </span>
              </p>
            </button>
          ))}
        </section>
      ) : (
        <BranchForm branch={activeBranch} onBack={() => setActiveId(null)} />
      )}
    </main>
  );
}


function BranchForm({ branch, onBack }: { branch: Branch; onBack: () => void }) {
  const router = useRouter();
  const [name,      setName]      = useState(branch.name);
  const [address,   setAddress]   = useState(branch.address);
  const [phone,     setPhone]     = useState(branch.phone);
  const [openTime,  setOpenTime]  = useState(branch.openTime ?? "");
  const [closeTime, setCloseTime] = useState(branch.closeTime ?? "");
  const [mapUrl,    setMapUrl]    = useState(branch.mapUrl ?? "");
  const [bookingEnabled, setBookingEnabled] = useState(branch.bookingEnabled);
  const [onlineCap, setOnlineCap] = useState<number | "">(branch.onlineCap ?? "");
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");
  const [saved,  setSaved]  = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSaved(false); setSaving(true);
    const res = await fetch(`/api/admin/branches/${branch.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name:           name.trim(),
        address:        address.trim(),
        phone:          phone.trim(),
        openTime:       openTime  || null,
        closeTime:      closeTime || null,
        mapUrl:         mapUrl.trim() || null,
        bookingEnabled,
        onlineCap:      onlineCap === "" ? null : Number(onlineCap),
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "บันทึกไม่สำเร็จ");
      return;
    }
    setSaved(true);
    router.refresh();
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <form onSubmit={save} className="px-4 pt-4 pb-12 space-y-4 max-w-lg mx-auto">
      <button type="button" onClick={onBack}
        className="text-xs font-medium" style={{ color: PRIMARY }}>
        ← กลับไปรายชื่อสาขา
      </button>

      <div className="bg-white rounded-2xl p-4 space-y-4" style={{ border: `1px solid ${BORDER}` }}>
        <Field label="ชื่อสาขา">
          <input value={name} onChange={e => setName(e.target.value)} required
            className="w-full border rounded-lg px-3 py-2.5 text-sm" style={{ borderColor: BORDER, color: TEXT }} />
        </Field>

        <Field label="ที่อยู่">
          <textarea value={address} onChange={e => setAddress(e.target.value)} rows={2}
            className="w-full border rounded-lg px-3 py-2 text-sm resize-none" style={{ borderColor: BORDER, color: TEXT }} />
        </Field>

        <Field label="เบอร์โทร">
          <input type="tel" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)}
            className="w-full border rounded-lg px-3 py-2.5 text-sm" style={{ borderColor: BORDER, color: TEXT }} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="เวลาเปิด">
            <select value={openTime} onChange={e => setOpenTime(e.target.value)}
              className="w-full border rounded-lg px-3 py-2.5 text-sm" style={{ borderColor: BORDER, color: TEXT }}>
              <option value="">ไม่ระบุ</option>
              {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="เวลาปิด">
            <select value={closeTime} onChange={e => setCloseTime(e.target.value)}
              className="w-full border rounded-lg px-3 py-2.5 text-sm" style={{ borderColor: BORDER, color: TEXT }}>
              <option value="">ไม่ระบุ</option>
              {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
        </div>

        <Field label="ลิงก์ Google Maps (ไม่บังคับ)">
          <input value={mapUrl} onChange={e => setMapUrl(e.target.value)}
            placeholder="https://maps.app.goo.gl/..."
            className="w-full border rounded-lg px-3 py-2.5 text-sm" style={{ borderColor: BORDER, color: TEXT }} />
        </Field>
      </div>

      {/* Booking toggle + cap */}
      <div className="bg-white rounded-2xl p-4 space-y-4" style={{ border: `1px solid ${BORDER}` }}>
        <label className="flex items-center justify-between gap-3 cursor-pointer">
          <div>
            <p className="text-sm font-semibold" style={{ color: TEXT }}>เปิดรับจองออนไลน์</p>
            <p className="text-xs mt-0.5" style={{ color: MUTED }}>ปิดเพื่อหยุดรับจองจากลูกค้าผ่านเว็บ</p>
          </div>
          <input type="checkbox" checked={bookingEnabled}
            onChange={e => setBookingEnabled(e.target.checked)}
            className="w-5 h-5 accent-[#8B1D24]" />
        </label>

        <Field label="โควต้าการจองออนไลน์ต่อช่วง (ไม่บังคับ)">
          <input type="number" inputMode="numeric" min="0" value={onlineCap}
            onChange={e => setOnlineCap(e.target.value === "" ? "" : Number(e.target.value))}
            placeholder="เว้นว่าง = ใช้จำนวนช่างเป็นเกณฑ์"
            className="w-full border rounded-lg px-3 py-2.5 text-sm" style={{ borderColor: BORDER, color: TEXT }} />
          <p className="text-[10px] mt-1" style={{ color: MUTED }}>
            จำกัดจำนวนคิวพร้อมกัน (ใช้สำหรับสาขาที่อยากเก็บที่นั่งสำหรับ walk-in)
          </p>
        </Field>
      </div>

      {error && <p className="text-sm text-red-600 px-3 py-2 rounded-lg bg-red-50">{error}</p>}
      {saved && <p className="text-sm text-green-700 px-3 py-2 rounded-lg bg-green-50">✓ บันทึกแล้ว</p>}

      <button type="submit" disabled={saving}
        className="w-full py-3 rounded-xl text-white text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
        style={{ background: PRIMARY }}>
        <Save size={16} />
        {saving ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-widest block mb-1" style={{ color: MUTED }}>
        {label}
      </label>
      {children}
    </div>
  );
}
