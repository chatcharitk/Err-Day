"use client";

import { useState, useEffect } from "react";
import { useLiff } from "@/hooks/useLiff";
import BrandLogo from "@/components/BrandLogo";
import { Phone, CheckCircle, Loader2, LogIn, XCircle } from "lucide-react";

const PRIMARY = "#8B1D24";
const MUTED   = "#A08070";
const BORDER  = "#E8D8CC";
const TEXT    = "#3B2A24";

export default function LinkPage() {
  const { ready, isLoggedIn, profile, login } = useLiff();

  const [phone,     setPhone]     = useState("");
  const [status,    setStatus]    = useState<"idle" | "loading" | "success" | "already" | "error">("idle");
  const [message,   setMessage]   = useState("");
  const [linkedName, setLinkedName] = useState("");

  // `ct` = signed per-customer token from a staff-generated one-tap link.
  // Read client-side only (window is undefined during SSR of this client page).
  const [ct,        setCt]        = useState<string | null>(null);
  const [ctChecked, setCtChecked] = useState(false);
  const [autoTried, setAutoTried] = useState(false);
  useEffect(() => {
    setCt(new URLSearchParams(window.location.search).get("ct"));
    setCtChecked(true);
  }, []);

  // Phone flow only: if this LINE is already linked, detect it after login.
  // (The token flow learns this from the link API instead.)
  useEffect(() => {
    if (!ctChecked || ct) return;
    if (!ready || !isLoggedIn || !profile) return;
    fetch(`/api/customer/me?lineUserId=${encodeURIComponent(profile.userId)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.id) {
          setLinkedName(data.nickname || data.name);
          setStatus("already");
        }
      })
      .catch(() => {});
  }, [ready, isLoggedIn, profile, ctChecked, ct]);

  // Token flow: one-tap auto-link once the customer is logged in with LINE.
  useEffect(() => {
    if (!ctChecked || !ct || autoTried) return;
    if (!ready || !isLoggedIn || !profile) return;
    setAutoTried(true);
    setStatus("loading");
    fetch("/api/liff/link", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lineUserId:  profile.userId,
        token:       ct,
        displayName: profile.displayName,
        pictureUrl:  profile.pictureUrl,
      }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) { setStatus("error"); setMessage(data.error ?? "เกิดข้อผิดพลาด กรุณาลองใหม่"); return; }
        setLinkedName(data.name);
        setStatus(data.already ? "already" : "success");
      })
      .catch(() => { setStatus("error"); setMessage("เกิดข้อผิดพลาด กรุณาลองใหม่"); });
  }, [ctChecked, ct, autoTried, ready, isLoggedIn, profile]);

  async function handleLink() {
    if (!profile || !phone.trim()) return;
    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch("/api/liff/link", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineUserId:  profile.userId,
          phone:       phone.trim(),
          displayName: profile.displayName,
          pictureUrl:  profile.pictureUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        setMessage(data.error ?? "เกิดข้อผิดพลาด กรุณาลองใหม่");
        return;
      }
      setLinkedName(data.name);
      setStatus(data.already ? "already" : "success");
    } catch {
      setStatus("error");
      setMessage("เกิดข้อผิดพลาด กรุณาลองใหม่");
    }
  }

  // ── Loading skeleton ──
  if (!ready || !ctChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#FDF7F2" }}>
        <Loader2 size={28} className="animate-spin" style={{ color: PRIMARY }} />
      </div>
    );
  }

  // ── Not logged in ──
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 gap-6" style={{ background: "#FDF7F2" }}>
        <BrandLogo />
        <div className="text-center">
          <p className="text-base font-medium mb-1" style={{ color: TEXT }}>เชื่อมต่อบัญชี LINE</p>
          <p className="text-sm" style={{ color: MUTED }}>ลงชื่อเข้าใช้ด้วย LINE เพื่อเชื่อมต่อกับข้อมูลสมาชิก</p>
        </div>
        <button
          onClick={login}
          className="flex items-center gap-2 px-6 py-3 rounded-2xl text-white font-semibold"
          style={{ background: "#06C755" }}
        >
          <LogIn size={18} />
          ลงชื่อเข้าใช้ด้วย LINE
        </button>
      </div>
    );
  }

  // ── Already linked ──
  if (status === "already") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 gap-5" style={{ background: "#FDF7F2" }}>
        <BrandLogo />
        <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "#F0FDF4" }}>
          <CheckCircle size={32} color="#16a34a" />
        </div>
        <div className="text-center">
          <p className="text-base font-semibold mb-1" style={{ color: TEXT }}>
            เชื่อมต่อแล้ว {linkedName && `· ${linkedName}`}
          </p>
          <p className="text-sm" style={{ color: MUTED }}>
            บัญชี LINE ของคุณเชื่อมต่อกับระบบเรียบร้อยแล้ว
          </p>
        </div>
      </div>
    );
  }

  // ── Success ──
  if (status === "success") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 gap-5" style={{ background: "#FDF7F2" }}>
        <BrandLogo />
        <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "#F0FDF4" }}>
          <CheckCircle size={32} color="#16a34a" />
        </div>
        <div className="text-center">
          <p className="text-base font-semibold mb-1" style={{ color: TEXT }}>
            เชื่อมต่อสำเร็จ 🎉
          </p>
          <p className="text-sm" style={{ color: MUTED }}>
            สวัสดี {linkedName}! บัญชีของคุณเชื่อมต่อกับ LINE เรียบร้อยแล้ว
          </p>
          <p className="text-xs mt-2" style={{ color: MUTED }}>
            ขณะนี้คุณสามารถรับการแจ้งเตือนการจองและตรวจสอบสถานะสมาชิกผ่าน LINE ได้
          </p>
        </div>
      </div>
    );
  }

  // ── Token (one-tap) flow: auto-linking spinner, or error ──
  if (ct) {
    if (status === "error") {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center px-6 gap-4" style={{ background: "#FDF7F2" }}>
          <BrandLogo />
          <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "#FEF2F2" }}>
            <XCircle size={32} color="#DC2626" />
          </div>
          <p className="text-sm text-center max-w-xs" style={{ color: TEXT }}>{message}</p>
        </div>
      );
    }
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 gap-4" style={{ background: "#FDF7F2" }}>
        <BrandLogo />
        <Loader2 size={28} className="animate-spin" style={{ color: PRIMARY }} />
        <p className="text-sm" style={{ color: MUTED }}>กำลังเชื่อมต่อบัญชีของคุณ...</p>
      </div>
    );
  }

  // ── Main form ──
  return (
    <div className="min-h-screen flex flex-col px-6 pt-12 pb-8" style={{ background: "#FDF7F2" }}>
      <div className="mb-8 flex justify-center">
        <BrandLogo />
      </div>

      {/* Profile pill */}
      {profile && (
        <div className="flex items-center gap-3 rounded-2xl p-4 mb-8 bg-white" style={{ border: `1px solid ${BORDER}` }}>
          {profile.pictureUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.pictureUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
          )}
          <div>
            <p className="text-sm font-semibold" style={{ color: TEXT }}>{profile.displayName}</p>
            <p className="text-xs" style={{ color: MUTED }}>บัญชี LINE</p>
          </div>
        </div>
      )}

      <div className="mb-6">
        <p className="text-lg font-semibold mb-1" style={{ color: TEXT }}>เชื่อมต่อบัญชีสมาชิก</p>
        <p className="text-sm" style={{ color: MUTED }}>
          กรอกเบอร์โทรศัพท์ที่ลงทะเบียนไว้กับร้าน เพื่อเชื่อมต่อกับบัญชี LINE ของคุณ
        </p>
      </div>

      {/* Phone input */}
      <div className="flex items-center gap-2 rounded-2xl px-4 py-3 bg-white mb-3" style={{ border: `1.5px solid ${BORDER}` }}>
        <Phone size={16} style={{ color: MUTED }} />
        <input
          type="tel"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") handleLink(); }}
          placeholder="0XX-XXX-XXXX"
          className="flex-1 text-base outline-none bg-transparent"
          style={{ color: TEXT }}
          autoFocus
        />
      </div>

      {status === "error" && (
        <p className="text-sm mb-3 px-1" style={{ color: "#DC2626" }}>{message}</p>
      )}

      <button
        onClick={handleLink}
        disabled={status === "loading" || !phone.trim()}
        className="w-full py-3.5 rounded-2xl text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
        style={{ background: PRIMARY }}
      >
        {status === "loading" ? (
          <><Loader2 size={16} className="animate-spin" /> กำลังเชื่อมต่อ...</>
        ) : (
          "เชื่อมต่อบัญชี"
        )}
      </button>

      <p className="text-xs text-center mt-4" style={{ color: MUTED }}>
        เบอร์โทรที่ใช้ต้องตรงกับที่แจ้งไว้กับทางร้าน
      </p>
    </div>
  );
}
