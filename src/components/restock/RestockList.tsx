"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, RotateCcw } from "lucide-react";

const PRIMARY = "#8B1D24";
const TEXT    = "#3B2A24";
const MUTED   = "#A08070";
const BORDER  = "#E8D8CC";

export type RestockRow = {
  id: string; branch: string; items: string[]; extras: string[]; note: string | null;
  requestedBy: string; createdAt: string; status: string; doneAt: string | null; doneBy: string | null;
};

const when = (iso: string) => new Date(iso).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Restock requests; `canClose` (admin) shows the done / reopen button. */
export default function RestockList({ rows, canClose }: { rows: RestockRow[]; canClose: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function mark(id: string, done: boolean) {
    setBusy(id);
    await fetch("/api/restock", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, done }) }).catch(() => null);
    setBusy(null);
    router.refresh();
  }

  if (!rows.length) return <p className="text-sm text-center py-6" style={{ color: MUTED }}>ยังไม่มีรายการ</p>;
  return (
    <div className="space-y-3">
      {rows.map(r => {
        const done = r.status === "DONE";
        return (
          <article key={r.id} className="bg-white rounded-2xl p-4 space-y-2" style={{ border: `1px solid ${BORDER}`, opacity: done ? 0.6 : 1 }}>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold flex-1" style={{ color: TEXT }}>{r.branch}</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold"
                style={done ? { background: "#E8F5EC", color: "#166534" } : { background: "#FFF7ED", color: "#9A3412" }}>
                {done ? "นำไปแล้ว" : "รอนำไป"}
              </span>
            </div>
            <p className="text-xs" style={{ color: MUTED }}>{when(r.createdAt)} · {r.requestedBy}</p>
            <ul className="text-sm space-y-0.5" style={{ color: TEXT }}>
              {[...r.items, ...r.extras].map((i, k) => <li key={k}>• {i}</li>)}
            </ul>
            {r.note && <p className="text-xs rounded-lg px-2.5 py-1.5" style={{ background: "#FDF8F3", color: TEXT }}>หมายเหตุ: {r.note}</p>}
            {done && r.doneAt && <p className="text-[11px]" style={{ color: MUTED }}>นำไปแล้ว {when(r.doneAt)}{r.doneBy ? ` · ${r.doneBy}` : ""}</p>}
            {canClose && (
              <button type="button" disabled={busy === r.id} onClick={() => mark(r.id, !done)}
                className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
                style={done ? { border: `1px solid ${BORDER}`, color: MUTED } : { background: PRIMARY, color: "white" }}>
                {done ? <><RotateCcw size={14} /> ยังไม่ได้นำไป</> : <><Check size={15} /> นำไปที่ร้านแล้ว</>}
              </button>
            )}
          </article>
        );
      })}
    </div>
  );
}
