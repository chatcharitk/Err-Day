"use client";
import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
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
type SortKey = "name" | "type" | "status" | "doc";
const TYPE_LABEL: Record<string, string> = { EMPLOYEE: "พนักงาน", PERSON: "บุคคล", BUSINESS: "ร้านค้า / บริษัท" };
type ActiveFilter = "all" | "active" | "inactive";
type DocFilter = "all" | "complete" | "incomplete";

/** Document details an accountant needs for a payee; empty list = complete. */
function missingDocFields(v: Payee): string[] {
  const out: string[] = [];
  if (!v.legalName?.trim()) out.push("ชื่อเต็ม");
  if (!v.address?.trim()) out.push("ที่อยู่");
  if (!v.taxId?.trim()) out.push("เลขภาษี");
  return out;
}

const BADGE_OK   = { background: "#e3f4ea", color: "#1e6242" };
const BADGE_OFF  = { background: "#ececec", color: "#6b6b6b" };
const BADGE_WARN = { background: "#fff5db", color: "#775014" };

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
    [activeFilter, setActiveFilter] = useState<ActiveFilter>("all"),
    [docFilter, setDocFilter] = useState<DocFilter>("all"),
    [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "name", dir: "asc" }),
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
  // Everything is already loaded in the browser (up to 1000 payees), so filter
  // and sort here rather than round-tripping to the server.
  const visible = useMemo(() => {
    const rows = vendors
      .filter((v) => (v.name + (v.legalName || "") + (v.taxId || "")).includes(q))
      .filter((v) => activeFilter === "all" || (activeFilter === "active") === v.isActive)
      .filter((v) => docFilter === "all" || (missingDocFields(v).length === 0) === (docFilter === "complete"));
    const sign = sort.dir === "asc" ? 1 : -1;
    const byName = (a: Payee, b: Payee) => a.name.localeCompare(b.name, "en");
    const primary = (a: Payee, b: Payee) =>
        sort.key === "type"   ? (TYPE_LABEL[a.type] ?? a.type).localeCompare(TYPE_LABEL[b.type] ?? b.type, "en")
      : sort.key === "status" ? Number(b.isActive) - Number(a.isActive)            // active first when ascending
      : sort.key === "doc"    ? missingDocFields(a).length - missingDocFields(b).length // complete first when ascending
      :                         byName(a, b);
    return [...rows].sort((a, b) => sign * primary(a, b) || byName(a, b));
  }, [vendors, q, activeFilter, docFilter, sort]);

  /** First click sorts ascending; clicking the active column flips the direction. */
  function toggleSort(key: SortKey) {
    setSort((s) => ({ key, dir: s.key === key && s.dir === "asc" ? "desc" : "asc" }));
  }
  function sortHeader(key: SortKey, label: string) {
    const active = sort.key === key;
    const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
    return (
      <th aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
        <button type="button" onClick={() => toggleSort(key)}
          style={{ all: "unset", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, color: active ? "#8b1d24" : undefined, fontWeight: "inherit" }}
          title={active ? (sort.dir === "asc" ? "เรียง ก→ฮ / น้อย→มาก (คลิกเพื่อกลับด้าน)" : "เรียง ฮ→ก / มาก→น้อย (คลิกเพื่อกลับด้าน)") : "คลิกเพื่อเรียงลำดับ"}>
          {label}
          <Icon size={13} style={{ opacity: active ? 1 : 0.5 }} />
        </button>
      </th>
    );
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
            <div className={css.toolbar} style={{ marginTop: 0 }}>
              <span className={css.muted}>สถานะ</span>
              {([
                ["all", "ทั้งหมด", vendors.length],
                ["active", "ใช้งาน", vendors.filter((v) => v.isActive).length],
                ["inactive", "ปิดใช้งาน", vendors.filter((v) => !v.isActive).length],
              ] as [ActiveFilter, string, number][]).map(([k, label, n]) => (
                <button key={k} aria-pressed={activeFilter === k}
                  onClick={() => setActiveFilter(k)}>
                  {label} ({n})
                </button>
              ))}
              <span className={css.muted} style={{ marginLeft: 8 }}>ข้อมูลเอกสาร</span>
              {([
                ["all", "ทั้งหมด", vendors.length],
                ["complete", "ครบ", vendors.filter((v) => missingDocFields(v).length === 0).length],
                ["incomplete", "ยังไม่ครบ", vendors.filter((v) => missingDocFields(v).length > 0).length],
              ] as [DocFilter, string, number][]).map(([k, label, n]) => (
                <button key={k} aria-pressed={docFilter === k}
                  onClick={() => setDocFilter(k)}>
                  {label} ({n})
                </button>
              ))}
            </div>
          )}
          {!form && (
            <div className={css.tableWrap}>
              <table className={css.table}>
                <thead>
                  <tr>
                    {sortHeader("name", "ผู้รับเงิน")}
                    {sortHeader("type", "ประเภท")}
                    {sortHeader("status", "สถานะ")}
                    {sortHeader("doc", "ข้อมูลเอกสาร")}
                    <th>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {visible
                    .map((v) => (
                      <tr key={v.id}>
                        <td>{v.name}</td>
                        <td>{TYPE_LABEL[v.type] ?? v.type}</td>
                        <td>
                          <span className={css.badge} style={v.isActive ? BADGE_OK : BADGE_OFF}>
                            {v.isActive ? "ใช้งาน" : "ปิดใช้งาน"}
                          </span>
                        </td>
                        <td>
                          {(() => {
                            const missing = missingDocFields(v);
                            return missing.length === 0 ? (
                              <span className={css.badge} style={BADGE_OK}>ข้อมูลครบ</span>
                            ) : (
                              <>
                                <span className={css.badge} style={BADGE_WARN}>ยังไม่ครบ</span>
                                <p className={css.muted} style={{ margin: "4px 0 0" }}>
                                  ขาด: {missing.join(", ")}
                                </p>
                              </>
                            );
                          })()}
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
              <h3 style={{ marginTop: 0 }}>ข้อมูลทั่วไป</h3>
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
                <label>
                  ชื่อเรียก / ชื่อร้าน *
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
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
              </div>

              <h3>ข้อมูลเอกสาร / ภาษี</h3>
              <div className={css.fields}>
                <label>
                  ชื่อเต็มตามเอกสาร
                  <input
                    value={form.legalName || ""}
                    onChange={(e) =>
                      setForm({ ...form, legalName: e.target.value })
                    }
                  />
                </label>
                <label>
                  เลขผู้เสียภาษี / เลขประชาชน
                  <input
                    value={form.taxId || ""}
                    onChange={(e) => setForm({ ...form, taxId: e.target.value })}
                  />
                </label>
                <label>
                  สำนักงานใหญ่ / รหัสสาขาภาษี
                  <input
                    value={form.taxBranch || ""}
                    onChange={(e) =>
                      setForm({ ...form, taxBranch: e.target.value })
                    }
                  />
                </label>
                <label style={{ gridColumn: "1 / -1" }}>
                  ที่อยู่ตามเอกสาร
                  <textarea
                    rows={2}
                    value={form.address || ""}
                    onChange={(e) =>
                      setForm({ ...form, address: e.target.value })
                    }
                  />
                </label>
              </div>

              <h3>ช่องทางติดต่อ &amp; บัญชีธนาคาร</h3>
              <div className={css.fields}>
                <label>
                  โทรศัพท์
                  <input
                    value={form.phone || ""}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </label>
                <label>
                  ธนาคาร
                  <input
                    value={form.bankName || ""}
                    onChange={(e) =>
                      setForm({ ...form, bankName: e.target.value })
                    }
                  />
                </label>
                <label>
                  เลขบัญชี
                  <input
                    value={form.bankAccount || ""}
                    onChange={(e) =>
                      setForm({ ...form, bankAccount: e.target.value })
                    }
                  />
                </label>
                <label>
                  ชื่อบัญชี
                  <input
                    value={form.bankAccountName || ""}
                    onChange={(e) =>
                      setForm({ ...form, bankAccountName: e.target.value })
                    }
                  />
                </label>
              </div>

              <h3>อื่น ๆ</h3>
              <div className={css.fields}>
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
                <label style={{ gridColumn: "1 / -1" }}>
                  หมายเหตุ
                  <textarea
                    rows={2}
                    value={form.notes || ""}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
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
