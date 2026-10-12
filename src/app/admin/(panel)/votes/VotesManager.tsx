"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Eye, EyeOff, Check } from "lucide-react";
import ImageUpload from "@/components/ImageUpload";
import { PARTICIPATION_BONUS, PARTICIPATION_MIN_VOTES, VOTE_PRIZES, candidateInitial } from "@/lib/staff-vote";

const PRIMARY = "#8B1D24";
const TEXT    = "#3B2A24";
const MUTED   = "#A08070";
const BORDER  = "#E8D8CC";

interface Candidate { id: string; name: string; photoUrl: string | null; isActive: boolean; sortOrder: number; votes: number }
interface LogRow { id: string; at: string; candidate: string; customer: string; phone: string }
interface Props { event: { title: string; from: string; to: string }; candidates: Candidate[]; log: LogRow[] }

const fmtDay = (ymd: string) => new Date(ymd + "T12:00:00").toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
const fmtTime = (iso: string) => new Date(iso).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const baht = (n: number) => `฿${n.toLocaleString("th-TH")}`;

/** Prize implied by standing: ranks 1–3 win the cash prizes, the rest the bonus once they have enough votes. */
function prizeFor(rank: number, votes: number): number {
  if (rank <= VOTE_PRIZES.length) return VOTE_PRIZES[rank - 1];
  return votes >= PARTICIPATION_MIN_VOTES ? PARTICIPATION_BONUS : 0;
}

