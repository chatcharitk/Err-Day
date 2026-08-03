"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Banknote, Check, Loader2, Settings, CalendarDays, Wallet, CalendarRange, Receipt, X } from "lucide-react";

const PRIMARY = "#8B1D24";
const TEXT    = "#3B2A24";
const MUTED   = "#A08070";
const BORDER  = "#E8D8CC";

type PayType = "MONTHLY_SALARY" | "DAILY_WAGE";
type Cadence = "MONTHLY" | "WEEKLY";

interface Branch { id: string; name: string }
interface Row {
  staffId: string; name: string;
  payType: PayType; baseSatang: number; payCadence: Cadence;
  commissionSatang: number; completedCount: number;
  otHours: number; otRateSatang: number; otSatang: number;
  tipSatang: number;
  totalSatang: number; worked: boolean; status: "PENDING" | "PAID"; paidAt: string | null;
  expenseId: string | null;
}
interface StaffCfg { id: string; name: string; branchId: string; payType: PayType; baseSatang: number; payCadence: Cadence; otRateSatang: number | null }
interface ServiceCfg { id: string; nameTh: string; category: string; commissionSatang: number }
interface AddonCfg { id: string; nameTh: string; commissionSatang: number }

interface Props {
  branches: Branch[];
  activeBranchId: string;
  activeDate: string;
  todayStr: string;
  rows: Row[];
  staffConfig: StaffCfg[];
  services: ServiceCfg[];
  addons: AddonCfg[];
  /** Route the daily branch/date navigation targets. Desktop or /admin/m/payroll. */
  basePath?: string;
}

