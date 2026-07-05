"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, AlertCircle, Check } from "lucide-react";

const PRIMARY = "#8B1D24";
const TEXT    = "#3B2A24";
const MUTED   = "#A08070";
const BORDER  = "#E8D8CC";

export default function NewCustomerForm() {
  const router = useRouter();
  const [name,        setName]        = useState("");
  const [nickname,    setNickname]    = useState("");
  const [phone,       setPhone]       = useState("");
  const [email,       setEmail]       = useState("");
  const [gender,      setGender]      = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [pdpaConsent, setPdpa]        = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) { setError("กรุณาระบุชื่อ"); return; }
    if (!phone.trim()) { setError("กรุณาระบุเบอร์โทร"); return; }
    setSaving(true);
    try {
      // Use the membership/signup endpoint when PDPA is given (records consent),
      // else fall back to admin/customers (basic create).
      const url = pdpaConsent ? "/api/membership/signup" : "/api/admin/customers";
      const body = pdpaConsent
        ? { name, nickname: nickname || undefined, phone, email: email || undefined, gender: gender || undefined, dateOfBirth: dateOfBirth || undefined, pdpaConsent: true, source: "staff" }
        : { name, nickname: nickname || undefined, phone, email: email || undefined, gender: gender || undefined, dateOfBirth: dateOfBirth || undefined };

      const res  = await fetch(url, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "บันทึกไม่สำเร็จ");
        setSaving(false);
        return;
      }
      router.replace("/admin/m/customers");
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
          <h1 className="text-base font-medium" style={{ color: TEXT }}>เพิ่มลูกค้าใหม่</h1>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="px-4 py-4 space-y-4">
        <div>
          <label className="block text-xs mb-1.5 font-medium" style={{ color: MUTED }}>ชื่อ-นามสกุล *</label>
          <input
            type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder="เช่น สมชาย ใจดี"
            className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none"
            style={{ borderColor: BORDER, color: TEXT }}
          />
        </div>

        <div>
          <label className="block text-xs mb-1.5 font-medium" style={{ color: MUTED }}>ชื่อเล่น</label>
          <input
            type="text" value={nickname} onChange={e => setNickname(e.target.value)}
            placeholder="ใช้เรียกเวลาจอง"
            className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none"
            style={{ borderColor: BORDER, color: TEXT }}
          />
        </div>

        <div>
          <label className="block text-xs mb-1.5 font-medium" style={{ color: MUTED }}>เบอร์โทร *</label>
          <input
            type="tel" value={phone} onChange={e => setPhone(e.target.value)}
            placeholder="0812345678"
            className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none"
            style={{ borderColor: BORDER, color: TEXT }}
          />
        </div>

        <div>
          <label className="block text-xs mb-1.5 font-medium" style={{ color: MUTED }}>อีเมล</label>
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="ไม่บังคับ"
            className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none"
            style={{ borderColor: BORDER, color: TEXT }}
          />
        </div>

        <div>
          <label className="block text-xs mb-1.5 font-medium" style={{ color: MUTED }}>วันเกิด</label>
          <input
            type="date" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none bg-white"
            style={{ borderColor: BORDER, color: dateOfBirth ? TEXT : MUTED }}
          />
        </div>

        <div>
          <label className="block text-xs mb-1.5 font-medium" style={{ color: MUTED }}>เพศ</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { v: "FEMALE", t: "หญิง" },
              { v: "MALE",   t: "ชาย" },
              { v: "OTHER",  t: "อื่น ๆ" },
            ].map(g => (
              <button
                key={g.v}
                type="button"
                onClick={() => setGender(gender === g.v ? "" : g.v)}
                className="py-2.5 rounded-xl text-sm font-medium"
                style={{
                  background: gender === g.v ? PRIMARY : "white",
                  color:      gender === g.v ? "white" : TEXT,
                  border:     `1.5px solid ${gender === g.v ? PRIMARY : BORDER}`,
                }}
              >
                {g.t}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-start gap-3 px-3 py-3 rounded-xl border cursor-pointer" style={{ borderColor: BORDER }}>
          <input type="checkbox" checked={pdpaConsent} onChange={e => setPdpa(e.target.checked)} className="mt-0.5" />
          <span className="text-xs" style={{ color: TEXT }}>
            ลูกค้ายินยอมให้เก็บข้อมูลส่วนบุคคลตามนโยบาย PDPA
            <span className="block mt-0.5" style={{ color: MUTED }}>
              ติ๊กถ้าลูกค้าตกลงให้เก็บข้อมูลเพื่อรับโปรโมชั่นและการแจ้งเตือน
            </span>
          </span>
        </label>

        {error && (
          <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm" style={{ background: "#FEF2F2", color: "#991b1b" }}>
            <AlertCircle size={14} /> {error}
          </div>
        )}

        <button
          type="submit"
          disabled={saving || !name || !phone}
          className="w-full py-3 rounded-xl text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
          style={{ background: PRIMARY }}
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          {saving ? "กำลังบันทึก..." : "บันทึกลูกค้า"}
        </button>
      </form>
    </main>
  );
}