export default function VotesManager({ event, candidates: initial, log }: Props) {
  const router = useRouter();
  const [candidates, setCandidates] = useState(initial);
  const [names, setNames] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");

  const total = candidates.reduce((s, c) => s + c.votes, 0);
  const ranked = [...candidates].filter(c => c.isActive || c.votes > 0).sort((a, b) => b.votes - a.votes || a.sortOrder - b.sortOrder);
  const rankOf = (c: Candidate) => 1 + ranked.filter(o => o.votes > c.votes).length; // ties share a rank
  const max = Math.max(1, ...ranked.map(c => c.votes));

  async function patch(id: string, body: Record<string, unknown>) {
    setBusy(id); setErr("");
    try {
      const res = await fetch(`/api/admin/votes/candidates/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setErr(data.error ?? "บันทึกไม่สำเร็จ"); return; }
      setCandidates(prev => prev.map(c => c.id === id ? { ...c, ...data.candidate } : c));
      router.refresh();
    } catch { setErr("เชื่อมต่อไม่สำเร็จ"); } finally { setBusy(null); }
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: MUTED }}>Staff Vote</p>
          <h1 className="text-2xl font-medium" style={{ color: TEXT }}>🎃 {event.title}</h1>
          <p className="text-xs mt-1" style={{ color: MUTED }}>เปิดโหวต {fmtDay(event.from)} – {fmtDay(event.to)} · ลูกค้าโหวตได้คนละ 1 ครั้ง</p>
        </div>
        <a href="/api/admin/votes?format=csv" className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ border: `1px solid ${BORDER}`, color: TEXT, background: "white" }}>
          <Download size={15} /> ดาวน์โหลดบันทึกการโหวต (CSV)
        </a>
      </div>

      {err && <p className="text-sm mb-3" style={{ color: "#B91C1C" }}>{err}</p>}

      {/* Standings */}
      <section className="bg-white rounded-2xl p-5 mb-5" style={{ border: `1.5px solid ${BORDER}` }}>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-sm font-semibold" style={{ color: TEXT }}>คะแนนโหวตตอนนี้</h2>
          <span className="text-sm" style={{ color: MUTED }}>รวม <b style={{ color: PRIMARY }}>{total}</b> โหวต</span>
        </div>
        <ul className="space-y-3">
          {ranked.map(c => {
            const rank = rankOf(c);
            const tied = ranked.filter(o => o.votes === c.votes).length > 1 && c.votes > 0;
            const prize = total > 0 ? prizeFor(rank, c.votes) : 0;
            return (
              <li key={c.id} className="flex items-center gap-3">
                <span className="w-7 text-center text-sm font-semibold" style={{ color: rank <= 3 && c.votes > 0 ? PRIMARY : MUTED }}>{c.votes > 0 ? rank : "–"}</span>
                {c.photoUrl
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={c.photoUrl} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                  : <span className="w-10 h-10 rounded-full flex items-center justify-center text-sm flex-shrink-0" style={{ background: "#F9F0E8", color: PRIMARY }}>{candidateInitial(c.name)}</span>}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm" style={{ color: TEXT }}>
                    <span className="font-medium truncate">{c.name}</span>
                    {!c.isActive && <span className="text-[10px] px-1.5 rounded" style={{ background: "#F3F4F6", color: MUTED }}>ซ่อนจากลูกค้า</span>}
                    {tied && <span className="text-[10px] px-1.5 rounded" style={{ background: "#FEF3C7", color: "#92400E" }}>คะแนนเท่ากัน</span>}
                  </div>
                  <div className="h-2 rounded-full mt-1.5" style={{ background: "#F5EBE3" }}>
                    <div className="h-2 rounded-full" style={{ width: `${(c.votes / max) * 100}%`, background: PRIMARY, minWidth: c.votes ? 6 : 0 }} />
                  </div>
                </div>
                <div className="text-right w-24 flex-shrink-0">
                  <p className="text-lg font-semibold leading-none" style={{ color: TEXT }}>{c.votes}</p>
                  <p className="text-[11px]" style={{ color: MUTED }}>{total ? `${Math.round((c.votes / total) * 100)}%` : "0%"}{prize > 0 ? ` · ${baht(prize)}` : ""}</p>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="text-[11px] mt-4" style={{ color: MUTED }}>
          รางวัลตามโปสเตอร์: อันดับ 1 {baht(VOTE_PRIZES[0])} · อันดับ 2 {baht(VOTE_PRIZES[1])} · อันดับ 3 {baht(VOTE_PRIZES[2])} · อันดับ 4–6 คนละ {baht(PARTICIPATION_BONUS)} เมื่อได้ครบ {PARTICIPATION_MIN_VOTES} โหวต
          (ตัวเลขรางวัลข้างบนเป็นการคำนวณตามอันดับปัจจุบัน ถ้าคะแนนเท่ากันต้องตัดสินเอง)
        </p>
      </section>

      {/* Candidates */}
      <section className="bg-white rounded-2xl p-5 mb-5" style={{ border: `1.5px solid ${BORDER}` }}>
        <h2 className="text-sm font-semibold mb-1" style={{ color: TEXT }}>พนักงานที่เข้าร่วม</h2>
        <p className="text-xs mb-4" style={{ color: MUTED }}>อัปโหลดรูป แก้ชื่อที่ลูกค้าเห็น หรือซ่อนบางคน (รูปจะแสดงในหน้าโหวตของลูกค้า)</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {candidates.map(c => (
            <div key={c.id} className="rounded-xl p-3" style={{ border: `1px solid ${BORDER}`, opacity: c.isActive ? 1 : 0.6 }}>
              <ImageUpload kind="profile" ref={`vote-${c.id}`} value={c.photoUrl} onChange={url => void patch(c.id, { photoUrl: url })} />
              <div className="flex gap-1.5 mt-2">
                <input value={names[c.id] ?? c.name} onChange={e => setNames(p => ({ ...p, [c.id]: e.target.value }))}
                  className="flex-1 min-w-0 border rounded-lg px-2 py-1.5 text-sm" style={{ borderColor: BORDER, color: TEXT }} />
                {(names[c.id] ?? c.name) !== c.name && (
                  <button onClick={() => void patch(c.id, { name: names[c.id] })} disabled={busy === c.id}
                    className="px-2.5 rounded-lg text-white disabled:opacity-50" style={{ background: PRIMARY }}><Check size={14} /></button>
                )}
              </div>
              <button onClick={() => void patch(c.id, { isActive: !c.isActive })} disabled={busy === c.id}
                className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs disabled:opacity-50"
                style={{ border: `1px solid ${BORDER}`, color: MUTED }}>
                {c.isActive ? <><EyeOff size={12} /> ซ่อนจากหน้าโหวต</> : <><Eye size={12} /> แสดงในหน้าโหวต</>}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Log */}
      <section className="bg-white rounded-2xl p-5" style={{ border: `1.5px solid ${BORDER}` }}>
        <h2 className="text-sm font-semibold mb-3" style={{ color: TEXT }}>บันทึกการโหวต ({log.length})</h2>
        {log.length === 0 ? <p className="text-sm" style={{ color: MUTED }}>ยังไม่มีการโหวต</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs" style={{ color: MUTED }}><th className="py-1.5 pr-3">เวลา</th><th className="pr-3">ผู้โหวต</th><th className="pr-3">เบอร์โทร</th><th>โหวตให้</th></tr></thead>
              <tbody>
                {log.map(r => (
                  <tr key={r.id} className="border-t" style={{ borderColor: BORDER, color: TEXT }}>
                    <td className="py-1.5 pr-3 whitespace-nowrap">{fmtTime(r.at)}</td><td className="pr-3">{r.customer}</td><td className="pr-3">{r.phone}</td><td className="font-medium">{r.candidate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[11px] mt-3" style={{ color: MUTED }}>บันทึกนี้แก้ไขหรือลบไม่ได้ เพื่อเป็นหลักฐานการโหวต</p>
      </section>
    </div>
  );
}
