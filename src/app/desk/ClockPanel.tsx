"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { LogIn, LogOut, X } from "lucide-react";

const PRIMARY = "#8B1D24";
const TEXT    = "#3B2A24";
const MUTED   = "#A08070";
const BORDER  = "#E8D8CC";
const GREEN   = "#15803D";

interface Punch { id: string; kind: string; at: string; name: string; avatarUrl: string | null }
interface ClockState { text: string; refreshAt: number; serverNow: number; punches: Punch[] }

const hm = (iso: string) => new Date(iso).toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" });

/**
 * Full-screen "ลงเวลา" panel on the desk: a QR that changes every minute
 * (staff scan it from the staff app) + today's scans, newest first, so everyone
 * at the counter sees who just clocked in or out.
 */
export default function ClockPanel({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<ClockState | null>(null);
  const [img, setImg]     = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [left, setLeft]   = useState(0);
  const skew = useRef(0);          // server clock − device clock
  const lastTop = useRef<string | null>(null);
  const [flash, setFlash] = useState<Punch | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/kiosk/clock", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const j: ClockState = await res.json();
      skew.current = j.serverNow - Date.now();
      // Big "✓ name" banner for a few seconds when a new scan arrives.
      const top = j.punches[0];
      if (top && lastTop.current !== null && lastTop.current !== top.id) {
        setFlash(top);
        if (flashTimer.current) clearTimeout(flashTimer.current);
        flashTimer.current = setTimeout(() => setFlash(null), 6000);
      }
      lastTop.current = top?.id ?? "";
      setState(prev => (prev?.text === j.text && prev.punches[0]?.id === j.punches[0]?.id ? prev : j));
      setError(false);
    } catch { setError(true); }
  }, []);

  // Poll every 3 s (new scans show up fast) and right after the QR expires.
  useEffect(() => {
    const first = setTimeout(load, 0);
    const id = setInterval(load, 3000);
    return () => { clearTimeout(first); clearInterval(id); if (flashTimer.current) clearTimeout(flashTimer.current); };
  }, [load]);

  useEffect(() => {
    if (!state) return;
    QRCode.toDataURL(state.text, { margin: 1, width: 640, errorCorrectionLevel: "M", color: { dark: "#2A1A16", light: "#FFFFFF" } })
      .then(setImg).catch(() => setImg(null));
  }, [state?.text]); // eslint-disable-line react-hooks/exhaustive-deps

  // Countdown to the next QR.
  useEffect(() => {
    const tick = () => {
      if (!state) return;
      const ms = state.refreshAt - (Date.now() + skew.current);
      setLeft(Math.max(0, Math.ceil(ms / 1000)));
      if (ms <= 0) load();
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [state, load]);


  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: "#FDF8F3" }}>
      <div className="max-w-5xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold" style={{ color: TEXT }}>ลงเวลาเข้า–ออกงาน</h2>
          <button onClick={onClose} className="flex items-center gap-1.5 px-4 py-3 rounded-2xl text-base font-semibold active:scale-95"
            style={{ border: `1px solid ${BORDER}`, color: TEXT, background: "white" }}>
            <X size={18} /> ปิด
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1.1fr_1fr] gap-5">
          <section className="rounded-3xl bg-white p-5 text-center" style={{ border: `1px solid ${BORDER}` }}>
            <p className="text-base mb-3" style={{ color: MUTED }}>
              เปิดแอปพนักงาน → <b style={{ color: PRIMARY }}>ลงเวลา</b> → สแกน QR นี้
            </p>
            <div className="mx-auto aspect-square w-full max-w-[420px] rounded-2xl flex items-center justify-center" style={{ background: "#fff" }}>
              {img && !error
                ? <img src={img} alt="QR ลงเวลา" className="w-full h-full" style={{ imageRendering: "pixelated" }} />
                : <p style={{ color: MUTED }}>{error ? "เชื่อมต่อไม่ได้ — กำลังลองใหม่…" : "กำลังโหลด…"}</p>}
            </div>
            <p className="mt-3 text-sm tabular-nums" style={{ color: MUTED }}>QR เปลี่ยนใหม่ใน {left} วินาที</p>
          </section>

          <section className="rounded-3xl bg-white p-5" style={{ border: `1px solid ${BORDER}` }}>
            <h3 className="text-lg font-semibold mb-3" style={{ color: TEXT }}>ลงเวลาวันนี้</h3>
            {!state || state.punches.length === 0 ? (
              <p className="text-sm py-6 text-center" style={{ color: MUTED }}>ยังไม่มีใครลงเวลา</p>
            ) : (
              <ul className="space-y-2">
                {state.punches.map(p => <PunchRow key={p.id} p={p} />)}
              </ul>
            )}
          </section>
        </div>
      </div>

      {flash && (
        <div className="fixed inset-x-0 top-6 z-[60] flex justify-center px-4 pointer-events-none">
          <div className="flex items-center gap-4 px-6 py-4 rounded-3xl shadow-2xl text-white"
            style={{ background: flash.kind === "IN" ? GREEN : PRIMARY }}>
            <Avatar p={flash} size={56} />
            <div>
              <p className="text-2xl font-bold leading-tight">✓ {flash.name}</p>
              <p className="text-lg">{flash.kind === "IN" ? "เข้างาน" : "ออกงาน"} {hm(flash.at)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Avatar({ p, size }: { p: Punch; size: number }) {
  return p.avatarUrl
    ? <img src={p.avatarUrl} alt="" className="rounded-full object-cover flex-shrink-0" style={{ width: size, height: size }} />
    : <div className="rounded-full flex items-center justify-center font-bold flex-shrink-0"
        style={{ width: size, height: size, background: "#F3E7DD", color: PRIMARY, fontSize: size * 0.42 }}>{p.name.charAt(0)}</div>;
}

function PunchRow({ p }: { p: Punch }) {
  const isIn = p.kind === "IN";
  return (
    <li className="flex items-center gap-3 rounded-2xl px-3 py-2" style={{ border: `1px solid ${BORDER}` }}>
      <Avatar p={p} size={40} />
      <span className="flex-1 font-medium" style={{ color: TEXT }}>{p.name}</span>
      <span className="inline-flex items-center gap-1 text-sm font-semibold px-2.5 py-1 rounded-full"
        style={{ background: isIn ? "#DCFCE7" : "#FEE2E2", color: isIn ? GREEN : PRIMARY }}>
        {isIn ? <LogIn size={14} /> : <LogOut size={14} />} {isIn ? "เข้า" : "ออก"} {hm(p.at)}
      </span>
    </li>
  );
}
