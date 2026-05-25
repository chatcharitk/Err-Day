"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Receipt, Filter, X, ImageIcon } from "lucide-react";
import { EXPENSE_CATEGORIES, PAYMENT_METHODS } from "@/lib/expenses";

const PRIMARY = "#8B1D24";
const TEXT    = "#3B2A24";
const MUTED   = "#A08070";
const BORDER  = "#E8D8CC";
const BG      = "#FDF8F3";

interface ExpenseRow {
  id:            string;
  branchName:    string | null;
  category:      string;
  vendor:        string | null;
  date:          string;
  totalAmount:   number;
  paymentMethod: string | null;
  hasReceipt:    boolean;
}
interface Branch { id: string; name: string }
interface Props {
  expenses: ExpenseRow[];
  branches: Branch[];
  filters:  { branchId: string; category: string; from: string; to: string };
  summary:  { totalAmount: number; count: number };
}

const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  EXPENSE_CATEGORIES.map(c => [c.value, c.label]),
);
const PAYMENT_LABEL: Record<string, string> = Object.fromEntries(
  PAYMENT_METHODS.map(p => [p.value, p.label]),
);

function fmt(satang: number) { return `฿${(satang / 100).toLocaleString("th-TH")}`; }

/** Group expenses by date string for the list display. */
function groupByDate(rows: ExpenseRow[]): { date: string; rows: ExpenseRow[]; total: number }[] {
  const groups = new Map<string, { rows: ExpenseRow[]; total: number }>();
  for (const r of rows) {
    if (!groups.has(r.date)) groups.set(r.date, { rows: [], total: 0 });
    const g = groups.get(r.date)!;
    g.rows.push(r);
    g.total += r.totalAmount;
  }
  return Array.from(groups.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, g]) => ({ date, ...g }));
}

