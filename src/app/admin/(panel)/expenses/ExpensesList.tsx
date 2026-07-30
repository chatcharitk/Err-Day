"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Receipt, ImageIcon } from "lucide-react";
import { EXPENSE_CATEGORIES, PAYMENT_METHODS } from "@/lib/expenses";
import ExpenseQuickMenu from "@/components/ExpenseQuickMenu";

const PRIMARY = "#8B1D24";
const TEXT    = "#3B2A24";
const MUTED   = "#A08070";
const BORDER  = "#E8D8CC";

interface ExpenseRow {
  id:            string;
  branchId:      string | null;
  branchName:    string | null;
  category:      string;
  vendor:        string | null;
  date:          string;
  totalAmount:   number;
  vatAmount:     number | null;
  paymentMethod: string | null;
  receiptUrl:    string | null;
  notes:         string | null;
  status:        string;
}
interface Branch { id: string; name: string }
interface Props {
  expenses: ExpenseRow[];
  branches: Branch[];
  filters:  { branchId: string; category: string; from: string; to: string };
  summary:  { totalAmount: number; count: number };
  categoryTotals: Record<string, number>;
}

const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  EXPENSE_CATEGORIES.map(c => [c.value, c.label]),
);
const PAYMENT_LABEL: Record<string, string> = Object.fromEntries(
  PAYMENT_METHODS.map(p => [p.value, p.label]),
);

function fmt(satang: number) {
  return `฿${(satang / 100).toLocaleString("th-TH")}`;
}

