"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { Camera, CheckCircle2, LogIn, LogOut, XCircle } from "lucide-react";

const PRIMARY = "#8B1D24";
const TEXT    = "#3B2A24";
const MUTED   = "#A08070";
const BORDER  = "#E8D8CC";
const GREEN   = "#15803D";
const QR_PREFIX = "ERRDAY-CLOCK:";

interface Today { clockIn: string | null; clockOut: string | null }
type Result =
  | { ok: true; kind: "IN" | "OUT"; at: string; staffName: string; branchName: string; clockIn?: string; again?: boolean }
  | { ok: false; reason: string; message: string; clockIn?: string; clockOut?: string | null };

const hm = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" }) : "—";

/** Staff-app QR scanner for clocking in / out at the desk. */
export default function ClockScanner({ initial }: { initial: Today }) {
  const [today, setToday]     = useState<Today>(initial);
  const [scanning, setScanning] = useState(false);
  const [camError, setCamError] = useState("");
  const [busy, setBusy]       = useState(false);
  const [result, setResult]   = useState<Result | null>(null);
  const [pending, setPending] = useState<{ qr: string; res: Result } | null>(null);
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef    = useRef<number>(0);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setScanning(false);
  }, []);
  useEffect(() => stop, [stop]);

  const refreshToday = async () => {
    const r = await fetch("/api/staff/clock", { cache: "no-store" }).catch(() => null);
    if (r?.ok) setToday(await r.json());
  };

  const send = useCallback(async (qr: string, confirm: boolean) => {
    setBusy(true);
    try {
      const res = await fetch("/api/staff/clock", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ qr, confirm }),
      });
      if (res.status === 401) { window.location.href = "/staff/login"; return; }
      const j: Result = await res.json();
      if (!j.ok && j.reason === "confirm_out") { setPending({ qr, res: j }); return; }
      setPending(null);
      setResult(j);
      if (j.ok) { navigator.vibrate?.(120); refreshToday(); }
    } catch {
      setResult({ ok: false, reason: "network", message: "เชื่อมต่อไม่ได้ — ลองใหม่อีกครั้ง" });
    } finally { setBusy(false); }
  }, []);


  const start = async () => {
    setResult(null); setPending(null); setCamError("");
    if (!navigator.mediaDevices?.getUserMedia) { setCamError("เครื่องนี้เปิดกล้องจากแอปไม่ได้"); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      streamRef.current = stream;
      setScanning(true);
      requestAnimationFrame(async () => {
        const v = videoRef.current;
        if (!v) return;
        v.srcObject = stream;
        await v.play().catch(() => {});
        const c = canvasRef.current;
        const tick = () => {
          if (!streamRef.current || !c) return;
          if (v.readyState >= 2 && v.videoWidth) {
            const w = 480, h = Math.round((v.videoHeight / v.videoWidth) * w);
            c.width = w; c.height = h;
            const ctx = c.getContext("2d", { willReadFrequently: true });
            if (ctx) {
              ctx.drawImage(v, 0, 0, w, h);
              const code = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "dontInvert" });
              if (code?.data?.startsWith(QR_PREFIX)) { stop(); send(code.data, false); return; }
            }
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      });
    } catch {
      setCamError("เปิดกล้องไม่ได้ — กรุณาอนุญาตให้ใช้กล้องในการตั้งค่าของเครื่อง");
    }
  };

  const status = today.clockIn
    ? today.clockOut ? `เข้า ${hm(today.clockIn)} · ออก ${hm(today.clockOut)}` : `เข้างานแล้ว ${hm(today.clockIn)} · ยังไม่ลงเวลาออก`
    : "วันนี้ยังไม่ได้ลงเวลาเข้า";

  return (
    <div className="max-w-md mx-auto px-4 py-5 space-y-4">
      <section className="rounded-2xl bg-white p-4" style={{ border: `1px solid ${BORDER}` }}>
        <p className="text-xs" style={{ color: MUTED }}>วันนี้</p>
        <p className="text-base font-semibold mt-0.5" style={{ color: TEXT }}>{status}</p>
      </section>

      {scanning ? (
        <section className="rounded-2xl overflow-hidden bg-black relative">
          <video ref={videoRef} playsInline muted className="w-full aspect-square object-cover" />
          <div className="absolute inset-10 rounded-2xl pointer-events-none" style={{ border: "3px solid rgba(255,255,255,0.85)" }} />
          <button onClick={stop} className="absolute bottom-3 left-1/2 -translate-x-1/2 px-5 py-2 rounded-full text-sm font-semibold bg-white" style={{ color: TEXT }}>
            ยกเลิก
          </button>
        </section>
      ) : (
        <button onClick={start} disabled={busy}
          className="w-full flex items-center justify-center gap-2 py-5 rounded-2xl text-lg font-bold text-white active:scale-[0.98] disabled:opacity-60"
          style={{ background: PRIMARY }}>
          <Camera size={22} /> {busy ? "กำลังบันทึก…" : "สแกน QR ที่เคาน์เตอร์"}
        </button>
      )}
      <canvas ref={canvasRef} className="hidden" />

      {camError && <p className="text-sm text-center" style={{ color: "#B91C1C" }}>{camError}</p>}

      {pending && !pending.res.ok && (
        <section className="rounded-2xl bg-white p-5 text-center" style={{ border: `2px solid ${PRIMARY}` }}>
          <LogOut size={30} className="mx-auto" style={{ color: PRIMARY }} />
          <p className="text-lg font-bold mt-2" style={{ color: TEXT }}>{pending.res.message}</p>
          <p className="text-sm mt-1" style={{ color: MUTED }}>
            เข้างาน {hm(pending.res.clockIn)}{pending.res.clockOut ? ` · ออกเดิม ${hm(pending.res.clockOut)}` : ""}
          </p>
          <div className="grid grid-cols-2 gap-2 mt-4">
            <button onClick={() => setPending(null)} className="py-3 rounded-xl font-semibold" style={{ border: `1px solid ${BORDER}`, color: TEXT }}>ยกเลิก</button>
            <button onClick={() => send(pending.qr, true)} disabled={busy} className="py-3 rounded-xl font-bold text-white disabled:opacity-60" style={{ background: PRIMARY }}>
              {busy ? "กำลังบันทึก…" : "ยืนยัน ออกงาน"}
            </button>
          </div>
          <p className="text-[11px] mt-2" style={{ color: MUTED }}>ถ้า QR หมดอายุระหว่างนี้ ให้สแกนใหม่</p>
        </section>
      )}

      {result && (
        <section className="rounded-2xl bg-white p-5 text-center" style={{ border: `2px solid ${result.ok ? GREEN : "#FCA5A5"}` }}>
          {result.ok ? (
            <>
              {result.kind === "IN" ? <LogIn size={34} className="mx-auto" style={{ color: GREEN }} /> : <CheckCircle2 size={34} className="mx-auto" style={{ color: GREEN }} />}
              <p className="text-xl font-bold mt-2" style={{ color: TEXT }}>
                {result.kind === "IN" ? "เข้างาน" : result.again ? "แก้เวลาออกแล้ว" : "ออกงาน"} {hm(result.at)}
              </p>
              <p className="text-sm mt-1" style={{ color: MUTED }}>{result.staffName} · {result.branchName}</p>
            </>
          ) : (
            <>
              <XCircle size={34} className="mx-auto" style={{ color: "#B91C1C" }} />
              <p className="text-base font-semibold mt-2" style={{ color: TEXT }}>{result.message}</p>
            </>
          )}
        </section>
      )}

      <p className="text-xs text-center" style={{ color: MUTED }}>
        สแกนครั้งแรกของวัน = เข้างาน · สแกนอีกครั้งตอนกลับ = ออกงาน
      </p>
    </div>
  );
}
