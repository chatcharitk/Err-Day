"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, User, AlertCircle, Loader2, Monitor, Smartphone } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";

const PRIMARY = "#8B1D24";
const TEXT    = "#3B2A24";
const MUTED   = "#A08070";
const BORDER  = "#E8D8CC";

const LS_LAST_MODE = "admin_login_mode";  // "desktop" | "mobile"

export default function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const nextParam    = searchParams.get("next");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [mode,     setMode]     = useState<"desktop" | "mobile">("desktop");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  // Auto-pick mode based on viewport width and last-used preference on first load
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_LAST_MODE) as "desktop" | "mobile" | null;
      if (saved === "desktop" || saved === "mobile") {
        setMode(saved);
        return;
      }
    } catch { /* ignore */ }
    // No saved preference — default to mobile if the screen is narrow
    if (typeof window !== "undefined" && window.innerWidth < 640) {
      setMode("mobile");
    }
  }, []);

  // If `next` was set explicitly (e.g. proxy redirect), respect it. Otherwise
  // we route based on the user's mode pick.
  const computeRedirect = () => {
    if (nextParam) return nextParam;
    return mode === "mobile" ? "/admin/m" : "/admin";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/auth/login", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "เข้าสู่ระบบไม่สำเร็จ");
        return;
      }
      try { localStorage.setItem(LS_LAST_MODE, mode); } catch { /* ignore */ }
      router.replace(computeRedirect());
      router.refresh();
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-5" style={{ background: "#FDF7F2" }}>
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3"><BrandLogo size="xl" /></div>
          <p className="text-xs uppercase tracking-widest" style={{ color: MUTED }}>
            Admin Panel
          </p>
        </div>

        {/* Card */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl bg-white p-6 space-y-4"
          style={{ border: `1.5px solid ${BORDER}` }}
        >
          <h1 className="text-lg font-medium text-center" style={{ color: TEXT }}>
            เข้าสู่ระบบ
          </h1>

          {/* Username */}
          <div>
            <label className="block text-xs mb-1.5 font-medium" style={{ color: MUTED }}>
              ชื่อผู้ใช้
            </label>
            <div className="flex items-center gap-2 border rounded-xl px-3 py-2.5" style={{ borderColor: BORDER }}>
              <User size={15} style={{ color: MUTED }} />
              <input
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className="flex-1 text-sm outline-none bg-transparent"
                style={{ color: TEXT }}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs mb-1.5 font-medium" style={{ color: MUTED }}>
              รหัสผ่าน
            </label>
            <div className="flex items-center gap-2 border rounded-xl px-3 py-2.5" style={{ borderColor: BORDER }}>
              <Lock size={15} style={{ color: MUTED }} />
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="flex-1 text-sm outline-none bg-transparent"
                style={{ color: TEXT }}
              />
            </div>
          </div>

          {/* Mode toggle */}
          {!nextParam && (
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: MUTED }}>
                เข้าสู่โหมด
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMode("desktop")}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all"
                  style={{
                    background: mode === "desktop" ? PRIMARY : "white",
                    color:      mode === "desktop" ? "white" : TEXT,
                    border:     `1.5px solid ${mode === "desktop" ? PRIMARY : BORDER}`,
                  }}
                >
                  <Monitor size={14} /> เดสก์ท็อป
                </button>
                <button
                  type="button"
                  onClick={() => setMode("mobile")}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all"
                  style={{
                    background: mode === "mobile" ? PRIMARY : "white",
                    color:      mode === "mobile" ? "white" : TEXT,
                    border:     `1.5px solid ${mode === "mobile" ? PRIMARY : BORDER}`,
                  }}
                >
                  <Smartphone size={14} /> มือถือ
                </button>
              </div>
              <p className="text-[10px] mt-1.5" style={{ color: MUTED }}>
                {mode === "mobile"
                  ? "เข้าหน้าจัดการการจองแบบกะทัดรัด เหมาะกับมือถือ"
                  : "เข้าระบบจัดการเต็มรูปแบบ"}
              </p>
            </div>
          )}

          {error && (
            <div
              className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm"
              style={{ background: "#FEF2F2", color: "#991b1b" }}
            >
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !username || !password}
            className="w-full py-3 rounded-xl text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity hover:opacity-90"
            style={{ background: PRIMARY }}
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </button>
        </form>

        <p className="text-xs text-center mt-4" style={{ color: MUTED }}>
          ระบบจัดการสำหรับพนักงาน err·day เท่านั้น
        </p>
      </div>
    </main>
  );
}
