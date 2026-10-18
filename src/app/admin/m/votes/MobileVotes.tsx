"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { candidateInitial } from "@/lib/staff-vote";

const PRIMARY = "#8B1D24";
const TEXT    = "#3B2A24";
const MUTED   = "#A08070";
const BORDER  = "#E8D8CC";

interface Cand { id: string; name: string; photoUrl: string | null; votes: number }
interface Row { id: string; at: string; candidate: string; voter: string }

const fmtTime = (iso: string) => new Date(iso).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Live scoreboard for phones: refreshes from the server every 5 s while the tab is visible. */
export default function MobileVotes({ title, candidates, log }: { title: string; candidates: Cand[]; log: Row[] }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, 5000);
    return () => clearInterval(id);
  }, [router]);

  const ranked = [...candidates].sort((a, b) => b.votes - a.votes);
  const total = ranked.reduce((s, c) => s + c.votes, 0);
  const max = Math.max(1, ...ranked.map(c => c.votes));
  const rankOf = (c: Cand) => 1 + ranked.filter(o => o.votes > c.votes).length; // ties share a rank

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold" style={{ color: TEXT }}>🎃 {title}</p>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "#DCFCE7", color: "#166534" }}>
          <span className="inline-block w-2 h-2 rounded-full animate-pulse" style={{ background: "#16A34A" }} /> LIVE
        </span>
      </div>

      <section className="bg-white rounded-2xl p-4" style={{ border: `1.5px solid ${BORDER}` }}>
        <p className="text-xs mb-3" style={{ color: MUTED }}>คะแนนรวม {total} โหวต</p>
        <div className="space-y-3">
          {ranked.map(c => (
            <div key={c.id} className="flex items-center gap-3">
              <span className="w-5 text-center text-sm font-bold" style={{ color: rankOf(c) === 1 && c.votes > 0 ? PRIMARY : MUTED }}>{rankOf(c)}</span>
              {c.photoUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={c.photoUrl} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                : <span className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center font-bold" style={{ background: "#F3E4D8", color: PRIMARY }}>{candidateInitial(c.name)}</span>}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium truncate" style={{ color: TEXT }}>{c.name}</span>
                  <span className="text-lg font-bold tabular-nums" style={{ color: TEXT }}>{c.votes}</span>
                </div>
                <div className="h-2 rounded-full mt-1" style={{ background: "#F3E4D8" }}>
                  <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${(c.votes / max) * 100}%`, background: PRIMARY }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white rounded-2xl p-4" style={{ border: `1.5px solid ${BORDER}` }}>
        <p className="text-sm font-semibold mb-2" style={{ color: TEXT }}>โหวตล่าสุด</p>
        {log.length === 0 ? <p className="text-sm" style={{ color: MUTED }}>ยังไม่มีการโหวต</p> : (
          <ul>
            {log.map(r => (
              <li key={r.id} className="flex items-baseline justify-between gap-2 py-1.5 text-sm" style={{ borderTop: `1px solid ${BORDER}`, color: TEXT }}>
                <span className="min-w-0 truncate">{r.voter} <span style={{ color: MUTED }}>→</span> <b>{r.candidate}</b></span>
                <span className="text-[11px] whitespace-nowrap" style={{ color: MUTED }}>{fmtTime(r.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
