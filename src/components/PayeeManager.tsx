"use client";
import { useEffect, useState } from "react";
import { EXPENSE_CATEGORIES } from "@/lib/expenses";
import css from "./Finance.module.css";
interface Payee {
  id?: string;
  name: string;
  type: string;
  staffId: string | null;
  legalName: string | null;
  taxId: string | null;
  address: string | null;
  taxBranch: string | null;
  phone: string | null;
  bankName: string | null;
  bankAccount: string | null;
  bankAccountName: string | null;
  category: string | null;
  notes: string | null;
  isActive: boolean;
}
const empty: Payee = {
  name: "",
  type: "BUSINESS",
  staffId: null,
  legalName: null,
  taxId: null,
  address: null,
  taxBranch: null,
  phone: null,
  bankName: null,
  bankAccount: null,
  bankAccountName: null,
  category: null,
  notes: null,
  isActive: true,
};
export default function PayeeManager({
  onSaved,
}: {
  onSaved?: (v: { id: string; name: string }) => void;
}) {
  const [vendors, setVendors] = useState<Payee[]>([]),
    [staff, setStaff] = useState<
      { id: string; name: string; branch: { name: string } }[]
    >([]),
    [form, setForm] = useState<Payee | null>(null),
    [q, setQ] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/vendors?manage=1");
      const d = await r.json();
      if (!r.ok)
        throw new Error(d.error || "ข้อมูลผู้รับเงินสำหรับเจ้าของเท่านั้น");
      setVendors(d.vendors);
      setStaff(d.staff);
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, []);
  async function save() {
    if (!form || busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/admin/vendors", {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      await load();
      setForm(null);
      onSaved?.(d.vendor);
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <h2>ผู้รับเงิน / ร้านค้า / พนักงาน</h2>
      <p className={css.muted}>
        ใช้ผู้รับเงินเดิมซ้ำได้ แก้ข้อมูลติดต่อและข้อมูลบัญชีที่เดียว
        เอกสารที่บันทึกแล้วเก็บข้อมูล ณ วันบันทึก
      </p>
      {error && (
        <p role="alert" className={css.error}>
          {error}
        </p>
      )}
      {loading ? (
        <p>กำลังโหลด…</p>
      ) : (
        <>
          <div className={css.toolbar}>
            <input
              aria-label="ค้นหาผู้รับเงิน"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ค้นหาชื่อ / เลขผู้เสียภาษี"
              style={{ maxWidth: 320 }}
            />
            <button onClick={() => setForm({ ...empty })}>
              เพิ่มผู้รับเงิน
            </button>
          </div>
          {!form && (
            <div className={css.tableWrap}>
              <table className={css.table}>
                <thead>
                  <tr>
                    <th>ผู้รับเงิน</th>
                    <th>ข้อมูลเอกสาร</th>
                    <th>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {vendors
                    .filter((v) =>
                      (v.name + (v.legalName || "") + (v.taxId || "")).includes(
                        q,
                      ),
                    )
                    .map((v) => (
                      <tr key={v.id}>
                        <td>
                          {v.name}
                          <p className={css.muted}>
                            {v.type === "EMPLOYEE"
                              ? "พนักงาน"
                              : v.type === "PERSON"
                                ? "บุคคล"
                                : "ร้านค้า / บริษัท"}
                            {!v.isActive && " · ปิดใช้งาน"}
                          </p>
                        </td>
                        <td>
                          {v.legalName && v.taxId && v.address
                            ? "ชื่อ ที่อยู่ เลขภาษีครบ"
                            : "ยังขาดชื่อเต็ม ที่อยู่ หรือเลขภาษี"}
                        </td>
                        <td>
                          <button onClick={() => setForm(v)}>แก้ข้อมูล</button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
          {form && (
            <div className={css.panel}>
              <div className={css.fields}>
                <label>
                  ประเภท
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                  >
                    <option value="BUSINESS">ร้านค้า / บริษัท</option>
                    <option value="PERSON">บุคคลทั่วไป</option>
                    <option value="EMPLOYEE">พนักงาน</option>
                  </select>
                </label>
                {form.type === "EMPLOYEE" && (
                  <label>
                    พนักงาน
                    <select
                      value={form.staffId || ""}
                      disabled={!!form.id && !!form.staffId}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          staffId: e.target.value,
                          name:
                            staff.find((s) => s.id === e.target.value)?.name ||
                            form.name,
                        })
                      }
                    >
                      <option value="">เลือกพนักงาน</option>
                      {staff.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} · {s.branch.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {(
                  [
                    ["name", "ชื่อเรียก / ชื่อร้าน *"],
                    ["legalName", "ชื่อเต็มตามเอกสาร"],
                    ["taxId", "เลขผู้เสียภาษี / เลขประชาชน"],
                    ["taxBranch", "สำนักงานใหญ่ / รหัสสาขาภาษี"],
                    ["address", "ที่อยู่ตามเอกสาร"],
                    ["phone", "โทรศัพท์"],
                    ["bankName", "ธนาคาร"],
                    ["bankAccount", "เลขบัญชี"],
                    ["bankAccountName", "ชื่อบัญชี"],
                    ["notes", "หมายเหตุ"],
                  ] as const
                ).map(([k, label]) => (
                  <label key={k}>
                    {label}
                    <input
                      value={form[k] || ""}
                      onChange={(e) =>
                        setForm({ ...form, [k]: e.target.value })
                      }
                    />
                  </label>
                ))}
                <label>
                  หมวดรายจ่ายประจำ
                  <select
                    value={form.category || ""}
                    onChange={(e) =>
                      setForm({ ...form, category: e.target.value })
                    }
                  >
                    <option value="">ไม่ระบุ</option>
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  สถานะ
                  <select
                    value={form.isActive ? "active" : "inactive"}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        isActive: e.target.value === "active",
                      })
                    }
                  >
                    <option value="active">ใช้งาน</option>
                    <option value="inactive">ปิดใช้งาน</option>
                  </select>
                </label>
              </div>
              <div className={css.toolbar}>
                <button className={css.primary} disabled={busy} onClick={save}>
                  บันทึกผู้รับเงิน
                </button>
                <button disabled={busy} onClick={() => setForm(null)}>
                  ยกเลิก
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
