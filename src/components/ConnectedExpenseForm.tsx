"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { EXPENSE_CATEGORY_GROUPS, PAYMENT_METHODS } from "@/lib/expenses";
import { expenseTotals, type VatMode } from "@/lib/finance-math";
import ExpenseAttachments, { type Attachment } from "./ExpenseAttachments";
import FinanceHistory from "./FinanceHistory";
import PayeeManager from "./PayeeManager";
import css from "./Finance.module.css";
export interface InitialExpense {
  id?: string;
  branchId?: string | null;
  category?: string;
  vendor?: string | null;
  vendorId?: string | null;
  date?: string;
  totalAmount?: number;
  vatAmount?: number | null;
  paymentMethod?: string | null;
  notes?: string | null;
  items?: {
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }[];
  attachments?: {
    url: string;
    filename: string | null;
    fileType: string | null;
  }[];
  vatMode?: string;
  vatRate?: number;
  discountAmount?: number;
  withholdingAmount?: number;
  invoiceNumber?: string | null;
  documentDate?: string | null;
  paidDate?: string | null;
  status?: string;
  locked?: boolean;
  payrollHref?: string;
  canVoidLegacyMonthly?: boolean;
  payeeSnapshot?: unknown;
}
export interface ExpenseFormProps {
  mode: "create" | "edit";
  branches: { id: string; name: string }[];
  initial?: InitialExpense;
  basePath?: string;
}
const today = () =>
  new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
