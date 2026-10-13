"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Plus, Trash2, Send, RotateCcw, RefreshCw, Save, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import { LINE_KIND_LABEL, monthLabelTh, payslipTotals, type PayslipLine, type PayslipLineKind } from "@/lib/payslip-shared";

const PRIMARY = "#8B1D24";
const TEXT    = "#3B2A24";
const MUTED   = "#A08070";
const BORDER  = "#E8D8CC";

interface Slip {
  id: string; name: string; legalName: string | null; status: string; revision: number;
  lines: PayslipLine[]; notes: string | null;
  grossSatang: number; deductionSatang: number; netSatang: number; paidDailySatang: number;
  issuedAt: string | null;
  pendingDays: string[];
  salaryPayments: { date: string; amountSatang: number; notes: string | null }[];
}

const money = (s: number) => `฿${(s / 100).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const shiftMonth = (m: string, by: number) => {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(Date.UTC(y, mo - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};
const shortDay = (ymd: string) => Number(ymd.slice(8, 10));

export default function PayslipsManager({ month, thisMonth, slips }: { month: string; thisMonth: string; slips: Slip[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [editing, setEditing] = useState<Record<string, { lines: (Omit<PayslipLine, "amountSatang"> & { baht: string })[]; notes: string }>>({});

  async function call(url: string, body: unknown, key: string) {
    setBusy(key); setErr("");
    try {
      const res = await fetch(url, { method: url.endsWith("generate") ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setErr(data.error ?? "ไม่สำเร็จ"); return false; }
      router.refresh();
      return true;
    } catch { setErr("เชื่อมต่อไม่สำเร็จ"); return false; } finally { setBusy(null); }
  }

  function startEdit(s: Slip) {
    setEditing(p => ({ ...p, [s.id]: { lines: s.lines.map(l => ({ kind: l.kind, label: l.label, baht: String(l.amountSatang / 100) })), notes: s.notes ?? "" } }));
  }
  async function saveEdit(s: Slip) {
    const e = editing[s.id];
    const lines = e.lines.map(l => ({ kind: l.kind, label: l.label, amountSatang: Math.round(Number(l.baht) * 100) }));
    if (await call(`/api/admin/payslips/${s.id}`, { action: "save", lines, notes: e.notes }, s.id)) {
      setEditing(p => { const n = { ...p }; delete n[s.id]; return n; });
    }
  }
  const setLine = (id: string, i: number, patch: Partial<{ kind: PayslipLineKind; label: string; baht: string }>) =>
    setEditing(p => ({ ...p, [id]: { ...p[id], lines: p[id].lines.map((l, j) => j === i ? { ...l, ...patch } : l) } }));

  const issued = slips.filter(s => s.status === "ISSUED").length;

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: MUTED }}>Pay Slips</p>
          <h1 className="text-2xl font-medium" style={{ color: TEXT }}>สลิปเงินเดือน</h1>
          <p className="text-xs mt-1" style={{ color: MUTED }}>สร้างร่าง → ตรวจ/แก้ → ออกสลิป · พนักงานเห็นเฉพาะสลิปที่ออกแล้ว ในพอร์ทัลพนักงาน (/staff)</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/admin/payslips?month=${shiftMonth(month, -1)}`} className="p-2 rounded-lg" style={{ border: `1px solid ${BORDER}` }}><ChevronLeft size={16} /></Link>
          <span className="text-sm font-semibold w-36 text-center" style={{ color: TEXT }}>{monthLabelTh(month)}</span>
          {month < thisMonth
            ? <Link href={`/admin/payslips?month=${shiftMonth(month, 1)}`} className="p-2 rounded-lg" style={{ border: `1px solid ${BORDER}` }}><ChevronRight size={16} /></Link>
            : <span className="p-2 opacity-30"><ChevronRight size={16} /></span>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <button onClick={() => void call("/api/admin/payslips/generate", { month }, "gen")} disabled={busy === "gen"}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{ background: PRIMARY }}>
          <Plus size={15} /> สร้างร่างสลิปเดือนนี้
        </button>
        <span className="text-xs" style={{ color: MUTED }}>สร้างเฉพาะคนที่ยังไม่มีสลิปเดือนนี้ · ออกแล้ว {issued}/{slips.length}</span>
      </div>
      {err && <p className="text-sm mb-3" style={{ color: "#B91C1C" }}>{err}</p>}

      {slips.length === 0 && <p className="text-sm bg-white rounded-2xl p-6 text-center" style={{ color: MUTED, border: `1px solid ${BORDER}` }}>ยังไม่มีสลิปของเดือนนี้ — กด &quot;สร้างร่างสลิปเดือนนี้&quot;</p>}

      <div className="space-y-4">
        {slips.map(s => {
          const e = editing[s.id];
          const draft = s.status === "DRAFT";
          const preview = e ? payslipTotals(e.lines.map(l => ({ kind: l.kind, label: l.label, amountSatang: Math.round(Number(l.baht || 0) * 100) }))) : null;
          return (
            <section key={s.id} className="bg-white rounded-2xl p-5" style={{ border: `1.5px solid ${BORDER}` }}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold" style={{ color: TEXT }}>{s.name}{s.legalName ? <span className="ml-2 text-xs font-normal" style={{ color: MUTED }}>{s.legalName}</span> : null}</h2>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                    style={draft ? { background: "#FEF3C7", color: "#92400E" } : { background: "#F0FDF4", color: "#166534" }}>
                    {draft ? "ฉบับร่าง" : "ออกแล้ว"}{s.revision > 0 ? ` · แก้ไขครั้งที่ ${s.revision}` : ""}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-xs" style={{ color: MUTED }}>รายได้สุทธิ</p>
                  <p className="text-xl font-bold" style={{ color: TEXT }}>{money(preview ? preview.net : s.netSatang)}</p>
                </div>
              </div>

              {draft && s.pendingDays.length > 0 && (
                <p className="mt-3 text-xs flex items-start gap-1.5 p-2 rounded-lg" style={{ background: "#FFFBEB", color: "#92400E" }}>
                  <AlertTriangle size={14} className="flex-shrink-0 mt-px" />
                  ยังไม่ยืนยันค่าตอบแทนรายวัน {s.pendingDays.length} วัน (วันที่ {s.pendingDays.map(shortDay).join(", ")}) — ไม่ถูกนับในสลิป ยืนยันในหน้าค่าตอบแทนแล้วกด &quot;ดึงข้อมูลใหม่&quot;
                </p>
              )}
              {draft && s.salaryPayments.length > 0 && (
                <p className="mt-2 text-xs" style={{ color: MUTED }}>
                  เงินเดือนที่ลงจ่ายในรายจ่ายเดือนนี้: {s.salaryPayments.map(p => `${shortDay(p.date)} — ${money(p.amountSatang)}${p.notes ? ` (${p.notes})` : ""}`).join(" · ")}
                </p>
              )}

              {!e ? (
                <table className="w-full text-sm mt-3">
                  <tbody>
                    {s.lines.map((l, i) => (
                      <tr key={i} className="border-t" style={{ borderColor: BORDER, color: TEXT }}>
                        <td className="py-1.5 text-xs" style={{ color: MUTED }}>{LINE_KIND_LABEL[l.kind]}</td>
                        <td className="py-1.5">{l.label}</td>
                        <td className="py-1.5 text-right">{l.kind === "DEDUCTION" ? "−" : ""}{money(l.amountSatang)}</td>
                      </tr>
                    ))}
                    {s.lines.length === 0 && <tr><td className="py-2 text-xs" style={{ color: MUTED }}>ไม่มีรายการ</td></tr>}
                  </tbody>
                </table>
              ) : (
                <div className="mt-3 space-y-2">
                  {e.lines.map((l, i) => (
                    <div key={i} className="flex gap-2">
                      <select value={l.kind} onChange={ev => setLine(s.id, i, { kind: ev.target.value as PayslipLineKind })}
                        className="border rounded-lg px-2 py-1.5 text-xs" style={{ borderColor: BORDER }}>
                        {Object.entries(LINE_KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                      <input value={l.label} onChange={ev => setLine(s.id, i, { label: ev.target.value })}
                        className="flex-1 border rounded-lg px-2 py-1.5 text-sm" style={{ borderColor: BORDER }} />
                      <input type="number" step="0.01" value={l.baht} onChange={ev => setLine(s.id, i, { baht: ev.target.value })}
                        className="w-32 border rounded-lg px-2 py-1.5 text-sm text-right" style={{ borderColor: BORDER }} />
                      <button onClick={() => setEditing(p => ({ ...p, [s.id]: { ...p[s.id], lines: p[s.id].lines.filter((_, j) => j !== i) } }))}
                        className="px-2 rounded-lg" style={{ color: "#B91C1C", border: `1px solid ${BORDER}` }}><Trash2 size={14} /></button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <button onClick={() => setEditing(p => ({ ...p, [s.id]: { ...p[s.id], lines: [...p[s.id].lines, { kind: "OTHER", label: "", baht: "" }] } }))}
                      className="text-xs px-3 py-1.5 rounded-lg" style={{ border: `1px solid ${BORDER}`, color: TEXT }}>+ เพิ่มรายได้</button>
                    <button onClick={() => setEditing(p => ({ ...p, [s.id]: { ...p[s.id], lines: [...p[s.id].lines, { kind: "DEDUCTION", label: "เบิกล่วงหน้า", baht: "" }] } }))}
                      className="text-xs px-3 py-1.5 rounded-lg" style={{ border: `1px solid ${BORDER}`, color: TEXT }}>+ เพิ่มรายการหัก</button>
                  </div>
                  <textarea value={e.notes} onChange={ev => setEditing(p => ({ ...p, [s.id]: { ...p[s.id], notes: ev.target.value } }))}
                    placeholder="หมายเหตุบนสลิป (ถ้ามี)" rows={2} className="w-full border rounded-lg px-2 py-1.5 text-sm" style={{ borderColor: BORDER }} />
                  {preview && <p className="text-xs" style={{ color: MUTED }}>รายได้ {money(preview.gross)} · หัก {money(preview.deduction)} · สุทธิ {money(preview.net)}</p>}
                </div>
              )}

              <div className="flex flex-wrap gap-2 mt-4">
                <Link href={`/payslip/${s.id}`} target="_blank" className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg" style={{ border: `1px solid ${BORDER}`, color: TEXT }}>
                  <FileText size={13} /> ดูสลิป / PDF
                </Link>
                {draft && !e && <button onClick={() => startEdit(s)} className="text-xs px-3 py-1.5 rounded-lg" style={{ border: `1px solid ${BORDER}`, color: TEXT }}>แก้ไขรายการ</button>}
                {draft && e && <button onClick={() => void saveEdit(s)} disabled={busy === s.id} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-white disabled:opacity-50" style={{ background: PRIMARY }}><Save size={13} /> บันทึก</button>}
                {draft && e && <button onClick={() => setEditing(p => { const n = { ...p }; delete n[s.id]; return n; })} className="text-xs px-3 py-1.5 rounded-lg" style={{ border: `1px solid ${BORDER}`, color: MUTED }}>ยกเลิก</button>}
                {draft && !e && <button onClick={() => { if (confirm("ดึงข้อมูลใหม่จากระบบ? รายการที่แก้เองจะถูกแทนที่")) void call(`/api/admin/payslips/${s.id}`, { action: "rebuild" }, s.id); }} disabled={busy === s.id}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg disabled:opacity-50" style={{ border: `1px solid ${BORDER}`, color: TEXT }}><RefreshCw size={13} /> ดึงข้อมูลใหม่</button>}
                {draft && !e && <button onClick={() => { if (confirm(`ออกสลิปของ ${s.name}? พนักงานจะเห็นทันที`)) void call(`/api/admin/payslips/${s.id}`, { action: "issue" }, s.id); }} disabled={busy === s.id}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-white disabled:opacity-50" style={{ background: "#166534" }}><Send size={13} /> ออกสลิป</button>}
                {!draft && <button onClick={() => { if (confirm("เปิดแก้สลิปนี้? พนักงานจะไม่เห็นจนกว่าจะออกใหม่")) void call(`/api/admin/payslips/${s.id}`, { action: "reopen" }, s.id); }} disabled={busy === s.id}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg disabled:opacity-50" style={{ border: `1px solid ${BORDER}`, color: TEXT }}><RotateCcw size={13} /> เปิดแก้</button>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