const baht = (satang: number) =>
  `฿${(satang / 100).toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const branchShort = (b: Branch) => b.name.replace(/^err\.day\s*/i, "");

export default function PayrollView({ branches, activeBranchId, activeDate, todayStr, rows, staffConfig, services, addons, basePath = "/admin/payroll" }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"daily" | "monthly" | "settings">("daily");

  const go = (branchId: string, date: string) =>
    router.push(`${basePath}?branchId=${branchId}&date=${date}`);

  return (
    <div className="px-6 py-8 max-w-5xl">
      <div className="mb-5">
        <p className="text-xs uppercase tracking-widest mb-1" style={{ color: MUTED }}>Payroll</p>
        <h1 className="text-2xl font-medium flex items-center gap-2" style={{ color: TEXT }}>
          <Wallet size={22} style={{ color: PRIMARY }} /> ค่าตอบแทนพนักงาน
        </h1>
      </div>

      {/* tabs */}
      <div className="flex gap-2 mb-6">
        {([["daily", "จ่ายรายวัน", CalendarDays], ["monthly", "สรุปรายเดือน", CalendarRange], ["settings", "ตั้งค่าฐานเงิน/ค่ามือ", Settings]] as const).map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTab(id)}
            className="text-sm px-4 py-1.5 rounded-full border inline-flex items-center gap-1.5"
            style={tab === id ? { background: PRIMARY, borderColor: PRIMARY, color: "white" } : { background: "white", borderColor: BORDER, color: "#6B5245" }}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {tab === "daily" && <DailyTab key={`${activeBranchId}:${activeDate}`} branches={branches} activeBranchId={activeBranchId} activeDate={activeDate} todayStr={todayStr} rows={rows} onNav={go} />}
      {tab === "monthly" && <MonthlyTab branches={branches} activeBranchId={activeBranchId} />}
      {tab === "settings" && <SettingsTab branches={branches} staffConfig={staffConfig} services={services} addons={addons} />}
    </div>
  );
}

// ─── Daily payout tab ─────────────────────────────────────────────────────────
function DailyTab({ branches, activeBranchId, activeDate, todayStr, rows, onNav }: {
  branches: Branch[]; activeBranchId: string; activeDate: string; todayStr: string; rows: Row[];
  onNav: (b: string, d: string) => void;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [otEdits, setOtEdits] = useState<Record<string, string>>({});
  const [tipEdits, setTipEdits] = useState<Record<string, string>>({});
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  async function patch(staffId: string, body: Record<string, unknown>) {
    setBusyId(staffId);
    try {
      const res = await fetch("/api/admin/payroll", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId, date: activeDate, ...body }),
      });
      if (res.ok) {
        // Drop the local edits so the inputs reflect the refreshed server value.
        setOtEdits(p => { const n = { ...p }; delete n[staffId]; return n; });
        setTipEdits(p => { const n = { ...p }; delete n[staffId]; return n; });
        router.refresh();
      }
    } finally { setBusyId(null); }
  }

  const totalCommission = rows.reduce((s, r) => s + r.commissionSatang, 0);
  const totalOt = rows.reduce((s, r) => s + r.otSatang, 0);
  const grand = totalCommission + totalOt;
  const isToday = activeDate === todayStr;

  return (
    <>
      {/* branch + date controls */}
      <div className="flex items-center gap-3 flex-wrap mb-4">
        <div className="flex gap-2">
          {branches.map(b => (
            <button key={b.id} onClick={() => onNav(b.id, activeDate)}
              className="text-sm px-3 py-1.5 rounded-lg border"
              style={activeBranchId === b.id ? { background: "#F0E4D8", borderColor: PRIMARY, color: PRIMARY, fontWeight: 600 } : { background: "white", borderColor: BORDER, color: "#6B5245" }}>
              {branchShort(b)}
            </button>
          ))}
        </div>
        <input type="date" value={activeDate} max={todayStr}
          onChange={e => onNav(activeBranchId, e.target.value)}
          className="px-3 py-1.5 text-sm rounded-lg border bg-white" style={{ borderColor: BORDER, color: TEXT }} />
        {isToday && <span className="text-xs px-2 py-1 rounded-full" style={{ background: "#ECFDF5", color: "#166534" }}>วันนี้</span>}
      </div>

      {/* summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[["ค่ามือรวม", totalCommission], ["OT รวม", totalOt], ["รวมจ่ายวันนี้", grand]].map(([label, val], i) => (
          <div key={i} className="rounded-xl bg-white p-3" style={{ border: `1.5px solid ${i === 2 ? PRIMARY : BORDER}` }}>
            <p className="text-xs" style={{ color: MUTED }}>{label as string}</p>
            <p className="text-lg font-bold" style={{ color: i === 2 ? PRIMARY : TEXT }}>{baht(val as number)}</p>
          </div>
        ))}
      </div>

      {rows.length === 0 && (
        <div className="rounded-2xl bg-white p-10 text-center" style={{ border: `1.5px solid ${BORDER}` }}>
          <p className="text-sm" style={{ color: MUTED }}>ไม่มีพนักงานในสาขานี้</p>
        </div>
      )}

      <div className="space-y-2">
        {rows.map(r => {
          const otVal = otEdits[r.staffId] ?? String(r.otHours);
          const tipVal = tipEdits[r.staffId] ?? String(r.tipSatang / 100);
          const paid = r.status === "PAID";
          return (
            <div key={r.staffId} className="rounded-xl bg-white p-3" style={{ border: `1.5px solid ${paid ? "#86EFAC" : BORDER}` }}>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-32">
                  <p className="font-semibold" style={{ color: TEXT }}>{r.name}</p>
                  <p className="text-[11px]" style={{ color: MUTED }}>
                    {r.completedCount} งาน · ค่ามือ {baht(r.commissionSatang)} · OT {baht(r.otRateSatang)}/ชม.
                  </p>
                </div>

                {/* OT hours input */}
                <div className="flex items-center gap-1">
                  <label className="text-[11px]" style={{ color: MUTED }}>OT ชม.</label>
                  <input
                    type="number" step="0.5" min="0" inputMode="decimal"
                    value={otVal}
                    disabled={paid || busyId === r.staffId}
                    onChange={e => setOtEdits(p => ({ ...p, [r.staffId]: e.target.value }))}
                    onBlur={() => {
                      const raw = otEdits[r.staffId];
                      if (raw === undefined) return;            // not edited
                      const h = Math.min(24, Math.max(0, parseFloat(raw)));
                      if (!Number.isNaN(h) && h !== r.otHours) patch(r.staffId, { otHours: h });
                      else setOtEdits(p => { const n = { ...p }; delete n[r.staffId]; return n; }); // revert bad/no-op input
                    }}
                    className="w-16 px-2 py-1 text-sm rounded-lg border text-right disabled:opacity-50"
                    style={{ borderColor: BORDER, color: TEXT }}
                  />
                  <span className="text-xs w-16 text-right" style={{ color: MUTED }}>{baht(r.otSatang)}</span>
                </div>

                {/* tip input */}
                <div className="flex items-center gap-1">
                  <label className="text-[11px]" style={{ color: MUTED }}>ทิป ฿</label>
                  <input
                    type="number" step="1" min="0" inputMode="decimal"
                    value={tipVal}
                    disabled={paid || busyId === r.staffId}
                    onChange={e => setTipEdits(p => ({ ...p, [r.staffId]: e.target.value }))}
                    onBlur={() => {
                      const raw = tipEdits[r.staffId];
                      if (raw === undefined) return;            // not edited
                      const baht2satang = Math.round(Math.max(0, parseFloat(raw)) * 100);
                      if (!Number.isNaN(baht2satang) && baht2satang !== r.tipSatang) patch(r.staffId, { tipSatang: baht2satang });
                      else setTipEdits(p => { const n = { ...p }; delete n[r.staffId]; return n; }); // revert bad/no-op input
                    }}
                    className="w-16 px-2 py-1 text-sm rounded-lg border text-right disabled:opacity-50"
                    style={{ borderColor: BORDER, color: TEXT }}
                  />
                </div>

                {/* total */}
                <div className="text-right w-24">
                  <p className="text-[10px]" style={{ color: MUTED }}>รวม</p>
                  <p className="font-bold" style={{ color: PRIMARY }}>{baht(r.totalSatang)}</p>
                </div>

                {/* pay action */}
                {paid ? (
                  <button onClick={() => patch(r.staffId, { action: "unpay" })} disabled={busyId === r.staffId}
                    className="text-xs px-3 py-1.5 rounded-lg inline-flex items-center gap-1" style={{ background: "#DCFCE7", color: "#166534" }}>
                    {busyId === r.staffId ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} จ่ายแล้ว
                  </button>
                ) : (
                  <button onClick={() => patch(r.staffId, { action: "pay" })} disabled={busyId === r.staffId}
                    className="text-xs px-3 py-1.5 rounded-lg text-white inline-flex items-center gap-1 disabled:opacity-50" style={{ background: PRIMARY }}>
                    {busyId === r.staffId ? <Loader2 size={12} className="animate-spin" /> : <Banknote size={12} />} จ่ายเงิน
                  </button>
                )}

                {/* record as expense */}
                {r.expenseId ? (
                  <Link href={`/admin/expenses/${r.expenseId}`}
                    className="text-xs px-3 py-1.5 rounded-lg inline-flex items-center gap-1" style={{ background: "#DCFCE7", color: "#166534" }}>
                    <Check size={12} /> บันทึกแล้ว
                  </Link>
                ) : (
                  <button onClick={() => setReviewingId(r.staffId)} disabled={!paid}
                    title={paid ? undefined : "ต้องกดจ่ายเงินก่อน"}
                    className="text-xs px-3 py-1.5 rounded-lg inline-flex items-center gap-1 disabled:opacity-40"
                    style={{ border: `1px solid ${BORDER}`, color: PRIMARY }}>
                    <Receipt size={12} /> บันทึกเป็นรายจ่าย
                  </button>
                )}
              </div>

              {reviewingId === r.staffId && (
                <RecordExpenseReview
                  row={r} date={activeDate}
                  onClose={() => setReviewingId(null)}
                  onRecorded={() => { setReviewingId(null); router.refresh(); }}
                />
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[11px] mt-4" style={{ color: MUTED }}>
        ค่ามือ = ค่าคอมมิชชั่นต่อบริการของงานที่เสร็จ (COMPLETED) วันนั้น · OT = ชั่วโมงที่กรอก × เรตต่อชั่วโมง · เงินเดือน/ค่าแรงฐานจ่ายแยกตามรอบ (ดูแท็บตั้งค่า)
      </p>
    </>
  );
}

// ─── Review-and-edit panel: confirm the OT/commission/tip breakdown before recording ──
function RecordExpenseReview({ row, date, onClose, onRecorded }: {
  row: Row; date: string; onClose: () => void; onRecorded: () => void;
}) {
  const [commissionBaht, setCommissionBaht] = useState(String(row.commissionSatang / 100));
  const [otBaht, setOtBaht] = useState(String(row.otSatang / 100));
  const [tipBaht, setTipBaht] = useState(String(row.tipSatang / 100));
  const [category, setCategory] = useState<"commission_bonus" | "salary">("commission_bonus");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const total = (parseFloat(commissionBaht) || 0) + (parseFloat(otBaht) || 0) + (parseFloat(tipBaht) || 0);

  async function confirm() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/payroll/daily-expense", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffId: row.staffId, date, category,
          commissionSatang: Math.round((parseFloat(commissionBaht) || 0) * 100),
          otSatang: Math.round((parseFloat(otBaht) || 0) * 100),
          tipSatang: Math.round((parseFloat(tipBaht) || 0) * 100),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "บันทึกไม่สำเร็จ"); return; }
      onRecorded();
    } finally { setSaving(false); }
  }

  return (
    <div className="mt-3 pt-3 rounded-lg" style={{ borderTop: `1px dashed ${BORDER}` }}>
      <p className="text-xs font-medium mb-2" style={{ color: TEXT }}>ตรวจสอบก่อนบันทึกเป็นรายจ่าย — {row.name}</p>
      <div className="grid grid-cols-3 gap-2 mb-2">
        <div>
          <label className="text-[11px]" style={{ color: MUTED }}>ค่าคอมมิชชั่น ฿</label>
          <input type="number" step="1" min="0" value={commissionBaht} onChange={e => setCommissionBaht(e.target.value)}
            className="w-full px-2 py-1 text-sm rounded-lg border text-right" style={{ borderColor: BORDER, color: TEXT }} />
        </div>
        <div>
          <label className="text-[11px]" style={{ color: MUTED }}>OT ฿</label>
          <input type="number" step="1" min="0" value={otBaht} onChange={e => setOtBaht(e.target.value)}
            className="w-full px-2 py-1 text-sm rounded-lg border text-right" style={{ borderColor: BORDER, color: TEXT }} />
        </div>
        <div>
          <label className="text-[11px]" style={{ color: MUTED }}>ทิป ฿</label>
          <input type="number" step="1" min="0" value={tipBaht} onChange={e => setTipBaht(e.target.value)}
            className="w-full px-2 py-1 text-sm rounded-lg border text-right" style={{ borderColor: BORDER, color: TEXT }} />
        </div>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <select value={category} onChange={e => setCategory(e.target.value as "commission_bonus" | "salary")}
          className="text-xs px-2 py-1.5 rounded-lg border bg-white" style={{ borderColor: BORDER, color: TEXT }}>
          <option value="commission_bonus">หมวด: ค่าคอม/OT/ทิป</option>
          <option value="salary">หมวด: เงินเดือน/ค่าแรง</option>
        </select>
        <p className="text-xs" style={{ color: MUTED }}>รวม <span className="font-bold" style={{ color: PRIMARY }}>{baht(Math.round(total * 100))}</span></p>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="ml-auto flex gap-2">
          <button onClick={onClose} disabled={saving}
            className="text-xs px-3 py-1.5 rounded-lg inline-flex items-center gap-1" style={{ border: `1px solid ${BORDER}`, color: MUTED }}>
            <X size={12} /> ยกเลิก
          </button>
          <button onClick={confirm} disabled={saving || total <= 0}
            className="text-xs px-3 py-1.5 rounded-lg text-white inline-flex items-center gap-1 disabled:opacity-40" style={{ background: PRIMARY }}>
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Receipt size={12} />} ยืนยันบันทึก
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Monthly rollup tab: commission+OT already paid this month → record as an Expense ──
interface MonthlyRow {
  staffId: string; name: string; daysPaid: number;
  commissionSatang: number; otSatang: number; totalSatang: number;
  recordedExpenseId: string | null;
}

function thisMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function MonthlyTab({ branches, activeBranchId }: { branches: Branch[]; activeBranchId: string }) {
  const [branchId, setBranchId] = useState(activeBranchId || branches[0]?.id || "");
  const [month, setMonth] = useState(thisMonthStr());
  const [rows, setRows] = useState<MonthlyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/payroll/monthly?branchId=${branchId}&month=${month}`);
      const data = await res.json();
      if (res.ok) setRows(data.rows ?? []);
    } finally {
      setLoading(false);
    }
  }, [branchId, month]);

  // setTimeout, not a direct call — load() eventually setStates, and calling
  // that synchronously in the effect body trips react-hooks/set-state-in-effect.
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t); }, [load]);

  async function record(staffId: string) {
    setBusyId(staffId);
    setError("");
    try {
      const res = await fetch("/api/admin/payroll/monthly", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId, branchId, month }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "บันทึกไม่สำเร็จ"); return; }
      await load();
    } finally {
      setBusyId(null);
    }
  }

  const grand = rows.reduce((s, r) => s + r.totalSatang, 0);

  return (
    <>
      {/* branch + month controls */}
      <div className="flex items-center gap-3 flex-wrap mb-4">
        <div className="flex gap-2">
          {branches.map(b => (
            <button key={b.id} onClick={() => setBranchId(b.id)}
              className="text-sm px-3 py-1.5 rounded-lg border"
              style={branchId === b.id ? { background: "#F0E4D8", borderColor: PRIMARY, color: PRIMARY, fontWeight: 600 } : { background: "white", borderColor: BORDER, color: "#6B5245" }}>
              {branchShort(b)}
            </button>
          ))}
        </div>
        <input type="month" value={month} max={thisMonthStr()}
          onChange={e => setMonth(e.target.value)}
          className="px-3 py-1.5 text-sm rounded-lg border bg-white" style={{ borderColor: BORDER, color: TEXT }} />
      </div>

      <p className="text-[11px] mb-4" style={{ color: MUTED }}>
        สรุปเฉพาะค่าคอมมิชชั่น + OT ที่กด &ldquo;จ่ายเงิน&rdquo; แล้วในแท็บรายวัน (ไม่รวมเงินเดือน/ค่าแรงฐาน ซึ่งจ่ายแยกตามรอบของตัวเอง)
        การบันทึกเป็นรายจ่ายทำได้ครั้งเดียวต่อคนต่อเดือน กดซ้ำจะไม่สร้างรายการซ้ำ
      </p>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      {loading ? (
        <div className="rounded-2xl bg-white p-10 text-center" style={{ border: `1.5px solid ${BORDER}` }}>
          <Loader2 size={18} className="animate-spin mx-auto" style={{ color: MUTED }} />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl bg-white p-10 text-center" style={{ border: `1.5px solid ${BORDER}` }}>
          <p className="text-sm" style={{ color: MUTED }}>ยังไม่มีการจ่ายเงินที่ยืนยันแล้วในเดือนนี้</p>
        </div>
      ) : (
        <>
          <div className="rounded-xl bg-white p-3 mb-3" style={{ border: `1.5px solid ${PRIMARY}` }}>
            <p className="text-xs" style={{ color: MUTED }}>รวมทั้งหมด ({rows.length} คน)</p>
            <p className="text-lg font-bold" style={{ color: PRIMARY }}>{baht(grand)}</p>
          </div>
          <div className="space-y-2">
            {rows.map(r => (
              <div key={r.staffId} className="rounded-xl bg-white p-3" style={{ border: `1.5px solid ${r.recordedExpenseId ? "#86EFAC" : BORDER}` }}>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex-1 min-w-32">
                    <p className="font-semibold" style={{ color: TEXT }}>{r.name}</p>
                    <p className="text-[11px]" style={{ color: MUTED }}>
                      {r.daysPaid} วันที่จ่ายแล้ว · ค่ามือ {baht(r.commissionSatang)} · OT {baht(r.otSatang)}
                    </p>
                  </div>
                  <div className="text-right w-28">
                    <p className="text-[10px]" style={{ color: MUTED }}>รวม</p>
                    <p className="font-bold" style={{ color: PRIMARY }}>{baht(r.totalSatang)}</p>
                  </div>
                  {r.recordedExpenseId ? (
                    <Link href={`/admin/expenses/${r.recordedExpenseId}`}
                      className="text-xs px-3 py-1.5 rounded-lg inline-flex items-center gap-1" style={{ background: "#DCFCE7", color: "#166534" }}>
                      <Check size={12} /> บันทึกแล้ว
                    </Link>
                  ) : (
                    <button onClick={() => record(r.staffId)} disabled={busyId === r.staffId}
                      className="text-xs px-3 py-1.5 rounded-lg text-white inline-flex items-center gap-1 disabled:opacity-50" style={{ background: PRIMARY }}>
                      {busyId === r.staffId ? <Loader2 size={12} className="animate-spin" /> : <Receipt size={12} />} บันทึกเป็นรายจ่าย
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

// ─── Settings tab: staff base pay + per-service commission ─────────────────────
function SettingsTab({ branches, staffConfig, services, addons }: { branches: Branch[]; staffConfig: StaffCfg[]; services: ServiceCfg[]; addons: AddonCfg[] }) {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-sm font-semibold mb-1" style={{ color: TEXT }}>ฐานเงินเดือน / ค่าแรง + เรต OT</h2>
        <p className="text-[11px] mb-3" style={{ color: MUTED }}>
          OT/ชม. คำนวณอัตโนมัติ: เงินเดือน ÷ (30×8) หรือ ค่าแรงรายวัน ÷ 8 (กรอกเรตเองได้ถ้าต้องการ)
        </p>
        <div className="space-y-4">
          {branches.map(b => {
            const list = staffConfig.filter(s => s.branchId === b.id);
            if (list.length === 0) return null;
            return (
              <div key={b.id}>
                <p className="text-xs font-medium mb-1" style={{ color: PRIMARY }}>{branchShort(b)}</p>
                <div className="space-y-2">
                  {list.map(s => <StaffPayRow key={s.id} staff={s} />)}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold mb-1" style={{ color: TEXT }}>ค่ามือต่อบริการ (commission)</h2>
        <p className="text-[11px] mb-3" style={{ color: MUTED }}>
          จำนวนเงิน (บาท) ที่ช่างได้ต่อ 1 ครั้งที่ทำบริการนี้ — ไม่ขึ้นกับส่วนลดสมาชิก/แพ็กเกจ
        </p>
        <div className="space-y-2">
          {services.map(s => <ServiceCommissionRow key={s.id} service={s} />)}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold mb-1" style={{ color: TEXT }}>ค่ามือต่อบริการเสริม (add-on)</h2>
        <p className="text-[11px] mb-3" style={{ color: MUTED }}>
          จำนวนเงิน (บาท) ที่ช่างได้เพิ่ม เมื่อบริการเสริมนี้อยู่ในงานที่เสร็จ
        </p>
        {addons.length === 0
          ? <p className="text-xs" style={{ color: MUTED }}>— ยังไม่มีบริการเสริม —</p>
          : <div className="space-y-2">{addons.map(a => <AddonCommissionRow key={a.id} addon={a} />)}</div>}
      </section>
    </div>
  );
}

function StaffPayRow({ staff }: { staff: StaffCfg }) {
  const router = useRouter();
  const [payType, setPayType] = useState<PayType>(staff.payType);
  const [baseBaht, setBaseBaht] = useState(String(staff.baseSatang / 100));
  const [cadence, setCadence] = useState<Cadence>(staff.payCadence);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const baseSatang = Math.round((parseFloat(baseBaht) || 0) * 100);
  const otRate = staff.otRateSatang != null
    ? staff.otRateSatang
    : (baseSatang <= 0 ? 0 : baseSatang / (payType === "DAILY_WAGE" ? 8 : 240));
  const dirty = payType !== staff.payType || baseSatang !== staff.baseSatang || cadence !== staff.payCadence;

  async function save() {
    setSaving(true); setSaved(false);
    try {
      const res = await fetch(`/api/admin/staff/${staff.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payType, baseSatang, payCadence: cadence }),
      });
      if (res.ok) { setSaved(true); router.refresh(); setTimeout(() => setSaved(false), 1500); }
    } finally { setSaving(false); }
  }

  return (
    <div className="rounded-xl bg-white p-3 flex items-center gap-2 flex-wrap" style={{ border: `1px solid ${BORDER}` }}>
      <p className="font-medium w-28 flex-shrink-0" style={{ color: TEXT }}>{staff.name}</p>
      <select value={payType} onChange={e => setPayType(e.target.value as PayType)}
        className="text-sm px-2 py-1.5 rounded-lg border bg-white" style={{ borderColor: BORDER, color: TEXT }}>
        <option value="MONTHLY_SALARY">เงินเดือน</option>
        <option value="DAILY_WAGE">รายวัน</option>
      </select>
      <div className="flex items-center gap-1">
        <span className="text-xs" style={{ color: MUTED }}>฿</span>
        <input type="number" min="0" value={baseBaht} onChange={e => setBaseBaht(e.target.value)}
          className="w-24 px-2 py-1.5 text-sm rounded-lg border text-right" style={{ borderColor: BORDER, color: TEXT }} />
        <span className="text-[11px]" style={{ color: MUTED }}>{payType === "DAILY_WAGE" ? "/วัน" : "/เดือน"}</span>
      </div>
      <select value={cadence} onChange={e => setCadence(e.target.value as Cadence)}
        className="text-sm px-2 py-1.5 rounded-lg border bg-white" style={{ borderColor: BORDER, color: TEXT }}>
        <option value="MONTHLY">จ่ายรายเดือน</option>
        <option value="WEEKLY">จ่ายรายสัปดาห์</option>
      </select>
      <span className="text-[11px]" style={{ color: MUTED }}>OT {baht(otRate)}/ชม.</span>
      <button onClick={save} disabled={!dirty || saving}
        className="ml-auto text-xs px-3 py-1.5 rounded-lg text-white inline-flex items-center gap-1 disabled:opacity-40" style={{ background: PRIMARY }}>
        {saving ? <Loader2 size={12} className="animate-spin" /> : saved ? <Check size={12} /> : null}
        {saved ? "บันทึกแล้ว" : "บันทึก"}
      </button>
    </div>
  );
}

function ServiceCommissionRow({ service }: { service: ServiceCfg }) {
  const router = useRouter();
  const [val, setVal] = useState(String(service.commissionSatang / 100));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const satang = Math.round((parseFloat(val) || 0) * 100);
  const dirty = satang !== service.commissionSatang;

  async function save() {
    setSaving(true); setSaved(false);
    try {
      const res = await fetch(`/api/admin/services/${service.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commissionBaht: parseFloat(val) || 0 }),
      });
      if (res.ok) { setSaved(true); router.refresh(); setTimeout(() => setSaved(false), 1500); }
    } finally { setSaving(false); }
  }

  return (
    <div className="rounded-xl bg-white p-2.5 flex items-center gap-2" style={{ border: `1px solid ${BORDER}` }}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: TEXT }}>{service.nameTh}</p>
        <p className="text-[10px]" style={{ color: MUTED }}>{service.category}</p>
      </div>
      <span className="text-xs" style={{ color: MUTED }}>฿</span>
      <input type="number" min="0" value={val} onChange={e => setVal(e.target.value)}
        onBlur={() => { if (dirty) save(); }}
        className="w-20 px-2 py-1.5 text-sm rounded-lg border text-right" style={{ borderColor: BORDER, color: TEXT }} />
      <button onClick={save} disabled={!dirty || saving}
        className="text-xs px-3 py-1.5 rounded-lg inline-flex items-center gap-1 disabled:opacity-30"
        style={{ border: `1px solid ${BORDER}`, color: saved ? "#166534" : PRIMARY }}>
        {saving ? <Loader2 size={12} className="animate-spin" /> : saved ? <Check size={12} /> : "บันทึก"}
      </button>
    </div>
  );
}

function AddonCommissionRow({ addon }: { addon: AddonCfg }) {
  const router = useRouter();
  const [val, setVal] = useState(String(addon.commissionSatang / 100));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const satang = Math.round((parseFloat(val) || 0) * 100);
  const dirty = satang !== addon.commissionSatang;

  async function save() {
    setSaving(true); setSaved(false);
    try {
      const res = await fetch(`/api/admin/addons/${addon.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commissionBaht: parseFloat(val) || 0 }),
      });
      if (res.ok) { setSaved(true); router.refresh(); setTimeout(() => setSaved(false), 1500); }
    } finally { setSaving(false); }
  }

  return (
    <div className="rounded-xl bg-white p-2.5 flex items-center gap-2" style={{ border: `1px solid ${BORDER}` }}>
      <p className="text-sm font-medium truncate flex-1 min-w-0" style={{ color: TEXT }}>{addon.nameTh}</p>
      <span className="text-xs" style={{ color: MUTED }}>฿</span>
      <input type="number" min="0" value={val} onChange={e => setVal(e.target.value)}
        onBlur={() => { if (dirty) save(); }}
        className="w-20 px-2 py-1.5 text-sm rounded-lg border text-right" style={{ borderColor: BORDER, color: TEXT }} />
      <button onClick={save} disabled={!dirty || saving}
        className="text-xs px-3 py-1.5 rounded-lg inline-flex items-center gap-1 disabled:opacity-30"
        style={{ border: `1px solid ${BORDER}`, color: saved ? "#166534" : PRIMARY }}>
        {saving ? <Loader2 size={12} className="animate-spin" /> : saved ? <Check size={12} /> : "บันทึก"}
      </button>
    </div>
  );
}
