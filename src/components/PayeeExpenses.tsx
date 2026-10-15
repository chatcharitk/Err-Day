"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Paperclip } from "lucide-react";
import { EXPENSE_CATEGORIES, PAYMENT_METHODS } from "@/lib/expenses";
import css from "./Finance.module.css";

interface Row {
  id: string; date: string; category: string; totalAmount: number; vatAmount: number | null; withholdingAmount: number;
  paymentMethod: string | null; invoiceNumber: string | null; notes: string | null; vendorText: string | null;
  branch: string | null; items: string[]; attachments: number;
}
interface Data {
  total: number; count: number;
  byMonth: { month: string; count: number; total: number }[];
  byCategory: { category: string; count: number; total: number }[];
  expenses: Row[];
}

const CAT = Object.fromEntries(EXPENSE_CATEGORIES.map(c => [c.value, c.label]));
const PAY = Object.fromEntries(PAYMENT_METHODS.map(p => [p.value, p.label]));
const money = (s: number) => `฿${(s / 100).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const monthTh = (m: string) => new Date(m + "-15T00:00:00Z").toLocaleDateString("th-TH", { month: "short", year: "numeric", timeZone: "UTC" });
const dayTh = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit", timeZone: "UTC" });

/** Everything paid to one payee — totals by month / category and the full list. */
export default function PayeeExpenses({ vendorId }: { vendorId: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    fetch(`/api/admin/vendors/${vendorId}/expenses`)
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "โหลดไม่สำเร็จ"); return d; })
      .then(d => { if (alive) setData(d); })
      .catch(e => { if (alive) setError(e instanceof Error ? e.message : "โหลดไม่สำเร็จ"); });
    return () => { alive = false; };
  }, [vendorId]);

  if (error) return <p className={css.error}>{error}</p>;
  if (!data) return <p className={css.muted}>กำลังโหลดรายจ่าย…</p>;
  if (data.count === 0) return <p className={css.muted}>ยังไม่มีรายจ่ายที่ผูกกับผู้รับเงินนี้</p>;

  return (
    <div>
      <div className={css.fields} style={{ marginBottom: 12 }}>
        <div><p className={css.muted} style={{ margin: 0 }}>ยอดจ่ายรวม</p><p style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>{money(data.total)}</p></div>
        <div><p className={css.muted} style={{ margin: 0 }}>จำนวนรายการ</p><p style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>{data.count}</p></div>
        <div><p className={css.muted} style={{ margin: 0 }}>ล่าสุด</p><p style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{dayTh(data.expenses[0].date)}</p></div>
      </div>

      <div className={css.fields} style={{ alignItems: "start" }}>
        <div className={css.tableWrap}>
          <table className={css.table}>
            <thead><tr><th>เดือน</th><th>รายการ</th><th style={{ textAlign: "right" }}>ยอด</th></tr></thead>
            <tbody>{data.byMonth.map(m => (
              <tr key={m.month}><td>{monthTh(m.month)}</td><td>{m.count}</td><td style={{ textAlign: "right" }}>{money(m.total)}</td></tr>
            ))}</tbody>
          </table>
        </div>
        <div className={css.tableWrap}>
          <table className={css.table}>
            <thead><tr><th>หมวด</th><th>รายการ</th><th style={{ textAlign: "right" }}>ยอด</th></tr></thead>
            <tbody>{data.byCategory.map(c => (
              <tr key={c.category}><td>{CAT[c.category] ?? c.category}</td><td>{c.count}</td><td style={{ textAlign: "right" }}>{money(c.total)}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </div>

      <div className={css.tableWrap} style={{ marginTop: 12 }}>
        <table className={css.table}>
          <thead><tr><th>วันที่</th><th>หมวด / รายละเอียด</th><th>สาขา</th><th>ชำระ</th><th style={{ textAlign: "right" }}>ยอด</th><th /></tr></thead>
          <tbody>{data.expenses.map(e => (
            <tr key={e.id}>
              <td style={{ whiteSpace: "nowrap" }}><Link href={`/admin/expenses/${e.id}`}>{dayTh(e.date)}</Link></td>
              <td>
                {CAT[e.category] ?? e.category}
                {(e.items.length > 0 || e.notes || e.invoiceNumber) && (
                  <p className={css.muted} style={{ margin: "2px 0 0" }}>
                    {[e.invoiceNumber ? `เลขที่ ${e.invoiceNumber}` : "", e.items.join(", "), e.notes ?? ""].filter(Boolean).join(" · ")}
                  </p>
                )}
              </td>
              <td>{e.branch?.replace("err.day ", "") ?? "ส่วนกลาง"}</td>
              <td>{e.paymentMethod ? PAY[e.paymentMethod] ?? e.paymentMethod : "—"}</td>
              <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{money(e.totalAmount)}</td>
              <td>{e.attachments > 0 && <span title="มีเอกสารแนบ" style={{ display: "inline-flex", alignItems: "center", gap: 2 }}><Paperclip size={13} />{e.attachments}</span>}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
