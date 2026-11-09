"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, Loader2, UserPlus, ChevronRight, X } from "lucide-react";
import { customerLabel } from "@/lib/customer-name";

const PRIMARY = "#8B1D24";
const TEXT    = "#3B2A24";
const MUTED   = "#A08070";
const BORDER  = "#E8D8CC";

interface Hit {
  id: string; name: string; nickname: string | null; phone: string; member: boolean;
  today: { id: string; startTime: string; state: "waiting" | "inservice" | "done" } | null;
}

const STATE_LABEL = { waiting: "รอเช็คอิน", inservice: "กำลังทำ", done: "เสร็จแล้ว" } as const;

/** Search a customer, then open today's booking or start a walk-in checked in to me. */
export default function WalkinFinder({ branches, defaultBranchId }: {
  branches: { id: string; name: string }[];
  defaultBranchId: string;
}) {
  const router = useRouter();
  const [branchId, setBranchId] = useState(defaultBranchId);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState<string | null>(null);   // customer id or "anon"
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);
  const tooShort = q.trim().replace(/\s/g, "").length < 2;

  useEffect(() => {
    const term = q.trim();
    const n = ++seq.current;
    if (term.replace(/\s/g, "").length < 2) return;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/staff/walkin?branchId=${encodeURIComponent(branchId)}&q=${encodeURIComponent(term)}`);
        const data = await res.json().catch(() => ({}));
        if (n !== seq.current) return;
        if (!res.ok) { setError(data.error ?? "ค้นหาไม่สำเร็จ"); setHits([]); }
        else { setError(null); setHits(data.results ?? []); }
      } catch {
        if (n === seq.current) setError("เชื่อมต่อไม่ได้");
      } finally {
        if (n === seq.current) setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q, branchId]);

  async function startWalkin(customerId: string | null, label: string) {
    const branchName = branches.find(b => b.id === branchId)?.name ?? "";
    if (!confirm(`รับวอร์คอิน (สระไดร์) · ${label}\nสาขา ${branchName} · เริ่มตอนนี้ · ช่าง = คุณ`)) return;
    setCreating(customerId ?? "anon"); setError(null);
    try {
      const res = await fetch("/api/staff/walkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId, customerId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? "สร้างรายการไม่สำเร็จ"); return; }
      router.push(`/staff/bookings/${data.id}`);
    } catch {
      setError("เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง");
    } finally {
      setCreating(null);
    }
  }

  return (
    <div className="px-4 py-4 space-y-4">
      {branches.length > 1 && (
        <div className="flex gap-1.5">
          {branches.map(b => (
            <button key={b.id} type="button" onClick={() => setBranchId(b.id)}
              className="px-3.5 py-1.5 rounded-full text-xs font-semibold"
              style={{
                background: b.id === branchId ? PRIMARY : "white",
                color:      b.id === branchId ? "white" : TEXT,
                border:     `1px solid ${b.id === branchId ? PRIMARY : BORDER}`,
              }}>
              {b.name}
            </button>
          ))}
        </div>
      )}

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: MUTED }} />
        <input autoFocus value={q} onChange={e => setQ(e.target.value)} inputMode="search"
          placeholder="ชื่อเล่น ชื่อจริง หรือเบอร์โทร"
          className="w-full h-12 rounded-xl pl-9 pr-9 text-base bg-white outline-none"
          style={{ border: `1.5px solid ${BORDER}`, color: TEXT }} />
        {q && (
          <button type="button" aria-label="ล้าง" onClick={() => setQ("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5" style={{ color: MUTED }}>
            <X size={16} />
          </button>
        )}
      </div>

      {error && <p className="text-xs font-semibold" style={{ color: "#B91C1C" }}>{error}</p>}

      {searching && !tooShort && <p className="text-xs flex items-center gap-1.5" style={{ color: MUTED }}><Loader2 size={14} className="animate-spin" /> กำลังค้นหา…</p>}

      {hits && !tooShort && !searching && hits.length === 0 && !error && (
        <p className="text-sm text-center py-4" style={{ color: MUTED }}>ไม่พบลูกค้า · ลองสะกดใหม่ หรือรับเป็นวอร์คอินไม่ระบุชื่อด้านล่าง</p>
      )}

      {hits && !tooShort && hits.length > 0 && (
        <ul className="space-y-2">
          {hits.map(h => {
            const label = customerLabel(h);
            return (
              <li key={h.id} className="bg-white rounded-xl p-3" style={{ border: `1.5px solid ${BORDER}` }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate" style={{ color: TEXT }}>{label}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: MUTED }}>{h.phone || "ไม่มีเบอร์"}</p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                    style={h.member ? { background: PRIMARY, color: "white" } : { background: "#F4F4F5", color: "#52525B" }}>
                    {h.member ? "สมาชิก" : "ไม่ใช่สมาชิก"}
                  </span>
                </div>
                {h.today ? (
                  <Link href={`/staff/bookings/${h.today.id}`}
                    className="mt-2.5 flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-semibold"
                    style={{ background: "#FFF8F4", color: PRIMARY, border: `1px solid ${PRIMARY}` }}>
                    มีคิววันนี้ {h.today.startTime} · {STATE_LABEL[h.today.state]}
                    <ChevronRight size={16} />
                  </Link>
                ) : (
                  <button type="button" disabled={!!creating} onClick={() => startWalkin(h.id, label)}
                    className="mt-2.5 w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold text-white disabled:opacity-60"
                    style={{ background: PRIMARY }}>
                    {creating === h.id ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                    รับวอร์คอิน · เช็คอินให้ฉัน
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="pt-2">
        <button type="button" disabled={!!creating} onClick={() => startWalkin(null, "ไม่ระบุชื่อ")}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold disabled:opacity-60"
          style={{ background: "white", color: TEXT, border: `1.5px dashed ${MUTED}` }}>
          {creating === "anon" ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
          วอร์คอิน ไม่ระบุชื่อ
        </button>
        <p className="text-[11px] text-center mt-2" style={{ color: MUTED }}>
          วอร์คอินจะเป็นสระไดร์ เริ่มเวลานี้ · ราคาสมาชิกคิดให้อัตโนมัติ · เปลี่ยนบริการ/รับเงินที่ POS
        </p>
      </div>
    </div>
  );
}
