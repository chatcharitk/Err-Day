"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import BrandLogo from "@/components/BrandLogo";

const PRIMARY = "#8B1D24";
const BORDER  = "#E8D8CC";
const TEXT    = "#3B2A24";
const MUTED   = "#A08070";

export default function LoginForm() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [pin, setPin]     = useState(["", "", "", ""]);
  const [error, setError] = useState("");
  const [busy,  setBusy]  = useState(false);
  const pinRefs = useRef<(HTMLInputElement | null)[]>([]);

  function setPinDigit(i: number, val: string) {
    const digit = val.replace(/\D/g, "").slice(-1);
    const next = [...pin];
    next[i] = digit;
    setPin(next);
    if (digit && i < 3) pinRefs.current[i + 1]?.focus();
  }
  function handlePinKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !pin[i] && i > 0) pinRefs.current[i - 1]?.focus();
  }
  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
    if (text.length === 0) return;
    e.preventDefault();
    const next = [...pin];
    for (let i = 0; i < 4; i++) next[i] = text[i] ?? "";
    setPin(next);
    pinRefs.current[Math.min(text.length, 3)]?.focus();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const fullPin = pin.join("");
    if (!phone.trim()) { setError("กรุณากรอกเบอร์โทร"); return; }
    if (fullPin.length !== 4) { setError("PIN ต้องเป็นตัวเลข 4 หลัก"); return; }

    setBusy(true);
    const res = await fetch("/api/staff/login", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ phone: phone.trim(), pin: fullPin }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "เข้าสู่ระบบไม่สำเร็จ");
      setPin(["", "", "", ""]);
      pinRefs.current[0]?.focus();
      return;
    }
    router.push("/staff");
    router.refresh();
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-start px-6 pt-12 pb-8" style={{ background: "#FDF8F3" }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <BrandLogo size="lg" />
          <p className="mt-3 text-sm tracking-wide" style={{ color: MUTED }}>พอร์ทัลพนักงาน · Staff Portal</p>
        </div>

        {/* Card */}
        <form onSubmit={submit}
          className="bg-white rounded-2xl shadow-sm p-6 space-y-5"
          style={{ border: `1px solid ${BORDER}` }}>

          <div>
            <h1 className="text-lg font-bold" style={{ color: TEXT }}>เข้าสู่ระบบ</h1>
            <p className="text-xs mt-0.5" style={{ color: MUTED }}>ใช้เบอร์โทรและ PIN ที่ได้รับจากผู้จัดการ</p>
          </div>

          {/* Phone */}
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: TEXT }}>เบอร์โทรศัพท์</label>
            <input
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="0812345678"
              className="w-full px-4 py-3 rounded-xl outline-none text-base"
              style={{ border: `1.5px solid ${BORDER}`, color: TEXT }}
            />
          </div>

          {/* PIN */}
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: TEXT }}>PIN 4 หลัก</label>
            <div className="flex gap-2.5 justify-center">
              {pin.map((d, i) => (
                <input
                  key={i}
                  ref={el => { pinRefs.current[i] = el; }}
                  type="tel"
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  onChange={e => setPinDigit(i, e.target.value)}
                  onKeyDown={e => handlePinKey(i, e)}
                  onPaste={i === 0 ? handlePaste : undefined}
                  className="w-14 h-14 text-center text-2xl font-bold rounded-xl outline-none"
                  style={{ border: `1.5px solid ${d ? PRIMARY : BORDER}`, color: TEXT }}
                />
              ))}
            </div>
          </div>

          {error && (
            <div className="text-sm text-center px-3 py-2 rounded-lg"
              style={{ background: "#FEF2F2", color: "#B91C1C", border: "1px solid #FECACA" }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full py-3 rounded-xl font-bold text-sm text-white disabled:opacity-50 transition-opacity"
            style={{ background: PRIMARY }}>
            {busy ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </button>

          <p className="text-xs text-center" style={{ color: MUTED }}>
            ลืม PIN? ติดต่อผู้จัดการสาขาเพื่อขอตั้งใหม่
          </p>
        </form>
      </div>
    </main>
  );
}