function localYmd(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default function ExpensesList({ expenses, branches, filters, summary, categoryTotals }: Props) {
  const router = useRouter();

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams();
    const next = { ...filters, [key]: value };
    if (next.branchId && next.branchId !== "all") params.set("branchId", next.branchId);
    if (next.category && next.category !== "all") params.set("category", next.category);
    if (next.from) params.set("from", next.from);
    if (next.to)   params.set("to",   next.to);
    router.push(`/admin/expenses?${params.toString()}`);
  }

  function applyPreset(preset: "month" | "lastMonth" | "year") {
    const now = new Date();
    let from: Date;
    let to = now;
    if (preset === "lastMonth") {
      from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      to = new Date(now.getFullYear(), now.getMonth(), 0);
    } else if (preset === "year") {
      from = new Date(now.getFullYear(), 0, 1);
    } else {
      from = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    const params = new URLSearchParams();
    if (filters.branchId !== "all") params.set("branchId", filters.branchId);
    if (filters.category !== "all") params.set("category", filters.category);
    params.set("from", localYmd(from));
    params.set("to", localYmd(to));
    router.push(`/admin/expenses?${params.toString()}`);
  }

  return (
    <div className="max-w-6xl px-8 py-8">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-end justify-between gap-4 mb-6 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: MUTED }}>Expense Tracking</p>
          <h1 className="text-2xl font-medium" style={{ color: TEXT }}>บันทึกและตรวจสอบรายจ่าย</h1>
        </div>
        <Link href="/admin/expenses/new"
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: PRIMARY }}>
          <Plus size={16} />
          เพิ่มรายจ่าย
        </Link>
      </div>

      <div className="mb-6 rounded-2xl p-5" style={{ background: "#FDF8F3", border: `1.5px solid ${BORDER}` }}>
        <ExpenseQuickMenu basePath="/admin/expenses/new" totals={categoryTotals} />
      </div>

      {/* ── Summary ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="rounded-2xl bg-white p-5" style={{ border: `1.5px solid ${BORDER}` }}>
          <p className="text-xs mb-2" style={{ color: MUTED }}>รวมในช่วงที่เลือก</p>
          <p className="text-2xl font-bold" style={{ color: PRIMARY }}>{fmt(summary.totalAmount)}</p>
        </div>
        <div className="rounded-2xl bg-white p-5" style={{ border: `1.5px solid ${BORDER}` }}>
          <p className="text-xs mb-2" style={{ color: MUTED }}>จำนวนรายการ</p>
          <p className="text-2xl font-bold" style={{ color: TEXT }}>{summary.count}</p>
        </div>
      </div>

      {/* ── Filters ───────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl p-4 mb-4 flex flex-wrap items-end gap-3"
        style={{ border: `1.5px solid ${BORDER}` }}>
        <div>
          <label className="text-[10px] uppercase tracking-widest block mb-1" style={{ color: MUTED }}>สาขา</label>
          <select value={filters.branchId} onChange={e => updateFilter("branchId", e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm" style={{ borderColor: BORDER, color: TEXT }}>
            <option value="all">ทุกสาขา</option>
            <option value="shared">ส่วนกลาง / HQ</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-widest block mb-1" style={{ color: MUTED }}>หมวด</label>
          <select value={filters.category} onChange={e => updateFilter("category", e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm" style={{ borderColor: BORDER, color: TEXT }}>
            <option value="all">ทั้งหมด</option>
            {EXPENSE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-widest block mb-1" style={{ color: MUTED }}>ตั้งแต่</label>
          <input type="date" value={filters.from} onChange={e => updateFilter("from", e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm" style={{ borderColor: BORDER, color: TEXT }} />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-widest block mb-1" style={{ color: MUTED }}>ถึง</label>
          <input type="date" value={filters.to} onChange={e => updateFilter("to", e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm" style={{ borderColor: BORDER, color: TEXT }} />
        </div>
        <div className="flex items-center gap-1.5 pb-0.5">
          <button type="button" onClick={() => applyPreset("month")}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium" style={{ color: PRIMARY, background: "#FFF8F4" }}>
            เดือนนี้
          </button>
          <button type="button" onClick={() => applyPreset("lastMonth")}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium" style={{ color: TEXT, background: "#F7F3F0" }}>
            เดือนก่อน
          </button>
          <button type="button" onClick={() => applyPreset("year")}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium" style={{ color: TEXT, background: "#F7F3F0" }}>
            ปีนี้
          </button>
        </div>
      </div>

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl overflow-hidden" style={{ border: `1.5px solid ${BORDER}` }}>
        {expenses.length === 0 ? (
          <div className="text-center py-16">
            <Receipt size={32} className="mx-auto mb-3 opacity-40" style={{ color: MUTED }} />
            <p className="text-sm" style={{ color: MUTED }}>ไม่มีรายจ่ายในช่วงนี้</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead style={{ background: "#FAFAFA", color: MUTED }}>
              <tr className="text-left text-[10px] uppercase tracking-widest">
                <th className="px-4 py-3 font-medium">วันที่</th>
                <th className="px-4 py-3 font-medium">หมวด</th>
                <th className="px-4 py-3 font-medium">ผู้ขาย</th>
                <th className="px-4 py-3 font-medium">สาขา</th>
                <th className="px-4 py-3 font-medium">วิธีจ่าย</th>
                <th className="px-4 py-3 font-medium text-right">จำนวนเงิน</th>
                <th className="px-4 py-3 font-medium text-center">ใบเสร็จ</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map(e => (
                <tr key={e.id}
                  onClick={() => router.push(`/admin/expenses/${e.id}`)}
                  className="border-t cursor-pointer hover:bg-stone-50 transition-colors"
                  style={{ borderColor: BORDER, color: TEXT }}>
                  <td className="px-4 py-3 whitespace-nowrap">{e.date}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{CATEGORY_LABEL[e.category] ?? e.category}</td>
                  <td className="px-4 py-3">{e.vendor || <span style={{ color: MUTED }}>—</span>}</td>
                  <td className="px-4 py-3">{e.branchName || <span style={{ color: MUTED }}>ส่วนกลาง</span>}</td>
                  <td className="px-4 py-3">{e.paymentMethod ? (PAYMENT_LABEL[e.paymentMethod] ?? e.paymentMethod) : <span style={{ color: MUTED }}>—</span>}</td>
                  <td className="px-4 py-3 text-right font-semibold">{fmt(e.totalAmount)}</td>
                  <td className="px-4 py-3 text-center">
                    {e.receiptUrl
                      ? <ImageIcon size={16} className="inline" style={{ color: PRIMARY }} />
                      : <span style={{ color: MUTED }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
