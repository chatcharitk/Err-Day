"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MapPin, ArrowRight } from "lucide-react";
import { useLiff } from "@/hooks/useLiff";

interface Branch { id: string; name: string; address: string }

const RETURN_KEY = "liff_return_to";
const LIFF_ID    = process.env.NEXT_PUBLIC_LIFF_ID ?? "";

// Deep-link that opens this LIFF inside the LINE app (no verification code)
const LINE_APP_URL = `https://liff.line.me/${LIFF_ID}`;

const LINE_SVG = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
    <path d="M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
  </svg>
);

export default function BookCallback({ branches }: { branches: Branch[] }) {
  const router = useRouter();
  const liff   = useLiff();
  const [skipLine,     setSkipLine]     = useState(false);
  const [showBranches, setShowBranches] = useState(false);

  // After LIFF init: either redirect back to a saved path, or show the UI
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

  // ── Welcome / Login screen ───────────────────────────────────────────────────
  // Show ONLY when:
  //  • NOT inside the LINE app (isInClient = false) — if inside LINE, LIFF auto-authenticates
  //  • NOT already logged in
  //  • User hasn't chosen "Continue without LINE"
  const showWelcome = !liff.isInClient && !liff.isLoggedIn && !skipLine;

  if (showWelcome) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6"
        style={{ background: "#FDF8F3" }}>

        {/* Logo / brand */}
        <div className="text-center mb-10">
          <p className="text-xs uppercase tracking-widest mb-2" style={{ color: "#A08070" }}>err.day salon</p>
          <h1 className="text-3xl font-medium" style={{ color: "#3B2A24" }}>จองคิว</h1>
          <p className="text-sm mt-2" style={{ color: "#A08070" }}>
            เข้าสู่ระบบด้วย LINE เพื่อรับการแจ้งเตือนและจองได้เร็วขึ้น
          </p>
        </div>

        <div className="w-full max-w-sm space-y-3">
          {/* Open in LINE app — safest login (no verification code) */}
          <a
            href={LINE_APP_URL}
            className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-semibold text-white text-sm transition-opacity hover:opacity-90"
            style={{ background: "#06C755" }}
          >
            {LINE_SVG}
            เข้าสู่ระบบด้วย LINE
          </a>

          {/* Continue without LINE */}
          <button
            onClick={() => setSkipLine(true)}
            className="w-full py-4 rounded-2xl font-medium text-sm transition-colors hover:bg-stone-100"
            style={{ color: "#6B5245", border: "1.5px solid #D6BCAE", background: "transparent" }}
          >
            ดำเนินการต่อโดยไม่เข้าสู่ระบบ
          </button>
        </div>

        <p className="text-xs text-center mt-8 max-w-xs" style={{ color: "#C4B0A4" }}>
          การเข้าสู่ระบบช่วยให้เราจดจำคุณ และคุณไม่ต้องกรอกข้อมูลซ้ำในครั้งหน้า
        </p>
      </div>
    );
  }

  // ── Branch picker ────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen" style={{ background: "#FDF8F3" }}>
      <div className="max-w-lg mx-auto px-6 py-12">
        <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "#A08070" }}>Book an appointment</p>
        <h1 className="text-2xl font-medium mb-8" style={{ color: "#3B2A24" }}>เลือกสาขา</h1>

        {/* Profile bar (when logged in via LINE) */}
        {liff.isLoggedIn && liff.profile && (
          <div className="mb-6 rounded-2xl border p-4 flex items-center gap-3"
            style={{ borderColor: "#BBF7D0", background: "#F0FFF4" }}>
            {liff.profile.pictureUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={liff.profile.pictureUrl} alt="" className="w-10 h-10 rounded-full" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold" style={{ color: "#3B2A24" }}>{liff.profile.displayName}</p>
              <p className="text-xs" style={{ color: "#166534" }}>เชื่อมต่อ LINE แล้ว ✓</p>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {branches.map(b => (
            <Link
              key={b.id}
              href={`/book/${b.id}`}
              className="block rounded-2xl bg-white p-5 transition-all hover:shadow-md"
              style={{ border: "1.5px solid #E8D8CC" }}
            >
              <div className="flex items-center gap-4">
                <MapPin className="w-5 h-5 flex-shrink-0" style={{ color: "#8B1D24" }} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm" style={{ color: "#3B2A24" }}>{b.name}</p>
                  <p className="text-xs mt-0.5 truncate" style={{ color: "#A08070" }}>{b.address}</p>
                </div>
                <ArrowRight className="w-4 h-4 flex-shrink-0" style={{ color: "#D6BCAE" }} />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
