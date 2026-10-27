"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, Merge, Search, X } from "lucide-react";

type Summary = { id: string; name: string; nickname: string | null; phone: string; line: boolean; bookings: number; member: string | null };
const TEXT = "#3B2A24", MUTED = "#A08070", BORDER = "#E8D8CC", PRIMARY = "#8B1D24";

/**
 * "รวมกับบัญชีอื่น": find the duplicate, pick which record to keep (default:
 * the one with more bookings), then merge — bookings, membership, coupons,
 * LINE link etc. move to the kept record and the other is deleted.
 */
export default function MergeCustomerButton({ customerId }: { customerId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ id: string; name: string; nickname: string | null; phone: string }[]>([]);
  const [pair, setPair] = useState<{ a: Summary; b: Summary; keep: "a" | "b" } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open || q.trim().length < 2) return;
    const t = setTimeout(() => {
      fetch(`/api/admin/customers?q=${encodeURIComponent(q.trim())}&limit=8`).then(r => r.json())
        .then((rows: { id: string; name: string; nickname: string | null; phone: string }[]) => setResults(rows.filter(r => r.id !== customerId))).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [q, open, customerId]);

  async function pick(otherId: string) {
    setErr(null);
    const [a, b] = await Promise.all([customerId, otherId].map(id => fetch(`/api/admin/customers/${id}/merge`).then(r => r.json() as Promise<Summary>)));
    setPair({ a, b, keep: b.bookings > a.bookings ? "b" : "a" });
  }

  async function merge() {
    if (!pair) return;
    const keep = pair.keep === "a" ? pair.a : pair.b, drop = pair.keep === "a" ? pair.b : pair.a;
    setBusy(true); setErr(null);
    const res = await fetch(`/api/admin/customers/${keep.id}/merge`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ removeId: drop.id }) }).catch(() => null);
    const j = await res?.json().catch(() => ({})) as { error?: string } | undefined;
    setBusy(false);
    if (!res?.ok) { setErr(j?.error ?? "รวมบัญชีไม่สำเร็จ"); return; }
    setOpen(false);
    router.push(`/admin/m/customers/${keep.id}`);
    router.refresh();
  }

  const card = (s: Summary, which: "a" | "b") => {
    const on = pair?.keep === which;
    return (
      <button type="button" onClick={() => setPair(p => p && { ...p, keep: which })} className="w-full text-left rounded-xl p-3 space-y-0.5"
        style={{ border: `2px solid ${on ? PRIMARY : BORDER}`, background: on ? "#FFF7F5" : "white" }}>
        <p className="text-[11px] font-semibold" style={{ color: on ? PRIMARY : MUTED }}>{on ? "✓ เก็บบัญชีนี้" : "รวมเข้าแล้วลบ"}</p>
        <p className="text-sm font-semibold" style={{ color: TEXT }}>{s.nickname ? `${s.nickname} · ` : ""}{s.name}</p>
        <p className="text-xs" style={{ color: MUTED }}>{s.phone} · {s.bookings} การจอง{s.member ? ` · สมาชิก${s.member}` : ""}{s.line ? " · เชื่อม LINE" : ""}</p>
      </button>
    );
  };

  return (
    <>
      <button type="button" onClick={() => { setOpen(true); setPair(null); setQ(""); setResults([]); }}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium" style={{ border: `1px solid ${BORDER}`, color: MUTED, background: "white" }}>
        <Merge size={13} /> รวมกับบัญชีซ้ำ
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(0,0,0,0.35)" }} onClick={() => !busy && setOpen(false)}>
          <div className="w-full max-w-md bg-white rounded-t-2xl p-4 pb-6 max-h-[85vh] overflow-y-auto space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <p className="font-semibold flex-1" style={{ color: TEXT }}>รวมบัญชีลูกค้าที่ซ้ำ</p>
              <button type="button" onClick={() => setOpen(false)} className="p-1" style={{ color: MUTED }} aria-label="ปิด"><X size={18} /></button>
            </div>
            {!pair ? (
              <>
                <p className="text-xs" style={{ color: MUTED }}>ค้นหาบัญชีอีกอันของลูกค้าคนเดียวกัน (ชื่อ ชื่อเล่น หรือเบอร์)</p>
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ border: `1px solid ${BORDER}` }}>
                  <Search size={15} style={{ color: MUTED }} />
                  <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="เช่น มินนี่ / Mintaree / 0655…" className="flex-1 text-sm outline-none bg-transparent" />
                </div>
                <div className="space-y-1">
                  {results.map(r => (
                    <button key={r.id} type="button" onClick={() => pick(r.id)} className="w-full text-left px-3 py-2.5 rounded-xl" style={{ background: "#FDF8F3" }}>
                      <p className="text-sm" style={{ color: TEXT }}>{r.nickname ? `${r.nickname} · ` : ""}{r.name}</p>
                      <p className="text-xs" style={{ color: MUTED }}>{r.phone}</p>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <p className="text-xs" style={{ color: MUTED }}>แตะเลือกบัญชีที่จะเก็บไว้ — การจอง สมาชิก คูปอง และการเชื่อม LINE จะย้ายมารวมกัน แล้วบัญชีอีกอันจะถูกลบ (เบอร์ของบัญชีที่ลบจะจดไว้ในบันทึก)</p>
                {card(pair.a, "a")}
                <div className="flex justify-center" style={{ color: MUTED }}><ArrowLeftRight size={16} /></div>
                {card(pair.b, "b")}
                {err && <p className="text-xs" style={{ color: "#B42318" }}>{err}</p>}
                <div className="flex gap-2">
                  <button type="button" disabled={busy} onClick={() => setPair(null)} className="px-4 py-3 rounded-xl text-sm" style={{ border: `1px solid ${BORDER}`, color: TEXT }}>เลือกใหม่</button>
                  <button type="button" disabled={busy} onClick={merge} className="flex-1 py-3 rounded-xl text-white font-semibold disabled:opacity-50" style={{ background: PRIMARY }}>
                    {busy ? "กำลังรวม…" : "ยืนยันรวมบัญชี"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
