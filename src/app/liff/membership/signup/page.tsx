"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, AlertCircle, Phone, Mail } from "lucide-react";
import PdpaConsentBlock from "@/components/PdpaConsentBlock";

const PRIMARY = "#8B1D24";
const BORDER  = "#E8D8CC";
const TEXT    = "#3B2A24";
const MUTED   = "#A08070";
const BG      = "#FDF7F2";

type Step = "loading" | "form" | "submitting" | "success" | "error";

interface LineProfile {
  userId:      string;
  displayName: string;
  pictureUrl?: string;
}

export default function LiffMembershipSignupPage() {
  const router = useRouter();

  const [step,     setStep]     = useState<Step>("loading");
  const [errMsg,   setErrMsg]   = useState("");
  const [profile,  setProfile]  = useState<LineProfile | null>(null);

  // Form state
  const [name,   setName]   = useState("");
  const [phone,  setPhone]  = useState("");
  const [email,  setEmail]  = useState("");
  const [gender, setGender] = useState("");
  const [pdpa,   setPdpa]   = useState(false);
  const [formErr, setFormErr] = useState("");

  // Init LIFF and login
  useEffect(() => {
    (async () => {
      try {
        const { default: liff } = await import("@line/liff");
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID!;
        await liff.init({ liffId });

        if (!liff.isLoggedIn()) {
          liff.login({ redirectUri: window.location.href });
          return; // redirect will happen
        }

        const p = await liff.getProfile();
        setProfile({
          userId:      p.userId,
          displayName: p.displayName,
          pictureUrl:  p.pictureUrl ?? undefined,
        });
        setName(p.displayName); // pre-fill name from LINE
        setStep("form");
      } catch {
        setErrMsg("กรุณาเปิดหน้านี้ผ่าน LINE");
        setStep("error");
      }
    })();
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErr("");

    if (!name.trim())  { setFormErr("กรุณาระบุชื่อ");      return; }
    if (!phone.trim()) { setFormErr("กรุณาระบุเบอร์โทร");  return; }
    if (!pdpa)         { setFormErr("กรุณายอมรับนโยบาย PDPA"); return; }

    setStep("submitting");
    try {
      const res = await fetch("/api/membership/signup", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:        name.trim(),
          phone:       phone.trim(),
          email:       email.trim() || undefined,
          gender:      gender || undefined,
          pdpaConsent: pdpa,
          source:      "liff",
          lineUserId:  profile?.userId,
          pictureUrl:  profile?.pictureUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setFormErr(data.error ?? "เกิดข้อผิดพลาด"); setStep("form"); return; }

      if (data.status === "already_member") {
        // Already a member — show status page
        router.replace(`/liff/membership`);
        return;
      }
      // pending_payment
      router.replace(`/membership/pending/${data.customerId}`);
    } catch {
      setFormErr("เกิดข้อผิดพลาด กรุณาลองใหม่");
      setStep("form");
    }
  }, [name, phone, email, gender, pdpa, profile, router]);

  // ── Loading ──
  if (step === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: BG }}>
        <div className="text-center">
          <div
            className="w-12 h-12 rounded-full border-4 border-t-transparent animate-spin mx-auto mb-4"
            style={{ borderColor: "#E8D8CC", borderTopColor: PRIMARY }}
          />
          <p className="text-sm" style={{ color: MUTED }}>กำลังเชื่อมต่อ LINE...</p>
        </div>
      </div>
    );
  }

  // ── Error ──
  if (step === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: BG }}>
        <div className="text-center max-w-xs">
          <AlertCircle className="mx-auto mb-3" size={44} style={{ color: PRIMARY }} />
          <p className="font-semibold mb-1" style={{ color: TEXT }}>เกิดข้อผิดพลาด</p>
          <p className="text-sm" style={{ color: MUTED }}>{errMsg}</p>
        </div>
      </div>
    );
  }

  // ── Form ──
  return (
    <main className="min-h-screen" style={{ background: BG }}>
      <div className="max-w-md mx-auto px-5 py-8">
        {/* LINE profile banner */}
        {profile && (
          <div
            className="flex items-center gap-3 rounded-2xl p-3 mb-6"
            style={{ background: "#F0FFF4", border: "1.5px solid #BBF7D0" }}
          >
            {profile.pictureUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={profile.pictureUrl} alt="" className="w-10 h-10 rounded-full flex-shrink-0 object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-green-200 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 size={20} style={{ color: "#166534" }} />
              </div>
            )}
            <div>
              <p className="text-xs font-semibold" style={{ color: "#166534" }}>เชื่อมต่อ LINE แล้ว ✓</p>
              <p className="text-sm" style={{ color: TEXT }}>{profile.displayName}</p>
            </div>
          </div>
        )}

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
            <label className="block text-xs mb-1.5 font-medium" style={{ color: MUTED }}>ชื่อ-นามสกุล *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="เช่น ชัชจรินทร์ ใจดี"
              className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none bg-white"
              style={{ borderColor: BORDER, color: TEXT }}
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-xs mb-1.5 font-medium" style={{ color: MUTED }}>เบอร์โทรศัพท์ *</label>
            <div className="flex items-center gap-2 border rounded-xl px-3 py-2.5 bg-white" style={{ borderColor: BORDER }}>
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
            <label className="block text-xs mb-1.5 font-medium" style={{ color: MUTED }}>อีเมล (ไม่บังคับ)</label>
            <div className="flex items-center gap-2 border rounded-xl px-3 py-2.5 bg-white" style={{ borderColor: BORDER }}>
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
            <label className="block text-xs mb-1.5 font-medium" style={{ color: MUTED }}>เพศ (ไม่บังคับ)</label>
            <div className="flex gap-2">
              {[{ v: "FEMALE", t: "หญิง" }, { v: "MALE", t: "ชาย" }, { v: "OTHER", t: "อื่น ๆ" }].map(g => (
                <button
                  key={g.v}
                  type="button"
                  onClick={() => setGender(gender === g.v ? "" : g.v)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors"
                  style={{
                    background: gender === g.v ? PRIMARY : "white",
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
          <PdpaConsentBlock checked={pdpa} onChange={setPdpa} context="liff" />

          {/* Form error */}
          {formErr && (
            <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm" style={{ background: "#FEF2F2", color: "#991b1b" }}>
              <AlertCircle size={14} />
              {formErr}
            </div>
          )}

          <button
            type="submit"
            disabled={step === "submitting"}
            className="w-full py-3.5 rounded-xl text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ background: PRIMARY }}
          >
            {step === "submitting" && <Loader2 size={16} className="animate-spin" />}
            {step === "submitting" ? "กำลังลงทะเบียน..." : "ลงทะเบียน — ชำระที่ร้าน ฿990"}
          </button>

          <p className="text-xs text-center" style={{ color: MUTED }}>
            บัญชี LINE ของคุณจะถูกเชื่อมโยงกับข้อมูลสมาชิก
          </p>
        </form>
      </div>
    </main>
  );
}