const money = (s: number) =>
  `฿${(s / 100).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export default function ConnectedExpenseForm({
  mode,
  branches,
  initial: i,
  basePath = "/admin/expenses",
}: ExpenseFormProps) {
  const router = useRouter(),
    locked = !!i?.locked,
    voided = i?.status === "VOIDED";
  const [branch, setBranch] = useState(i?.branchId || ""),
    [category, setCategory] = useState(i?.category || "other"),
    [vendor, setVendor] = useState(i?.vendor || ""),
    [vendorId, setVendorId] = useState(i?.vendorId || "");
  const [hits, setHits] = useState<
      {
        id: string;
        name: string;
        legalName: string | null;
        complete: boolean;
        category: string | null;
      }[]
    >([]),
    [searchOpen, setSearchOpen] = useState(false),
    [manage, setManage] = useState(false);
  const [date, setDate] = useState(i?.date || today()),
    [docDate, setDocDate] = useState(i?.documentDate || ""),
    [paidDate, setPaidDate] = useState(i?.paidDate || ""),
    [invoice, setInvoice] = useState(i?.invoiceNumber || "");
  const [payment, setPayment] = useState(i?.paymentMethod || ""),
    [notes, setNotes] = useState(i?.notes || ""),
    [status, setStatus] = useState(i?.status || "CONFIRMED");
  const [vatMode, setVatMode] = useState<VatMode>(
      (i?.vatMode || "NONE") as VatMode,
    ),
    [rate, setRate] = useState(String(i?.vatRate ?? 7));
  const [manual, setManual] = useState(String((i?.totalAmount ?? 0) / 100)),
    [discount, setDiscount] = useState(String((i?.discountAmount ?? 0) / 100)),
    [wht, setWht] = useState(String((i?.withholdingAmount ?? 0) / 100));
  const [items, setItems] = useState(
    (i?.items || []).map((it) => ({
      ...it,
      unitPrice: String(it.unitPrice / 100),
      quantity: String(it.quantity),
    })),
  );
  const [attachments, setAttachments] = useState<Attachment[]>(
    (i?.attachments || []).map((a) => ({
      url: a.url,
      filename: a.filename || "ไฟล์แนบ",
      fileType: a.fileType || "",
    })),
  );
  const [refreshPayee, setRefreshPayee] = useState(false);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [voidReason, setVoidReason] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(
          `/api/admin/vendors?q=${encodeURIComponent(vendor)}&limit=8`,
          { signal: abort.signal },
        );
        if (r.ok) setHits((await r.json()).vendors);
      } catch {}
    }, 200);
    return () => {
      clearTimeout(t);
      abort.abort();
    };
  }, [vendor, manage]);
  const lines = items.map((it) => ({
    description: it.description,
    quantity: Number(it.quantity),
    unitPrice: Math.round(Number(it.unitPrice) * 100),
    totalPrice: it.totalPrice,
  }));
  let calc = {
      subtotal: 0,
      vatAmount: i?.vatAmount ?? 0,
      totalAmount: i?.totalAmount ?? 0,
      netAmount: (i?.totalAmount ?? 0) - (i?.withholdingAmount ?? 0),
    },
    calculationError = "";
  try {
    if (!locked)
      calc = expenseTotals({
        items: lines.map((it) => ({
          ...it,
          description: it.description || "รายการ",
        })),
        totalAmount: Math.round(Number(manual) * 100),
        discountAmount: Math.round(Number(discount) * 100),
        vatMode,
        vatRate: Number(rate),
        vatAmount: i?.vatAmount,
        withholdingAmount: Math.round(Number(wht) * 100),
      });
  } catch (e) {
    calculationError = e instanceof Error ? e.message : "ตัวเลขไม่ถูกต้อง";
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError("");
    if (calculationError) {
      setError(calculationError);
      return;
    }
    if (!locked && lines.some((l) => !l.description.trim())) {
      setError("กรุณาระบุชื่อทุกรายการ");
      return;
    }
    setBusy(true);
    try {
      const payload = locked
        ? {
            notes,
            invoiceNumber: invoice,
            attachments,
            refreshPayeeSnapshot: refreshPayee,
          }
        : {
            refreshPayeeSnapshot: refreshPayee,
            branchId: branch || null,
            category,
            vendor,
            vendorId: vendorId || null,
            date,
            documentDate: docDate || null,
            paidDate: paidDate || null,
            invoiceNumber: invoice,
            paymentMethod: payment,
            notes,
            status,
            items: lines,
            attachments,
            vatMode,
            vatRate: Number(rate),
            vatAmount: calc.vatAmount,
            totalAmount: calc.totalAmount,
            manualAmount: Math.round(Number(manual) * 100),
            discountAmount: Math.round(Number(discount) * 100),
            withholdingAmount: Math.round(Number(wht) * 100),
          };
      const res = await fetch(
        mode === "edit"
          ? `/api/admin/expenses/${i?.id}`
          : "/api/admin/expenses",
        {
          method: mode === "edit" ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "บันทึกไม่สำเร็จ");
      router.push(basePath);
      router.refresh();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "เชื่อมต่อไม่สำเร็จ ข้อมูลยังอยู่ กรุณาลองใหม่",
      );
    } finally {
      setBusy(false);
    }
  }
  async function voidExpense() {
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/expenses/${i?.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: voidReason }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      router.push(basePath);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ยกเลิกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className={css.page}>
      <div className={css.toolbar}>
        <Link href={basePath}>← รายจ่าย</Link>
        <h1>{mode === "edit" ? "ตรวจ / แก้ไขรายจ่าย" : "บันทึกรายจ่าย"}</h1>
      </div>
      {manage ? (
        <div className={css.panel}>
          <button onClick={() => setManage(false)}>กลับไปบันทึกรายจ่าย</button>
          <PayeeManager
            onSaved={(v) => {
              if (!locked) {
                setVendor(v.name);
                setVendorId(v.id);
              } else if (v.id === i?.vendorId) {
                setRefreshPayee(true);
              }
              setManage(false);
            }}
          />
        </div>
      ) : (
        <form onSubmit={save} className={css.panel}>
          {locked && (
            <p className={css.warning}>
              ยอดนี้เชื่อมกับค่าตอบแทนพนักงาน
              แนบหลักฐานและเพิ่มหมายเหตุได้ที่นี่{" "}
              {i?.payrollHref && (
                <Link href={i.payrollHref}>เปิดค่าตอบแทนเพื่อแก้ยอด</Link>
              )}
            </p>
          )}
          {voided && (
            <p className={css.warning}>
              ยกเลิกแล้ว — เก็บไว้ตรวจย้อนหลัง ไม่นับในยอดรายจ่าย
            </p>
          )}
          <fieldset
            disabled={locked || busy || voided}
            style={{ border: 0, padding: 0, margin: 0 }}
          >
            <div className={css.fields}>
              <label>
                สาขา
                <select
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                >
                  <option value="">ส่วนกลาง / HQ</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                หมวดรายจ่าย
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {EXPENSE_CATEGORY_GROUPS.map((g) => (
                    <optgroup key={g.label} label={g.label}>
                      {g.categories.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
            </div>
            <h3>ผู้รับเงิน</h3>
            <label>
              ค้นหาชื่อร้าน / บุคคล / พนักงาน
              <input
                value={vendor}
                onFocus={() => setSearchOpen(true)}
                onChange={(e) => {
                  setVendor(e.target.value);
                  setVendorId("");
                  setSearchOpen(true);
                }}
                placeholder="เลือกผู้รับเงินเดิม หรือพิมพ์ชื่อใหม่"
              />
            </label>
            {searchOpen && hits.length > 0 && (
              <div className={css.toolbar}>
                {hits.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => {
                      setVendor(v.name);
                      setVendorId(v.id);
                      if (v.category) setCategory(v.category);
                      setSearchOpen(false);
                    }}
                  >
                    {v.name} ·{" "}
                    {v.complete ? "ข้อมูลเอกสารครบ" : "ข้อมูลยังไม่ครบ"}
                  </button>
                ))}
              </div>
            )}
            <div className={css.toolbar}>
              <button type="button" onClick={() => setManage(true)}>
                จัดการข้อมูลผู้รับเงิน
              </button>
              <span className={css.muted}>
                {vendorId
                  ? "เชื่อมผู้รับเงินแล้ว"
                  : "ชื่อใหม่จะถูกเก็บไว้ใช้ครั้งต่อไป"}
              </span>
            </div>
            <div className={css.fields}>
              <label>
                วันที่บันทึกรายจ่าย
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>
              <label>
                วันที่เอกสาร
                <input
                  type="date"
                  value={docDate}
                  onChange={(e) => setDocDate(e.target.value)}
                />
              </label>
            </div>
            <h3>รายการและยอดเงิน</h3>
            {i?.vatMode === "LEGACY" &&
              lines.length > 0 &&
              lines.reduce((v, it) => v + it.totalPrice, 0) !==
                i.totalAmount && (
                <p className={css.warning}>
                  ต้องตรวจเอกสารเดิม: รวมรายการย่อย{" "}
                  {money(lines.reduce((v, it) => v + it.totalPrice, 0))}{" "}
                  แต่ยอดบันทึก {money(i.totalAmount ?? 0)} กรุณาตรวจ VAT /
                  ส่วนลดก่อนแก้ยอด
                </p>
              )}
            {vatMode === "LEGACY" && (
              <p className={css.warning}>
                รายการเก่า: คงยอดเดิมไว้เพื่อไม่เปลี่ยนบัญชีย้อนหลัง
                เลือกวิธีคิด VAT ด้านล่างเพื่อเริ่มรวมยอดจากรายการอัตโนมัติ
              </p>
            )}
            {items.map((it, index) => (
              <div className={css.line} key={index}>
                <label>
                  รายการ
                  <input
                    required
                    value={it.description}
                    onChange={(e) =>
                      setItems(
                        items.map((v, n) =>
                          n === index
                            ? { ...v, description: e.target.value }
                            : v,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  จำนวน
                  <input
                    type="number"
                    min="0.001"
                    step="any"
                    required
                    value={it.quantity}
                    onChange={(e) =>
                      setItems(
                        items.map((v, n) =>
                          n === index ? { ...v, quantity: e.target.value } : v,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  ราคา/หน่วย ฿
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={it.unitPrice}
                    onChange={(e) =>
                      setItems(
                        items.map((v, n) =>
                          n === index ? { ...v, unitPrice: e.target.value } : v,
                        ),
                      )
                    }
                  />
                </label>
                <output>
                  {money(
                    vatMode === "LEGACY"
                      ? it.totalPrice
                      : Math.round(
                          Number(it.quantity) *
                            Math.round(Number(it.unitPrice) * 100),
                        ),
                  )}
                </output>
                <button
                  type="button"
                  aria-label={`ลบรายการ ${index + 1}`}
                  onClick={() => setItems(items.filter((_, n) => n !== index))}
                >
                  ×
                </button>
              </div>
            ))}
            <div className={css.toolbar}>
              <button
                type="button"
                disabled={vatMode === "LEGACY"}
                onClick={() =>
                  setItems([
                    ...items,
                    {
                      description: "",
                      quantity: "1",
                      unitPrice: "",
                      totalPrice: 0,
                    },
                  ])
                }
              >
                + เพิ่มรายการ
              </button>
            </div>
            {!items.length && (
              <label>
                ยอดก่อนคำนวณ VAT / ส่วนลด (฿)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={manual}
                  onChange={(e) => setManual(e.target.value)}
                />
              </label>
            )}
            <div className={css.fields}>
              <label>
                วิธีคิด VAT
                <select
                  value={vatMode}
                  onChange={(e) => setVatMode(e.target.value as VatMode)}
                >
                  {i?.vatMode === "LEGACY" && (
                    <option value="LEGACY">คงยอดเอกสารเดิม</option>
                  )}
                  <option value="NONE">ไม่มี VAT</option>
                  <option value="INCLUSIVE">ราคาในรายการรวม VAT แล้ว</option>
                  <option value="EXCLUSIVE">ราคาในรายการยังไม่รวม VAT</option>
                </select>
              </label>
              {(vatMode === "INCLUSIVE" || vatMode === "EXCLUSIVE") && (
                <label>
                  VAT (%)
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                  />
                </label>
              )}
              <label>
                ส่วนลดทั้งบิล (฿)
                <input
                  type="number"
                  disabled={vatMode === "LEGACY"}
                  min="0"
                  step="0.01"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                />
              </label>
              <label>
                หัก ณ ที่จ่าย ตามเอกสาร (฿)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={wht}
                  onChange={(e) => setWht(e.target.value)}
                />
              </label>
            </div>
          </fieldset>
          {i?.id && !voided && (
            <details>
              <summary>ข้อมูลผู้รับเงินในเอกสารเดิม</summary>
              <p className={css.muted}>
                เอกสารนี้เก็บข้อมูลผู้รับเงิน ณ วันที่บันทึก
                หากเพิ่งเติมชื่อเต็มหรือเลขภาษีในทะเบียน
                ให้เลือกอัปเดตข้อมูลบนเอกสารนี้แล้วบันทึก
              </p>
              <label>
                ใช้ข้อมูลผู้รับเงินล่าสุด (เจ้าของ)
                <select
                  value={refreshPayee ? "yes" : "no"}
                  onChange={(e) => setRefreshPayee(e.target.value === "yes")}
                >
                  <option value="no">คงข้อมูลเดิม</option>
                  <option value="yes">อัปเดตและเก็บประวัติเมื่อบันทึก</option>
                </select>
              </label>
              <button type="button" onClick={() => setManage(true)}>
                เปิดทะเบียนผู้รับเงิน
              </button>
            </details>
          )}
          <div className={css.stats} aria-live="polite">
            <div className={css.stat}>
              ยอดรวมเอกสาร<strong>{money(calc.totalAmount)}</strong>
            </div>
            <div className={css.stat}>
              VAT ในยอดรวม<strong>{money(calc.vatAmount)}</strong>
            </div>
            <div className={css.stat}>
              จ่ายสุทธิหลังหักภาษี<strong>{money(calc.netAmount)}</strong>
            </div>
          </div>
          {calculationError && <p className={css.error}>{calculationError}</p>}
          <fieldset
            disabled={busy || voided}
            style={{ border: 0, padding: 0, margin: 0 }}
          >
            <h3>เอกสารและการจ่ายเงิน</h3>
            <div className={css.fields}>
              <label>
                เลขที่ใบเสร็จ / ใบกำกับภาษี
                <input
                  value={invoice}
                  onChange={(e) => setInvoice(e.target.value)}
                />
              </label>
              <label>
                วันที่จ่ายจริง
                <input
                  disabled={locked}
                  type="date"
                  value={paidDate}
                  onChange={(e) => setPaidDate(e.target.value)}
                />
              </label>
              <label>
                วิธีจ่าย
                <select
                  disabled={locked}
                  value={payment}
                  onChange={(e) => setPayment(e.target.value)}
                >
                  <option value="">ยังไม่ระบุ</option>
                  {PAYMENT_METHODS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                สถานะเอกสาร
                <select
                  disabled={locked}
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="DRAFT">ฉบับร่าง — ยังไม่นับยอด</option>
                  <option value="CONFIRMED">ยืนยันรายจ่าย</option>
                  {voided && <option value="VOIDED">ยกเลิกแล้ว</option>}
                </select>
              </label>
            </div>
            <p className={css.muted}>
              หากยังไม่จ่าย ให้เว้นวันที่จ่ายไว้ รายงานจะแสดงค้างจ่าย
              แยกจากสถานะเอกสาร
            </p>
            <label>
              หมายเหตุ
              <textarea
                value={notes}
                rows={2}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
            <div style={{ marginTop: 16 }}>
              <ExpenseAttachments
                attachments={attachments}
                onChange={setAttachments}
                borderColor="#E8D8CC"
                textColor="#3B2A24"
                mutedColor="#765d50"
                primaryColor="#8B1D24"
              />
            </div>
          </fieldset>
          {error && (
            <p className={css.error} role="alert">
              {error}
            </p>
          )}
          {!voided && (
            <div className={css.toolbar}>
              <button
                type="submit"
                className={css.primary}
                disabled={busy || !!calculationError}
              >
                {busy ? "กำลังบันทึก…" : "บันทึกรายจ่าย"}
              </button>
              <Link href={basePath}>กลับรายการ</Link>
            </div>
          )}
          {i?.id && (
            <FinanceHistory
              query={new URLSearchParams({
                entity: "EXPENSE",
                recordId: i.id,
              }).toString()}
            />
          )}
          {i?.id && (!locked || i.canVoidLegacyMonthly) && !voided && (
            <details>
              <summary>ยกเลิกเอกสาร (เจ้าของ)</summary>
              <label>
                เหตุผลยกเลิก
                <input
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                />
              </label>
              <button
                type="button"
                disabled={busy || !voidReason.trim()}
                onClick={voidExpense}
              >
                ยกเลิกรายจ่ายและเก็บประวัติ
              </button>
            </details>
          )}
        </form>
      )}
    </main>
  );
}
