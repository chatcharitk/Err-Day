"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Printer, Copy, Check, RefreshCw, KeyRound, Loader2 } from "lucide-react";
import ShopPrintButton from "@/components/ShopPrintButton";

interface BranchRow { id: string; name: string; configured: boolean; online: boolean; seenAt: string | null }
interface JobRow { id: string; branchName: string; kind: string; status: string; error: string | null; createdAt: string; requestedBy: string | null }

const PRIMARY = "#8B1D24", TEXT = "#3B2A24", MUTED = "#977A6F", BORDER = "#EADDD4";

const fmt = (iso: string) => new Date(iso).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const STATUS_TH: Record<string, string> = { PENDING: "รอพิมพ์", PRINTING: "กำลังพิมพ์", DONE: "พิมพ์แล้ว", FAILED: "ไม่สำเร็จ", EXPIRED: "หมดเวลา" };

export default function PrinterManager({ branches, jobs }: { branches: BranchRow[]; jobs: JobRow[] }) {
  const router = useRouter();
  return (
    <div className="p-6 md:p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-medium flex items-center gap-2" style={{ color: TEXT }}><Printer size={20} /> เครื่องพิมพ์ใบเสร็จ</h1>
        <button onClick={() => router.refresh()} className="text-xs flex items-center gap-1 px-3 py-1.5 rounded-full border" style={{ borderColor: BORDER, color: MUTED }}>
          <RefreshCw size={12} /> รีเฟรช
        </button>
      </div>
      <p className="text-sm mb-6" style={{ color: MUTED }}>
        Xprinter XP-C300H ต่อ WiFi สาขาละเครื่อง — กดพิมพ์จาก iPad หรือ iMac แล้วออกที่เครื่องของสาขานั้นทันที
        ต้องมีโปรแกรมเล็กๆ รันบน iMac ของสาขา (ติดตั้งครั้งเดียว) เป็นตัวส่งงานเข้าเครื่องพิมพ์
      </p>

      <div className="space-y-4">
        {branches.map(b => <BranchCard key={b.id} b={b} onChanged={() => router.refresh()} />)}
      </div>

      <h2 className="text-sm font-medium mt-8 mb-2" style={{ color: TEXT }}>งานพิมพ์ล่าสุด</h2>
      <div className="rounded-xl border bg-white divide-y" style={{ borderColor: BORDER }}>
        {jobs.length === 0 && <p className="p-4 text-sm" style={{ color: MUTED }}>ยังไม่มีงานพิมพ์</p>}
        {jobs.map(j => (
          <div key={j.id} className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
            <span style={{ color: TEXT }}>{j.kind === "TEST" ? "ใบทดสอบ" : "ใบเสร็จ"} · {j.branchName.replace("err.day ", "")}</span>
            <span className="text-xs text-right" style={{ color: j.status === "FAILED" || j.status === "EXPIRED" ? "#B42318" : MUTED }}>
              {STATUS_TH[j.status] ?? j.status}{j.error ? ` — ${j.error}` : ""} · {fmt(j.createdAt)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BranchCard({ b, onChanged }: { b: BranchRow; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState<string | null>(null);
  const [ip, setIp] = useState("");
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState("");

  const makeKey = async () => {
    if (b.configured && !confirm("สร้างรหัสใหม่? โปรแกรมที่ติดตั้งไว้เดิมจะใช้ไม่ได้จนกว่าจะติดตั้งใหม่ด้วยรหัสนี้")) return;
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/admin/printers/key", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ branchId: b.id }) });
      const d = await res.json();
      if (!res.ok) { setErr(d.error ?? "สร้างรหัสไม่สำเร็จ"); return; }
      setKey(d.key); onChanged();
    } finally { setBusy(false); }
  };
  const turnOff = async () => {
    if (!confirm(`ปิดการพิมพ์ของ ${b.name}?`)) return;
    setBusy(true);
    await fetch("/api/admin/printers/key", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ branchId: b.id }) });
    setKey(null); setBusy(false); onChanged();
  };

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const command = key ? `curl -fsSL ${origin}/print-agent/install.sh | bash -s -- ${key} ${ip.trim() || "IP_เครื่องพิมพ์"}` : "";
  const copy = async () => {
    try { await navigator.clipboard.writeText(command); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* select manually */ }
  };

  return (
    <div className="rounded-xl border bg-white p-4" style={{ borderColor: BORDER }}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium" style={{ color: TEXT }}>{b.name}</p>
          <p className="text-xs mt-0.5 flex items-center gap-1.5" style={{ color: MUTED }}>
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: !b.configured ? "#C9BCB2" : b.online ? "#16a34a" : "#dc2626" }} />
            {!b.configured ? "ยังไม่ได้ตั้งค่า" : b.online ? "โปรแกรมพิมพ์เชื่อมต่ออยู่" : b.seenAt ? `ไม่เชื่อมต่อ (เห็นล่าสุด ${fmt(b.seenAt)})` : "ตั้งค่าแล้ว — รอโปรแกรมบน iMac เชื่อมต่อครั้งแรก"}
          </p>
        </div>
        <div className="flex gap-2">
          {b.configured && <ShopPrintButton testBranchId={b.id} label="พิมพ์ทดสอบ" className="text-xs px-3 py-1.5 rounded-full border" style={{ borderColor: BORDER, color: TEXT, background: "white" }} />}
          <button onClick={makeKey} disabled={busy} className="text-xs px-3 py-1.5 rounded-full text-white flex items-center gap-1 disabled:opacity-50" style={{ background: PRIMARY }}>
            {busy ? <Loader2 size={12} className="animate-spin" /> : <KeyRound size={12} />}
            {b.configured ? "สร้างรหัสใหม่" : "ตั้งค่าเครื่องพิมพ์"}
          </button>
        </div>
      </div>
      {err && <p className="text-xs mt-2" style={{ color: "#B42318" }}>{err}</p>}

      {key && (
        <div className="mt-4 rounded-lg p-3 space-y-2" style={{ background: "#FFF8F4", border: `1px solid ${BORDER}` }}>
          <p className="text-sm font-medium" style={{ color: TEXT }}>ติดตั้งที่ iMac ของสาขานี้</p>
          <ol className="text-xs list-decimal pl-4 space-y-1" style={{ color: MUTED }}>
            <li>ใส่ IP ของเครื่องพิมพ์ในเครือข่ายร้าน (ดูจากหน้าตั้งค่าเราเตอร์ หรือใบพิมพ์ทดสอบของเครื่อง) — ควรตั้ง IP คงที่ที่เราเตอร์ไม่ให้เปลี่ยน</li>
            <li>คัดลอกคำสั่งด้านล่าง ไปวางใน Terminal บน iMac แล้วกด Enter (ต้องมี Node.js — ถ้าไม่มีสคริปต์จะบอกวิธีติดตั้ง)</li>
            <li>กลับมาหน้านี้ รีเฟรช แล้วกดปุ่ม &ldquo;พิมพ์ทดสอบ&rdquo;</li>
          </ol>
          <input value={ip} onChange={e => setIp(e.target.value)} placeholder="IP เครื่องพิมพ์ เช่น 192.168.1.50" className="w-full border rounded-lg px-3 py-2 text-sm outline-none bg-white" style={{ borderColor: BORDER }} inputMode="decimal" />
          <pre className="text-[11px] p-2.5 rounded-lg bg-white border overflow-x-auto whitespace-pre-wrap break-all" style={{ borderColor: BORDER, color: TEXT }}>{command}</pre>
          <div className="flex items-center justify-between">
            <p className="text-[11px]" style={{ color: "#B42318" }}>รหัสนี้แสดงครั้งเดียว — ปิดหน้านี้แล้วจะดูอีกไม่ได้ (สร้างใหม่ได้)</p>
            <button onClick={copy} className="text-xs px-3 py-1.5 rounded-full border flex items-center gap-1 bg-white" style={{ borderColor: BORDER, color: TEXT }}>
              {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? "คัดลอกแล้ว" : "คัดลอกคำสั่ง"}
            </button>
          </div>
        </div>
      )}

      {b.configured && !key && (
        <button onClick={turnOff} disabled={busy} className="mt-3 text-[11px] underline" style={{ color: MUTED }}>ปิดการพิมพ์ของสาขานี้</button>
      )}
    </div>
  );
}