export default function MobileExpensesList({ expenses, branches, filters, summary }: Props) {
  const router = useRouter();
  const [showFilters, setShowFilters] = useState(false);

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams();
    const next = { ...filters, [key]: value };
    if (next.branchId && next.branchId !== "all") params.set("branchId", next.branchId);
    if (next.category && next.category !== "all") params.set("category", next.category);
    if (next.from) params.set("from", next.from);
    if (next.to)   params.set("to",   next.to);
    router.push(`/admin/m/expenses?${params.toString()}`);
  }

  const grouped = groupByDate(expenses);

  return (
    <main className="min-h-screen pb-24" style={{ background: BG }}>
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <div className="px-4 py-3 flex items-center gap-3">
          <Link href="/admin/m" className="w-9 h-9 flex items-center justify-center rounded-full" style={{ color: TEXT }}>
            <ArrowLeft size={20} />
          </Link>
          <div className="flex-1">
            <p className="text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>Expense Tracking</p>
            <h1 className="text-base font-semibold leading-tight" style={{ color: TEXT }}>รายจ่าย</h1>
          </div>
          <button onClick={() => setShowFilters(v => !v)}
            className="w-9 h-9 flex items-center justify-center rounded-full"
            style={{ color: showFilters ? PRIMARY : TEXT, background: showFilters ? "#FFF8F4" : "transparent" }}>
            <Filter size={18} />
          </button>
        </div>

        {/* Inline filter sheet */}
        {showFilters && (
          <div className="px-4 pb-3 space-y-2.5 border-t pt-3" style={{ borderColor: BORDER }}>
            <div>
              <label className="text-[10px] uppercase tracking-widest block mb-1" style={{ color: MUTED }}>สาขา</label>
              <select value={filters.branchId} onChange={e => updateFilter("branchId", e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm" style={{ borderColor: BORDER, color: TEXT }}>
                <option value="all">ทุกสาขา</option>
                <option value="shared">ส่วนกลาง / HQ</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest block mb-1" style={{ color: MUTED }}>หมวด</label>
              <select value={filters.category} onChange={e => updateFilter("category", e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm" style={{ borderColor: BORDER, color: TEXT }}>
                <option value="all">ทั้งหมด</option>
                {EXPENSE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] uppercase tracking-widest block mb-1" style={{ color: MUTED }}>ตั้งแต่</label>
                <input type="date" value={filters.from} onChange={e => updateFilter("from", e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm" style={{ borderColor: BORDER, color: TEXT }} />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest block mb-1" style={{ color: MUTED }}>ถึง</label>
                <input type="date" value={filters.to} onChange={e => updateFilter("to", e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm" style={{ borderColor: BORDER, color: TEXT }} />
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Summary */}
      <section className="px-4 pt-4 pb-2">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white p-4" style={{ border: `1px solid ${BORDER}` }}>
            <p className="text-[11px] mb-1.5" style={{ color: MUTED }}>รวม</p>
            <p className="text-lg font-bold leading-tight" style={{ color: PRIMARY }}>{fmt(summary.totalAmount)}</p>
          </div>
          <div className="rounded-2xl bg-white p-4" style={{ border: `1px solid ${BORDER}` }}>
            <p className="text-[11px] mb-1.5" style={{ color: MUTED }}>จำนวนรายการ</p>
            <p className="text-lg font-bold leading-tight" style={{ color: TEXT }}>{summary.count}</p>
          </div>
        </div>
      </section>

      {/* List */}
      <section className="px-4 pt-2 space-y-4">
        {expenses.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center" style={{ border: `1px solid ${BORDER}` }}>
            <Receipt size={28} className="mx-auto mb-2 opacity-40" style={{ color: MUTED }} />
            <p className="text-sm" style={{ color: MUTED }}>ไม่มีรายจ่ายในช่วงนี้</p>
          </div>
        ) : (
          grouped.map(g => (
            <div key={g.date}>
              <div className="flex items-center justify-between px-1 mb-2">
                <h2 className="text-sm font-semibold" style={{ color: TEXT }}>{g.date}</h2>
                <span className="text-xs font-semibold" style={{ color: PRIMARY }}>{fmt(g.total)}</span>
              </div>
              <ul className="space-y-2">
                {g.rows.map(e => (
                  <li key={e.id}>
                    <Link href={`/admin/m/expenses/${e.id}`} prefetch
                      className="block bg-white rounded-xl px-3 py-3 active:scale-[0.99] transition-transform"
                      style={{ border: `1px solid ${BORDER}` }}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-semibold truncate" style={{ color: TEXT }}>
                              {CATEGORY_LABEL[e.category] ?? e.category}
                            </p>
                            {e.hasReceipt && (
                              <ImageIcon size={11} style={{ color: PRIMARY }} />
                            )}
                          </div>
                          <p className="text-xs truncate" style={{ color: MUTED }}>
                            {e.vendor ? e.vendor : <em>ไม่ระบุผู้ขาย</em>}
                            {e.branchName && <span> · {e.branchName}</span>}
                            {!e.branchName && <span> · ส่วนกลาง</span>}
                          </p>
                          {e.paymentMethod && (
                            <p className="text-[10px] mt-0.5" style={{ color: MUTED }}>
                              {PAYMENT_LABEL[e.paymentMethod] ?? e.paymentMethod}
                            </p>
                          )}
                        </div>
                        <p className="text-base font-bold flex-shrink-0" style={{ color: PRIMARY }}>
                          {fmt(e.totalAmount)}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>

      {/* FAB — add expense */}
      <Link href="/admin/m/expenses/new" prefetch
        aria-label="เพิ่มรายจ่าย"
        className="fixed bottom-6 z-30 rounded-full shadow-lg flex items-center justify-center text-white"
        style={{
          background: PRIMARY,
          width: 56, height: 56,
          right: "max(1.5rem, calc((100vw - 28rem)/2 + 1.5rem))",
        }}>
        <Plus size={26} />
      </Link>
    </main>
  );
}
