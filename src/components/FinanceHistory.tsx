"use client";
import { useState } from "react";
import css from "./Finance.module.css";
type Entry = {
  id: string;
  action: string;
  actor: string;
  createdAt: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
};
const actions: Record<string, string> = {
  CREATE: "สร้างรายการ",
  UPDATE: "แก้ไข",
  SAVE: "บันทึกการตรวจ",
  SETTLE: "ยืนยันจ่าย",
  REOPEN: "เปิดแก้",
  VOID: "ยกเลิกฉบับเดิม",
};
function amount(s: Entry["before"]): number | null {
  if (!s) return null;
  if (typeof s.totalSatang === "number") return s.totalSatang;
  if (typeof s.totalAmount === "number") return s.totalAmount;
  if (typeof s.commissionSatang === "number")
    return (
      s.commissionSatang +
      Number(s.otSatang || 0) +
      Number(s.tipSatang || 0) +
      Number(s.adjustmentSatang || 0)
    );
  return null;
}
const money = (n: number | null) =>
  n == null
    ? "—"
    : `฿${(n / 100).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export default function FinanceHistory({ query }: { query: string }) {
  const [rows, setRows] = useState<Entry[] | null>(null),
    [error, setError] = useState("");
  async function load() {
    try {
      const r = await fetch(`/api/admin/finance/history?${query}`);
      if (!r.ok) throw new Error("ดูประวัติได้เฉพาะเจ้าของ");
      setRows((await r.json()).rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดไม่สำเร็จ");
    }
  }
  return (
    <details
      onToggle={(e) => {
        if (e.currentTarget.open) void load();
      }}
    >
      <summary>ประวัติการแก้ไขล่าสุด 100 รายการ (เจ้าของ)</summary>
      {error && <p className={css.error}>{error}</p>}
      {rows?.length === 0 && (
        <p className={css.muted}>ยังไม่มีประวัติในระบบใหม่</p>
      )}
      {rows && rows.length > 0 && (
        <div className={css.tableWrap}>
          <table className={css.table}>
            <thead>
              <tr>
                <th>เวลา / ผู้ทำรายการ</th>
                <th>การเปลี่ยนแปลง</th>
                <th>ยอดก่อน → หลัง</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    {new Date(r.createdAt).toLocaleString("th-TH", {
                      timeZone: "Asia/Bangkok",
                    })}
                    <br />
                    {r.actor}
                  </td>
                  <td>
                    {actions[r.action] || r.action}
                    <p className={css.muted}>
                      {String(
                        r.after?.reason || r.after?.adjustmentReason || "",
                      )}
                    </p>
                  </td>
                  <td>
                    {money(amount(r.before))} → {money(amount(r.after))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </details>
  );
}
