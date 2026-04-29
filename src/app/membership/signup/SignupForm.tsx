"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, User, Phone, Mail, Loader2, AlertCircle } from "lucide-react";
import PdpaConsentBlock from "@/components/PdpaConsentBlock";

const PRIMARY = "#8B1D24";
const TEXT    = "#3B2A24";
const MUTED   = "#A08070";
const BORDER  = "#E8D8CC";
const BG      = "#FDF7F2";

export default function SignupForm() {
  const router = useRouter();

  const [name,    setName]    = useState("");
  const [phone,   setPhone]   = useState("");
  const [email,   setEmail]   = useState("");
  const [gender,  setGender]  = useState("");
  const [pdpa,    setPdpa]    = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim())  { setError("กรุณาระบุชื่อ"); return; }
    if (!phone.trim()) { setError("กรุณาระบุเบอร์โทร"); return; }
    if (!pdpa)         { setError("กรุณายอมรับนโยบาย PDPA"); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/membership/signup", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          name:        name.trim(),
          phone:       phone.trim(),
          email:       email.trim() || undefined,
          gender:      gender || undefined,
          pdpaConsent: pdpa,
          source:      "signup",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "เกิดข้อผิดพลาด");
        setLoading(false);
        return;
      }

      if (data.status === "already_member") {
        // Send to lookup page with a banner
        router.push(`/membership/lookup?phone=${encodeURIComponent(phone.trim())}&already=1`);
        return;
      }

      // Pending payment → send to pending page
      router.push(`/membership/pending/${data.customerId}`);
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen" style={{ background: BG }}>
      <div className="max-w-md mx-auto px-5 py-8">
        <Link
          href="/membership"
          className="inline-flex items-center gap-1.5 text-sm mb-6"
          style={{ color: MUTED }}
        >
          <ArrowLeft size={14} />
          กลับ
        </Link>

        {/* LINE signup suggestion banner */}
        <div
          className="flex items-center gap-3 rounded-2xl p-3 mb-5 text-sm"
          style={{ background: "#F0FFF4", border: "1.5px solid #BBF7D0", color: "#166534" }}
        >
          <span className="text-2xl">💚</span>
          <div className="flex-1 text-xs">
            <p className="font-semibold mb-0.5">สมัครผ่าน LINE ได้เลย!</p>
            <p style={{ color: "#14532d" }}>ล็อกอิน LINE เพื่อเชื่อมบัญชีและรับสิทธิ์แจ้งเตือนอัตโนมัติ</p>
          </div>
          <a
            href="/liff/membership/signup"
            className="flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold text-white"
            style={{ background: "#22c55e" }}
          >
            LINE
          </a>
        </div>

        <header className="mb-6">
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: MUTED }}>Membership Signup</p>
          <h1 className="text-2xl font-medium" style={{ color: TEXT }}>สมัครสมาชิก</h1>
          <p className="text-sm mt-1" style={{ color: MUTED }}>
            กรอกข้อมูลด้านล่าง — ชำระเงิน ฿990 ที่ร้านเมื่อมาถึง
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs mb-1.5 font-medium" style={{ color: MUTED }}>
              ชื่อ-นามสกุล *
            </label>
            <div
              className="flex items-center gap-2 border rounded-xl px-3 py-2.5 bg-white"
              style={{ borderColor: BORDER }}
            >
              <User size={15} style={{ color: MUTED }} />
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="เช่น ชัชจรินทร์ ใจดี"
                className="flex-1 text-sm outline-none bg-transparent"
                style={{ color: TEXT }}
              />
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="block text-xs mb-1.5 font-medium" style={{ color: MUTED }}>
              เบอร์โทรศัพท์ *
            </label>
            <div
              className="flex items-center gap-2 border rounded-xl px-3 py-2.5 bg-white"
              style={{ borderColor: BORDER }}
            >
              <Phone size={15} style={{ color: MUTED }} />
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="08x-xxx-xxxx"
                className="flex-1 text-sm outline-none bg-transparent"
                style={{ color: TEXT }}
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs mb-1.5 font-medium" style={{ color: MUTED }}>
              อีเมล (ไม่บังคับ)
            </label>
            <div
              className="flex items-center gap-2 border rounded-xl px-3 py-2.5 bg-white"
              style={{ borderColor: BORDER }}
            >
              <Mail size={15} style={{ color: MUTED }} />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="flex-1 text-sm outline-none bg-transparent"
                style={{ color: TEXT }}
              />
            </div>
          </div>

          {/* Gender */}
          <div>
            <label className="block text-xs mb-1.5 font-medium" style={{ color: MUTED }}>
              เพศ (ไม่บังคับ)
            </label>
            <div className="flex gap-2">
              {[
                { v: "FEMALE", t: "หญิง" },
                { v: "MALE",   t: "ชาย" },
                { v: "OTHER",  t: "อื่น ๆ" },
              ].map(g => (
                <button
                  key={g.v}
                  type="button"
                  onClick={() => setGender(gender === g.v ? "" : g.v)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors"
                  style={{
                    background: gender === g.v ? PRIMARY  : "white",
                    color:      gender === g.v ? "white"  : MUTED,
                    border:     `1px solid ${gender === g.v ? PRIMARY : BORDER}`,
                  }}
                >
                  {g.t}
                </button>
              ))}
            </div>
          </div>

          {/* PDPA */}
          <PdpaConsentBlock checked={pdpa} onChange={setPdpa} context="signup" />

          {/* Error */}
          {error && (
            <div
              className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm"
              style={{ background: "#FEF2F2", color: "#991b1b" }}
            >
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity"
            style={{ background: PRIMARY }}
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? "กำลังลงทะเบียน..." : "ลงทะเบียน — ชำระที่ร้าน ฿990"}
          </button>

          <p className="text-xs text-center" style={{ color: MUTED }}>
            หลังลงทะเบียน นำหน้าจอแสดงเบอร์โทรไปที่หน้าร้านเพื่อชำระเงิน
          </p>
        </form>
      </div>
    </main>
  );
}
