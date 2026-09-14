import { notFound } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { payrollReport } from "@/lib/payroll-report";
import PayrollReportActions from "@/components/PayrollReportActions";
import css from "@/components/Finance.module.css";
export const dynamic = "force-dynamic";
const money = (s: number) =>
  `฿${(s / 100).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const time = (s: string | null) =>
  s ? new Date(Date.parse(s) + 7 * 3600000).toISOString().slice(11, 16) : "—";
export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const admin = await getCurrentAdmin();
  if (admin?.role !== "OWNER") notFound();
  const sp = await searchParams;
  let data;
  try {
    data = await payrollReport(
      new URLSearchParams(
        Object.entries(sp).filter((e): e is [string, string] => !!e[1]),
      ),
    );
  } catch (e) {
    return (
      <main className={css.page}>
        <p>{e instanceof Error ? e.message : "สร้างรายงานไม่สำเร็จ"}</p>
      </main>
    );
  }
  const summary =
    `สรุปการทำงาน ${data.range.from} ถึง ${data.range.to}\n${data.branch}\n` +
    data.people
      .map(
        (p) =>
          `${p.name}: งานเสร็จ ${p.days.reduce((v, d) => v + d.bookings.filter((b) => b.primary && b.status === "COMPLETED").length, 0)} งาน · ยืนยันเวลาทำงาน ${Math.floor(p.workedMinutes / 60)} ชม. ${p.workedMinutes % 60} นาที\nค่ามือที่จ่าย ${money(p.days.filter((d) => d.status === "PAID").reduce((v, d) => v + d.commissionSatang, 0))} · OT ${money(p.days.reduce((v, d) => v + d.otSatang, 0))} · ทิป ${money(p.days.filter((d) => d.status === "PAID").reduce((v, d) => v + d.tipSatang, 0))} · ปรับ ${money(p.days.filter((d) => d.status === "PAID").reduce((v, d) => v + d.adjustmentSatang, 0))}\nรวมจ่ายแล้ว ${money(p.totalSatang)} · ${p.days.filter((d) => d.status !== "PAID").length} วันยังไม่ยืนยันจ่าย`,
      )
      .join("\n") +
    "\nยอดนี้รวมค่ามือ OT ทิป และยอดปรับ ไม่รวมฐานเงินที่จ่ายแยกตามรอบ";
  return (
    <main className={`${css.page} ${css.report}`}>
      <h1>รายงานการทำงานและค่าตอบแทน</h1>
      <p>
        {data.branch} · {data.range.from} ถึง {data.range.to}
      </p>
      <PayrollReportActions summary={summary} />
      <pre>{summary}</pre>
      <p className={css.muted}>
        วันที่ยังไม่จ่ายแสดงค่ามือปัจจุบัน ส่วน OT
        และยอดจ่ายจริงนับเฉพาะวันที่ยืนยันแล้ว
      </p>
      {data.people.map((p) => (
        <section key={p.id} style={{ marginTop: 24 }}>
          <h2>{p.name}</h2>
          <p>
            ฐาน{p.payType === "DAILY_WAGE" ? "ค่าแรง/วัน" : "เงินเดือน"}{" "}
            ปัจจุบัน {money(p.baseSatang)} · แสดงเป็นข้อมูลอ้างอิง จ่ายแยกตามรอบ
          </p>
          <div className={css.tableWrap}>
            <table className={css.table}>
              <thead>
                <tr>
                  <th>วันที่ / เวลา</th>
                  <th>งาน / ชั่วโมงจริง</th>
                  <th>ค่ามือ</th>
                  <th>OT</th>
                  <th>ทิป / ปรับ</th>
                  <th>จ่ายจริง / สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {p.days.map((d) => (
                  <tr key={d.date}>
                    <td>
                      {d.date}
                      <br />
                      {time(d.clockIn)}–{time(d.clockOut)}
                      <p className={css.muted}>
                        พักไม่นับ {d.breakMinutes} นาที
                      </p>
                    </td>
                    <td>
                      {
                        d.bookings.filter(
                          (b) => b.primary && b.status === "COMPLETED",
                        ).length
                      }{" "}
                      งาน
                      <br />
                      {d.workedMinutes == null
                        ? "ไม่มีเวลาจริง"
                        : `${(d.workedMinutes / 60).toFixed(2)} ชม.`}
                    </td>
                    <td>{money(d.commissionSatang)}</td>
                    <td>
                      {d.otHours ?? "—"} ชม.
                      <br />
                      {money(d.otSatang)}
                    </td>
                    <td>
                      {money(d.tipSatang)}
                      <br />
                      {money(d.adjustmentSatang)}
                      <p className={css.muted}>{d.reason}</p>
                    </td>
                    <td>
                      {money(d.totalSatang)}
                      <br />
                      {d.status === "PAID" ? "จ่ายแล้ว" : "ยังไม่จ่าย"}
                      {d.status === "PAID" && !d.expenseId && (
                        <p>ยังไม่ลงรายจ่าย</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {p.days.map((d) => (
            <div key={d.date}>
              <h3>รายละเอียดงาน {d.date}</h3>
              {d.legacy && (
                <p className={css.warning}>
                  รายการเก่า: ยอดจ่ายเป็นยอดเดิม รายละเอียดงานเป็นข้อมูลปัจจุบัน
                </p>
              )}
              <div className={css.tableWrap}>
                <table className={css.table}>
                  <thead>
                    <tr>
                      <th>เวลา</th>
                      <th>บริการ / บริการเสริม</th>
                      <th>บทบาท / สถานะ</th>
                      <th>ค่ามือ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.bookings.map((b) => (
                      <tr key={b.id}>
                        <td>{b.time}</td>
                        <td>
                          {b.service}
                          {b.addons && ` + ${b.addons}`}
                        </td>
                        <td>
                          {b.primary ? "ช่างหลัก" : "ผู้ช่วย"} · {b.status}
                        </td>
                        <td>{money(b.commissionSatang)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </section>
      ))}
    </main>
  );
}
