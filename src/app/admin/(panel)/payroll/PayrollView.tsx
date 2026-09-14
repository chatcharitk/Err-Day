"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { StaffPayoutRow } from "@/lib/payroll";
import { workMinutes, overtimeMinutes } from "@/lib/finance-math";
import SettingsTab, {
  type StaffCfg,
  type ServiceCfg,
  type AddonCfg,
} from "./PayrollSettings";
import FinanceHistory from "@/components/FinanceHistory";
import css from "@/components/Finance.module.css";

interface Branch {
  id: string;
  name: string;
}
interface Props {
  branches: Branch[];
  activeBranchId: string;
  activeDate: string;
  todayStr: string;
  rows: StaffPayoutRow[];
  staffConfig: StaffCfg[];
  services: ServiceCfg[];
  addons: AddonCfg[];
  basePath?: string;
}
const money = (s: number) =>
  `฿${(s / 100).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const localTime = (s: string | null) =>
  s
    ? new Date(new Date(s).getTime() + 7 * 3600000).toISOString().slice(11, 16)
    : "";
export default function PayrollView(props: Props) {
  const router = useRouter();
  const {
    branches,
    activeBranchId,
    activeDate,
    todayStr,
    rows,
    basePath = "/admin/payroll",
  } = props;
  const [tab, setTab] = useState("daily");
  const [staffId, setStaffId] = useState(rows[0]?.staffId ?? "");
  const selected = rows.find((r) => r.staffId === staffId) ?? rows[0];
  // Mobile already shows "ค่าตอบแทนพนักงาน" in its own sticky header (see
  // admin/m/payroll/page.tsx), so repeating it here as a big h1 + subtitle is
  // pure duplication there. Desktop has no page-level title of its own, so it
  // still needs this — just smaller than before.
  const isMobile = basePath.startsWith("/admin/m");
  const nav = (branch: string, date: string) =>
    router.push(
      `${basePath}?branchId=${encodeURIComponent(branch)}&date=${date}`,
    );
  return (
    <main className={css.page}>
      {!isMobile && (
        <>
          <h1 style={{ fontSize: 20 }}>ค่าตอบแทนพนักงาน</h1>
          <p className={css.muted} style={{ fontSize: 12 }}>
            ตรวจเวลา งานที่คิดค่ามือ และยอดจ่ายให้ครบในหน้าเดียว
          </p>
        </>
      )}
      <nav className={css.toolbar} aria-label="ค่าตอบแทน">
        {[
          ["daily", "ตรวจและจ่ายรายวัน"],
          ["report", "รายงานการทำงาน"],
          ["settings", "ตั้งค่าค่าตอบแทน"],
        ].map(([id, label]) => (
          <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>
      {(tab === "daily" || tab === "report") && (
        <div className={css.fields}>
          <label>
            สาขา
            <select
              value={activeBranchId}
              onChange={(e) => nav(e.target.value, activeDate)}
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            วันที่ทำงาน
            <input
              type="date"
              value={activeDate}
              max={todayStr}
              onChange={(e) => {
                if (e.target.value) nav(activeBranchId, e.target.value);
              }}
            />
          </label>
        </div>
      )}
      {tab === "daily" && (
        <div className={css.layout}>
          <aside className={css.people} aria-label="เลือกพนักงาน">
            {rows.map((r) => (
              <button
                key={r.staffId}
                aria-pressed={selected?.staffId === r.staffId}
                onClick={() => setStaffId(r.staffId)}
              >
                <span>{r.name}</span>
                <span>
                  {r.completedCount} งาน ·{" "}
                  {r.status === "PAID" ? "จ่ายแล้ว" : "รอตรวจ"}
                </span>
                <span>{money(r.totalSatang)}</span>
              </button>
            ))}
          </aside>
          {selected ? (
            <DailyReview
              key={`${activeDate}:${activeBranchId}:${selected.staffId}:${selected.sourceToken}`}
              row={selected}
              date={activeDate}
              branchId={activeBranchId}
              basePath={basePath}
            />
          ) : (
            <p>ยังไม่มีพนักงาน</p>
          )}
        </div>
      )}
      {tab === "report" && (
        <ReportControls
          basePath={basePath}
          branchId={activeBranchId}
          day={activeDate}
          staff={props.staffConfig.filter((s) => s.branchId === activeBranchId)}
        />
      )}
      {tab === "settings" && (
        <SettingsTab
          branches={branches}
          staffConfig={props.staffConfig}
          services={props.services}
          addons={props.addons}
        />
      )}
    </main>
  );
}
function DailyReview({
  row: r,
  date,
  branchId,
  basePath,
}: {
  row: StaffPayoutRow;
  date: string;
  branchId: string;
  basePath: string;
}) {
  const router = useRouter();
  const [clockIn, setClockIn] = useState(localTime(r.clockIn));
  const [clockOut, setClockOut] = useState(localTime(r.clockOut));
  const [overnight, setOvernight] = useState(
    !!r.clockOut &&
      new Date(new Date(r.clockOut).getTime() + 7 * 3600000)
        .toISOString()
        .slice(0, 10) > date,
  );
  const [breaks, setBreaks] = useState(String(r.breakMinutes));
  const [attNotes, setAttNotes] = useState(r.attendanceNotes);
  const [mode, setMode] = useState(r.otMode);
  const [ot, setOt] = useState(String(r.otHours));
  const [commissionMode, setCommissionMode] = useState(
    r.commissionOverridden ? "MANUAL" : "AUTO",
  );
  const [commission, setCommission] = useState(
    String(r.commissionSatang / 100),
  );
  const [tip, setTip] = useState(String(r.tipSatang / 100));
  const [adjustment, setAdjustment] = useState(
    String(r.adjustmentSatang / 100),
  );
  const [reason, setReason] = useState(r.adjustmentReason);
  const [payment, setPayment] = useState("CASH");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reopen, setReopen] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const paid = r.status === "PAID";
  const endDay = overnight
    ? new Date(Date.parse(date) + 86400000).toISOString().slice(0, 10)
    : date;
  const start = clockIn ? `${date}T${clockIn}:00+07:00` : null;
  const end = clockOut ? `${endDay}T${clockOut}:00+07:00` : null;
  let minutes: number | null = null,
    timeError = "";
  try {
    if (start && end) minutes = workMinutes(start, end, Number(breaks));
    else if (start || end) timeError = "กรอกเวลาเข้าและออกให้ครบ";
  } catch (e) {
    timeError = e instanceof Error ? e.message : "เวลาไม่ถูกต้อง";
  }
  const effectiveHours = paid
    ? r.otHours
    : mode === "MANUAL"
      ? Number(ot)
      : minutes == null
        ? 0
        : overtimeMinutes(minutes, r.normalWorkMinutes) / 60;
  const otPay = paid ? r.otSatang : Math.round(effectiveHours * r.otRateSatang);
  const commissionPay = paid
    ? r.commissionSatang
    : commissionMode === "MANUAL"
      ? Math.round(Number(commission) * 100)
      : r.calculatedCommissionSatang;
  const tipPay = paid ? r.tipSatang : Math.round(Number(tip) * 100);
  const adjPay = paid
    ? r.adjustmentSatang
    : Math.round(Number(adjustment) * 100);
  const total = commissionPay + otPay + tipPay + adjPay;
  const invalid =
    !Number.isFinite(total) ||
    total < 0 ||
    effectiveHours < 0 ||
    effectiveHours > 24 ||
    commissionPay < 0 ||
    tipPay < 0 ||
    !!timeError;
  async function submit(action: "save" | "settle" | "reopen") {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/payroll", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffId: r.staffId,
          date,
          sourceToken: r.sourceToken,
          action,
          clockIn: start,
          clockOut: end,
          breakMinutes: Number(breaks),
          attendanceNotes: attNotes,
          otMode: mode,
          otHours: Number(ot),
          commissionSatang:
            commissionMode === "MANUAL"
              ? Math.round(Number(commission) * 100)
              : null,
          tipSatang: Math.round(Number(tip) * 100),
          adjustmentSatang: Math.round(Number(adjustment) * 100),
          adjustmentReason: reason,
          paymentMethod: payment,
          reason: reopenReason,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "บันทึกไม่สำเร็จ");
        return;
      }
      router.refresh();
    } catch {
      setError("เชื่อมต่อไม่สำเร็จ ข้อมูลที่กรอกยังอยู่ กรุณาลองใหม่");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className={css.panel}>
      <h2>
        {r.name}{" "}
        <span className={css.badge}>
          {paid ? "ยืนยันจ่ายแล้ว" : "ตรวจยอดก่อนจ่าย"}
        </span>
      </h2>
      <p className={css.muted}>
        ฐาน{r.payType === "DAILY_WAGE" ? "ค่าแรง/วัน" : "เงินเดือน"}{" "}
        {money(r.baseSatang)} · จ่ายฐานเงินแยกตามรอบ{" "}
        {r.payCadence === "WEEKLY" ? "สัปดาห์" : "เดือน"}
      </p>
      {paid && (
        <p className={css.muted}>
          {r.paidAt
            ? `ยืนยันจ่าย ${new Date(r.paidAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}`
            : "ไม่ระบุวันที่จ่ายจริงในข้อมูลเดิม"}
        </p>
      )}
      {r.legacySnapshot && (
        <p className={css.warning}>
          รายการเก่าเก็บเฉพาะยอดจ่าย
          รายละเอียดบุ๊กกิ้งด้านล่างเป็นข้อมูลปัจจุบัน อาจต่างจากวันที่จ่าย
        </p>
      )}
      {r.changedSincePaid && (
        <p className={css.warning}>
          บุ๊กกิ้งเปลี่ยนหลังจ่ายแล้ว ยอดด้านล่างยังเป็นยอดที่ยืนยันจ่าย
          หากต้องแก้ให้เปิดแก้พร้อมเหตุผล
        </p>
      )}
      <h3>เวลาเข้า–ออกจริง</h3>
      <p className={css.muted}>
        กะตามแผน: {r.shifts.join(", ") || "ยังไม่จัดกะ"} · เกณฑ์ปกติ{" "}
        {r.normalWorkMinutes / 60} ชม./วัน
      </p>
      <fieldset
        disabled={paid || busy}
        style={{ border: 0, padding: 0, margin: 0 }}
      >
        <div className={css.fields}>
          <label>
            เข้างานจริง
            <input
              type="time"
              value={clockIn}
              onChange={(e) => setClockIn(e.target.value)}
            />
          </label>
          <label>
            ออกงานจริง
            <input
              type="time"
              value={clockOut}
              onChange={(e) => setClockOut(e.target.value)}
            />
          </label>
          <label>
            วันที่ออกงาน
            <select
              value={overnight ? "next" : "same"}
              onChange={(e) => setOvernight(e.target.value === "next")}
            >
              <option value="same">วันเดียวกัน</option>
              <option value="next">วันถัดไป</option>
            </select>
          </label>
          <label>
            พักที่ไม่นับเวลางาน (นาที)
            <input
              type="number"
              min="0"
              max="1440"
              value={breaks}
              onChange={(e) => setBreaks(e.target.value)}
            />
          </label>
        </div>
        <p className={css.muted}>
          ค่าเริ่มต้นนับช่วงเข้า–ออกทั้งหมด หากมีเวลาพักที่ไม่นับให้กรอกเพิ่ม
        </p>
        <label>
          หมายเหตุ / เหตุผลแก้เวลา
          <input
            value={attNotes}
            onChange={(e) => setAttNotes(e.target.value)}
            placeholder="เช่น แก้เวลาออกตามบันทึกหน้าร้าน"
          />
        </label>
      </fieldset>
      <p aria-live="polite">
        ทำงานจริง{" "}
        {minutes == null
          ? "—"
          : `${Math.floor(minutes / 60)} ชม. ${minutes % 60} นาที`}{" "}
        · OT ตามเวลา{" "}
        {minutes == null
          ? "—"
          : `${overtimeMinutes(minutes, r.normalWorkMinutes)} นาที`}
      </p>
      {timeError && <p className={css.error}>{timeError}</p>}
      <h3>รายละเอียดงานและค่ามือ</h3>
      <p className={css.muted}>
        นับเฉพาะงานเสร็จของช่างหลัก
        งานผู้ช่วยแสดงให้ตรวจสอบและไม่คิดค่ามือตามกติกาเดิม
      </p>
      <div className={css.tableWrap}>
        <table className={css.table}>
          <thead>
            <tr>
              <th>เวลา / งาน</th>
              <th>สถานะ / ที่มาค่ามือ</th>
              <th>ค่ามือ</th>
            </tr>
          </thead>
          <tbody>
            {r.bookings.map((b) => (
              <tr key={b.id}>
                <td>
                  {b.time}
                  <br />
                  {b.customer} · {b.service}
                  {b.addons && <p className={css.muted}>+ {b.addons}</p>}
                  <Link
                    href={`/admin/calendar?date=${date}&branchId=${encodeURIComponent(branchId)}&bookingId=${encodeURIComponent(b.id)}`}
                  >
                    เปิดบุ๊กกิ้ง
                  </Link>
                </td>
                <td>
                  {b.status === "COMPLETED"
                    ? "เสร็จแล้ว"
                    : b.status === "CANCELLED"
                      ? "ยกเลิก"
                      : "ยังไม่เสร็จ"}
                  <p className={css.muted}>
                    {b.primary ? b.source : "ผู้ช่วย — ไม่คิดค่ามือ"}
                  </p>
                </td>
                <td>{money(b.commissionSatang)}</td>
              </tr>
            ))}
            {!r.bookings.length && (
              <tr>
                <td colSpan={3}>ไม่มีงานในวันนี้</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <h3>ตรวจยอดจ่าย</h3>
      <fieldset
        disabled={paid || busy}
        style={{ border: 0, padding: 0, margin: 0 }}
      >
        <div className={css.fields}>
          <label>
            วิธีคิดค่าคอม
            <select
              value={commissionMode}
              onChange={(e) => setCommissionMode(e.target.value)}
            >
              <option value="AUTO">รวมจากบุ๊กกิ้ง</option>
              <option value="MANUAL">กำหนดยอดรวมเอง</option>
            </select>
          </label>
          {commissionMode === "MANUAL" && (
            <label>
              ค่าคอมรวม (฿)
              <input
                type="number"
                min="0"
                step="0.01"
                value={commission}
                onChange={(e) => setCommission(e.target.value)}
              />
            </label>
          )}
          <label>
            วิธีคิด OT
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="AUTO">คำนวณจากเวลาจริง</option>
              <option value="MANUAL">กำหนด OT เอง</option>
            </select>
          </label>
          {mode === "MANUAL" && (
            <label>
              OT (ชั่วโมง)
              <input
                type="number"
                min="0"
                max="24"
                step="0.01"
                value={ot}
                onChange={(e) => setOt(e.target.value)}
              />
            </label>
          )}
          <label>
            ทิป (฿)
            <input
              type="number"
              min="0"
              step="0.01"
              value={tip}
              onChange={(e) => setTip(e.target.value)}
            />
          </label>
          <label>
            ปรับเพิ่ม / ลด (฿)
            <input
              type="number"
              step="0.01"
              value={adjustment}
              onChange={(e) => setAdjustment(e.target.value)}
            />
          </label>
        </div>
        <label style={{ marginTop: 12 }}>
          เหตุผลแก้ค่าคอม / กำหนด OT เอง / ปรับยอด
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="ระบุเหตุผลเพื่อเก็บประวัติ"
          />
        </label>
      </fieldset>
      <div className={css.tableWrap}>
        <table className={css.table}>
          <tbody>
            <tr>
              <td>
                ค่ามือ {r.completedCount} งาน
                {commissionMode === "MANUAL" && !paid && (
                  <span className={css.muted}> · กำหนดเอง</span>
                )}
              </td>
              <td>{money(commissionPay)}</td>
            </tr>
            <tr>
              <td>
                OT{" "}
                {Number.isFinite(effectiveHours)
                  ? effectiveHours.toFixed(2)
                  : "—"}{" "}
                ชม. × {money(r.otRateSatang)}/ชม.
              </td>
              <td>{money(otPay)}</td>
            </tr>
            <tr>
              <td>ทิป</td>
              <td>{money(tipPay)}</td>
            </tr>
            <tr>
              <td>ปรับเพิ่ม / ลด</td>
              <td>{money(adjPay)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      {r.warnings.map((w) => (
        <p key={w} className={css.warning}>
          {w}
        </p>
      ))}
      {error && (
        <p className={css.error} role="alert">
          {error}{" "}
          <button onClick={() => router.refresh()}>โหลดข้อมูลล่าสุด</button>
        </p>
      )}
      <div className={css.total} aria-live="polite">
        <div>
          {paid ? "จ่ายแล้ว" : "ยอดจ่ายสุทธิ"}
          <strong style={{ display: "block" }}>
            {Number.isFinite(total) ? money(total) : "—"}
          </strong>
        </div>
        {(!paid || !r.expenseId) && (
          <label>
            วิธีจ่าย
            <select
              value={payment}
              onChange={(e) => setPayment(e.target.value)}
            >
              <option value="CASH">เงินสด</option>
              <option value="TRANSFER">โอนเงิน</option>
              <option value="OTHER">อื่น ๆ</option>
            </select>
          </label>
        )}
      </div>
      <div className={css.toolbar}>
        {!paid && (
          <button disabled={busy || invalid} onClick={() => submit("save")}>
            บันทึกการตรวจไว้ก่อน
          </button>
        )}
        {(!paid || !r.expenseId) && (
          <button
            className={css.primary}
            disabled={
              busy || invalid || (!paid && mode === "AUTO" && minutes == null)
            }
            onClick={() => submit("settle")}
          >
            {busy
              ? "กำลังบันทึก…"
              : paid
                ? "ลงรายจ่ายจากยอดเดิม"
                : "ยืนยันจ่ายและบันทึกรายจ่าย"}
          </button>
        )}
        {r.expenseId && (
          <Link
            className={css.link}
            href={`${basePath.startsWith("/admin/m") ? "/admin/m/expenses" : "/admin/expenses"}/${r.expenseId}`}
          >
            รายจ่าย / แนบหลักฐาน
          </Link>
        )}
        {paid && (
          <button onClick={() => setReopen(!reopen)}>
            เปิดแก้ OT / ค่าคอมที่จ่ายแล้ว
          </button>
        )}
      </div>
      <FinanceHistory
        query={new URLSearchParams({
          entity: "PAYROLL",
          staffId: r.staffId,
          date,
        }).toString()}
      />
      {reopen && (
        <div>
          <p className={css.warning}>
            เปิดแก้จะยกเลิกรายจ่ายเดิมและเก็บประวัติ
            เมื่อยืนยันใหม่จะสร้างรายการฉบับแก้ไข
          </p>
          <label>
            เหตุผลเปิดแก้
            <input
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
            />
          </label>
          <button
            disabled={busy || !reopenReason.trim()}
            onClick={() => submit("reopen")}
          >
            เปิดแก้รายการนี้
          </button>
        </div>
      )}
    </section>
  );
}
function ReportControls({
  basePath,
  branchId,
  day,
  staff,
}: {
  basePath: string;
  branchId: string;
  day: string;
  staff: StaffCfg[];
}) {
  const [from, setFrom] = useState(day.slice(0, 7) + "-01"),
    [to, setTo] = useState(day),
    [staffId, setStaffId] = useState("");
  const query = new URLSearchParams({
    branchId,
    from,
    to,
    ...(staffId ? { staffId } : {}),
  }).toString();
  return (
    <section className={css.panel} style={{ marginTop: 20 }}>
      <h2>สรุปการทำงานและค่าตอบแทน</h2>
      <div className={css.fields}>
        <label>
          ตั้งแต่
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          ถึง
          <input
            type="date"
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <label>
          พนักงาน
          <select value={staffId} onChange={(e) => setStaffId(e.target.value)}>
            <option value="">ทุกคนในสาขา</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className={css.muted}>
        รายงานแยกเวลาทำงาน ค่ามือ OT ทิป ยอดปรับ และสถานะจ่าย
        รายเดือนรวมจากรายการเดิมโดยไม่ลงรายจ่ายซ้ำ
        ฐานเงินแสดงแยกจากเงินที่จ่ายรายวัน
      </p>
      <div className={css.toolbar}>
        <Link className={css.link} href={`${basePath}/report?${query}`}>
          ดูรายงาน / พิมพ์ / คัดลอกสรุปส่งพนักงาน
        </Link>
        <a
          className={css.link}
          href={`/api/admin/payroll/report?${query}&format=csv`}
        >
          ดาวน์โหลดสรุปรายวัน CSV
        </a>
        <a
          className={css.link}
          href={`/api/admin/payroll/report?${query}&format=bookings`}
        >
          ดาวน์โหลดรายละเอียดงาน CSV
        </a>
      </div>
    </section>
  );
}
