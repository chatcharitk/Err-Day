import type { StaffPayoutRow } from "@/lib/payroll";

/**
 * Short end-of-day message for whoever pays the staff: per person, the
 * commission, the OT window and the tip — one line each, ready to paste in LINE.
 * Pure (no Prisma) so the payroll screen can build it in the browser.
 */

const baht = (satang: number) => {
  const n = satang / 100;
  return `฿${n.toLocaleString("th-TH", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`;
};
// "17.00" not "17:00" — LINE turns 17:00 into a blue calendar link.
const hhmm = (ms: number) => new Date(ms + 7 * 3600_000).toISOString().slice(11, 16).replace(":", ".");
const hoursLabel = (h: number) => `${Number.isInteger(h) ? h : h.toFixed(1)} ชม.`;

/** "19.00 ถึง 21.00 น. (2 ชม.)": OT starts once normal hours (+ break) are done and runs to clock-out. */
function otLabel(r: StaffPayoutRow): string {
  if (r.otHours <= 0) return "";
  if (r.clockIn && r.clockOut) {
    const start = new Date(r.clockIn).getTime() + (r.normalWorkMinutes + r.breakMinutes) * 60_000;
    const end = new Date(r.clockOut).getTime();
    if (start < end) return `${hhmm(start)} ถึง ${hhmm(end)} น. (${hoursLabel(r.otHours)})`;
  }
  return hoursLabel(r.otHours);
}

export function thaiDay(ymd: string): string {
  return new Date(ymd + "T12:00:00Z").toLocaleDateString("th-TH", {
    timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "numeric",
  });
}

export function buildDailySummary(branchName: string, ymd: string, rows: StaffPayoutRow[]): string {
  const blocks: string[] = [];
  let sum = 0;
  for (const r of rows) {
    const tip = r.bookingTipSatang + r.tipSatang;
    const total = r.commissionSatang + r.otSatang + tip + r.travelSatang + r.adjustmentSatang;
    if (total <= 0 && r.otHours <= 0) continue; // nothing to pay on top of base
    sum += total;
    const lines = [
      `👤 ${r.name}`,
      `คอม: ${r.commissionSatang > 0 ? baht(r.commissionSatang) : "-"}`,
      `OT: ${r.otHours > 0 ? `${otLabel(r)}${r.otSatang > 0 ? ` ${baht(r.otSatang)}` : ""}` : "-"}`,
      `ทิป: ${tip > 0 ? baht(tip) : "-"}`,
    ];
    if (r.travelSatang > 0) lines.push(`เดินทาง: ${baht(r.travelSatang)}`);
    if (r.adjustmentSatang !== 0) lines.push(`ปรับ: ${baht(r.adjustmentSatang)}${r.adjustmentReason ? ` (${r.adjustmentReason})` : ""}`);
    lines.push(`รวม ${baht(total)}`);
    blocks.push(lines.join("\n"));
  }
  const head = `📋 สรุปค่าตอบแทน ${thaiDay(ymd)}\n📍 ${branchName}`;
  if (blocks.length === 0) return `${head}\n\nวันนี้ไม่มียอดค่าคอม / OT / ทิป`;
  return `${head}\n\n${blocks.join("\n\n")}\n\n━━━━━━━━━━\nรวมที่ต้องจ่าย ${baht(sum)}`;
}
