"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MapPin, Phone, ArrowRight, LogOut } from "lucide-react";
import { useLiff } from "@/hooks/useLiff";
import { LangSwitcher } from "@/components/LangSwitcher";
import BrandLogo from "@/components/BrandLogo";

interface Branch {
  id:             string;
  name:           string;
  address:        string;
  phone?:         string | null;
  bookingEnabled: boolean;
}

const RETURN_KEY   = "liff_return_to";
const LIFF_ID      = process.env.NEXT_PUBLIC_LIFF_ID ?? "";
const LINE_APP_URL = `https://liff.line.me/${LIFF_ID}`;

const LINE_SVG = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
    <path d="M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
  </svg>
);

/**
 * On mobile we use the deep link `https://liff.line.me/{LIFF_ID}` which opens
 * the LINE app and auto-authenticates seamlessly. On desktop the deep link
 * has nowhere to open, so we call `liff.login()` to use LINE's web OAuth flow
 * (email/password or QR code login).
 */
function isMobileDevice() {
  if (typeof navigator === "undefined") return false;
  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export default function BookCallback({ branches }: { branches: Branch[] }) {
  const router = useRouter();
  const liff   = useLiff();
  const [skipLine,     setSkipLine]     = useState(false);
  const [showBranches, setShowBranches] = useState(false);

  // Mobile → deep link to LINE app (seamless auth, no code).
  // Desktop → liff.login() web OAuth (no LINE app available).
  const handleLineLogin = () => {
    if (isMobileDevice()) {
      window.location.href = LINE_APP_URL;
    } else {
      liff.login();
    }
  };

  // After LIFF init: redirect back to a saved path if present, otherwise show the page.
  useEffect(() => {
    if (!liff.ready) return;
    try {
      const returnTo = sessionStorage.getItem(RETURN_KEY);
      if (returnTo) {
        sessionStorage.removeItem(RETURN_KEY);
        router.replace(returnTo);
        return;
      }
    } catch { /* ignore */ }
    setShowBranches(true);
  }, [liff.ready, router]);

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (!liff.ready || !showBranches) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#FDF8F3" }}>
        <div className="text-center">
          <div className="w-10 h-10 border-4 rounded-full animate-spin mx-auto mb-4"
            style={{ borderColor: "#E8D8CC", borderTopColor: "#8B1D24" }} />
          <p className="text-sm" style={{ color: "#A08070" }}>กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  // Show the login choice ONLY when:
  // • NOT inside the LINE app (LIFF auto-authenticates inside LINE)
  // • NOT already logged in
  // • User hasn't tapped "Continue without LINE"
  const showLogin = !liff.isInClient && !liff.isLoggedIn && !skipLine;

  return (
    <main className="min-h-screen" style={{ backgroundColor: "#FDF8F3" }}>
      {/* ── Top nav ── */}
      <nav className="px-6 py-3 flex items-center justify-between" style={{ backgroundColor: "#8B1D24" }}>
        <BrandLogo light size="md" />
        <div className="flex items-center gap-5">
          <Link href="/my-bookings" className="text-white/80 hover:text-white text-sm transition-colors">
            การจองของฉัน
          </Link>
          <Link href="/membership" className="text-white/80 hover:text-white text-sm transition-colors">
            สมาชิก
          </Link>
          <Link href="/admin" className="text-white/40 hover:text-white/70 text-xs transition-colors">
            Admin
          </Link>
          <LangSwitcher />
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="px-6 py-16 text-center" style={{ backgroundColor: "#8B1D24" }}>
        <p className="text-sm tracking-widest uppercase mb-3" style={{ color: "#D6BCAE" }}>ยินดีต้อนรับสู่</p>
        <h1 className="mb-4"><BrandLogo light size="xl" /></h1>
        <p className="text-lg max-w-md mx-auto" style={{ color: "rgba(255,255,255,0.85)" }}>
          ประสบการณ์ความงามระดับพรีเมียม
        </p>
      </section>

      {/* Wave divider */}
      <div style={{ backgroundColor: "#8B1D24", lineHeight: 0 }}>
        <svg viewBox="0 0 1440 40" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none"
          style={{ display: "block", width: "100%", height: 40 }}>
          <path d="M0,40 C360,0 1080,0 1440,40 L1440,40 L0,40 Z" fill="#FDF8F3" />
        </svg>
      </div>

      <section className="max-w-lg mx-auto px-6 pt-8 pb-16">

        {/* ── Either show login choice OR proceed to branches ── */}
        {showLogin ? (
          <div className="text-center">
            <h2 className="text-xl font-medium mb-1" style={{ color: "#3B2A24" }}>เริ่มจองคิว</h2>
            <p className="text-sm mb-8" style={{ color: "#A08070" }}>
              เข้าสู่ระบบด้วย LINE เพื่อรับการแจ้งเตือนและจองได้เร็วขึ้น
            </p>

            <div className="space-y-3">
              <button
                onClick={handleLineLogin}
                className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-semibold text-white text-sm transition-opacity hover:opacity-90"
                style={{ background: "#06C755" }}
              >
                {LINE_SVG}
                เข้าสู่ระบบด้วย LINE
              </button>

              <button
                onClick={() => setSkipLine(true)}
                className="w-full py-4 rounded-2xl font-medium text-sm transition-colors hover:bg-stone-100"
                style={{ color: "#6B5245", border: "1.5px solid #D6BCAE", background: "transparent" }}
              >
                ดำเนินการต่อโดยไม่เข้าสู่ระบบ
              </button>
            </div>

            <p className="text-xs text-center mt-8 max-w-xs mx-auto" style={{ color: "#C4B0A4" }}>
              การเข้าสู่ระบบช่วยให้เราจดจำคุณ และคุณไม่ต้องกรอกข้อมูลซ้ำในครั้งหน้า
            </p>
          </div>
        ) : (
          <>
            {/* LINE status card (shown when logged in) */}
            {liff.isLoggedIn && liff.profile && (
              <div className="mb-6 rounded-2xl border p-4 flex items-center gap-3"
                style={{ borderColor: "#BBF7D0", background: "#F0FFF4" }}>
                {liff.profile.pictureUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={liff.profile.pictureUrl} alt="" className="w-10 h-10 rounded-full" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: "#3B2A24" }}>
                    {liff.profile.displayName}
                  </p>
                  <p className="text-xs" style={{ color: "#166534" }}>เชื่อมต่อ LINE แล้ว ✓</p>
                </div>
                {!liff.isInClient && (
                  <button
                    onClick={liff.logout}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full transition-colors hover:bg-white"
                    style={{ color: "#166534", border: "1px solid #BBF7D0" }}
                  >
                    <LogOut className="w-3 h-3" />
                    ออกจากระบบ
                  </button>
                )}
              </div>
            )}

            {/* Branch picker */}
            <h2 className="text-2xl font-medium mb-1" style={{ color: "#3B2A24" }}>เลือกสาขา</h2>
            <p className="text-sm mb-6" style={{ color: "#A08070" }}>
              Our Locations — เลือกสาขาเพื่อดูบริการและจองคิว
            </p>

            <div className="grid gap-4">
              {branches.map((branch) =>
                branch.bookingEnabled ? (
                  /* ── Open branch ── */
                  <div
                    key={branch.id}
                    className="rounded-2xl bg-white overflow-hidden transition-shadow hover:shadow-md"
                    style={{ border: "1.5px solid #E8D8CC" }}
                  >
                    <div className="px-6 pt-6 pb-4">
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        <h3 className="text-lg font-medium" style={{ color: "#3B2A24" }}>{branch.name}</h3>
                        <span className="text-xs px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: "#FFF0E8", color: "#8B1D24" }}>
                          เปิดให้บริการ
                        </span>
                      </div>
                      <p className="flex items-start gap-1.5 text-sm mb-1" style={{ color: "#6B5245" }}>
                        <MapPin className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                        {branch.address}
                      </p>
                      {branch.phone && (
                        <p className="flex items-center gap-1.5 text-sm" style={{ color: "#6B5245" }}>
                          <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                          {branch.phone}
                        </p>
                      )}
                    </div>
                    <div className="px-6 pb-6">
                      <Link
                        href={`/book/${branch.id}`}
                        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-white font-medium text-sm transition-opacity hover:opacity-90"
                        style={{ backgroundColor: "#8B1D24" }}
                      >
                        จองคิวที่สาขานี้ <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                ) : (
                  /* ── Coming-soon branch ── */
                  <div
                    key={branch.id}
                    className="rounded-2xl overflow-hidden"
                    style={{ border: "1.5px solid #E8D8CC", backgroundColor: "#FAFAFA", opacity: 0.8 }}
                  >
                    <div className="px-6 pt-6 pb-4">
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        <h3 className="text-lg font-medium" style={{ color: "#6B5245" }}>{branch.name}</h3>
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-medium"
                          style={{ backgroundColor: "#F3F4F6", color: "#6B7280" }}>
                          เร็วๆ นี้
                        </span>
                      </div>
                      <p className="flex items-start gap-1.5 text-sm mb-1" style={{ color: "#9CA3AF" }}>
                        <MapPin className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                        {branch.address}
                      </p>
                      {branch.phone && (
                        <p className="flex items-center gap-1.5 text-sm" style={{ color: "#9CA3AF" }}>
                          <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                          {branch.phone}
                        </p>
                      )}
                    </div>
                    <div className="px-6 pb-6">
                      <div
                        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-medium cursor-not-allowed"
                        style={{ backgroundColor: "#F3F4F6", color: "#9CA3AF" }}
                      >
                        กำลังเปิดให้บริการเร็วๆ นี้
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>

            {/* Re-show LINE login as a soft option for users who skipped */}
            {skipLine && !liff.isLoggedIn && (
              <button
                onClick={handleLineLogin}
                className="mt-6 w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium border-2 transition-colors"
                style={{ borderColor: "#06C755", color: "#06C755", background: "white" }}
              >
                เปลี่ยนใจอยากเข้าสู่ระบบด้วย LINE
              </button>
            )}
          </>
        )}
      </section>
    </main>
  );
}
