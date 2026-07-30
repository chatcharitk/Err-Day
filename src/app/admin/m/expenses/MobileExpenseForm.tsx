"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Upload, FileEdit, Sparkles, Plus, Trash2, ImageIcon } from "lucide-react";
import { EXPENSE_CATEGORY_GROUPS, PAYMENT_METHODS } from "@/lib/expenses";
import { resizeImageFile } from "@/lib/resize-image";

const PRIMARY = "#8B1D24";
const TEXT    = "#3B2A24";
const MUTED   = "#A08070";
const BORDER  = "#E8D8CC";
const BG      = "#FDF8F3";

interface Branch { id: string; name: string }
interface LineItem {
  description: string;
  quantity:    number;
  unitPrice:   number;   // baht
  totalPrice:  number;   // baht
}
interface InitialExpense {
  id?:            string;
  branchId?:      string | null;
  category?:      string;
  vendor?:        string | null;
  date?:          string;
  totalAmount?:   number;             // satang
  vatAmount?:     number | null;      // satang
  paymentMethod?: string | null;
  receiptUrl?:    string | null;
  notes?:         string | null;
  items?:         { description: string; quantity: number; unitPrice: number; totalPrice: number }[];  // satang
}
interface Props {
  mode:     "create" | "edit";
  branches: Branch[];
  initial?: InitialExpense;
}

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const bahtToSatang = (b: number) => Math.round(b * 100);
const satangToBaht = (s: number) => s / 100;


export default function MobileExpenseForm({ mode, branches, initial }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tab,           setTab]           = useState<"upload" | "manual">(
    mode === "edit" || initial?.category ? "manual" : "upload",
  );
  const [branchId,      setBranchId]      = useState(initial?.branchId ?? "");
  const [category,      setCategory]      = useState(initial?.category ?? "other");
  const [vendor,        setVendor]        = useState(initial?.vendor ?? "");
  const [date,          setDate]          = useState(initial?.date ?? todayYmd());
  const [totalBaht,     setTotalBaht]     = useState<number | "">(initial?.totalAmount != null ? satangToBaht(initial.totalAmount) : "");
  const [vatBaht,       setVatBaht]       = useState<number | "">(initial?.vatAmount != null ? satangToBaht(initial.vatAmount) : "");
  const [paymentMethod, setPaymentMethod] = useState(initial?.paymentMethod ?? "");
  const [receiptUrl,    setReceiptUrl]    = useState<string | null>(initial?.receiptUrl ?? null);
  const [notes,         setNotes]         = useState(initial?.notes ?? "");
  const [items,         setItems]         = useState<LineItem[]>(
    (initial?.items ?? []).map(it => ({
      description: it.description,
      quantity:    it.quantity,
      unitPrice:   satangToBaht(it.unitPrice),
      totalPrice:  satangToBaht(it.totalPrice),
    })),
  );

  const [scanning, setScanning] = useState(false);
  const [scanMsg,  setScanMsg]  = useState<string | null>(null);
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error,    setError]    = useState("");

  // ── Upload + OCR ─────────────────────────────────────────────────────────
  async function handleScanFile(file: File) {
    setScanning(true); setScanMsg(null); setError("");
    const resized = await resizeImageFile(file);   // shrink to fit the 4.5MB upload limit
    const form = new FormData();
    form.append("file", resized);
    try {
      const res = await fetch("/api/admin/expenses/scan", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "upload failed");
      if (data.receiptUrl) setReceiptUrl(data.receiptUrl);
      if (data.parsed) {
        const p = data.parsed;
        if (p.vendor)              setVendor(p.vendor);
        if (p.date)                setDate(p.date);
        if (p.totalAmount != null) setTotalBaht(p.totalAmount);
        if (p.vatAmount   != null) setVatBaht(p.vatAmount);
        if (p.paymentMethod)       setPaymentMethod(p.paymentMethod);
        if (p.category)            setCategory(p.category);
        if (p.notes)               setNotes(p.notes);
        if (Array.isArray(p.items) && p.items.length > 0) {
          setItems(p.items.map((it: LineItem) => ({
            description: it.description,
            quantity:    it.quantity,
            unitPrice:   it.unitPrice,
            totalPrice:  it.totalPrice,
          })));
        }
        setScanMsg("✓ AI อ่านข้อมูลแล้ว — ตรวจสอบและแก้ไขก่อนบันทึก");
        setTab("manual");
      } else {
        setScanMsg("⚠️ AI อ่านไม่ออก — กรอกข้อมูลด้วยตัวเอง (รูปอัปโหลดแล้ว)");
        setTab("manual");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "scan failed");
    } finally {
      setScanning(false);
    }
  }

  // ── Submit ───────────────────────────────────────────────────────────────
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (typeof totalBaht !== "number" || totalBaht <= 0) {
      setError("กรุณากรอกจำนวนเงินรวม");
      return;
    }
    setSaving(true);
    const payload = {
      branchId:      branchId || null,
      category,
      vendor:        vendor.trim() || null,
      date,
      totalAmount:   bahtToSatang(totalBaht),
      vatAmount:     vatBaht !== "" ? bahtToSatang(vatBaht as number) : null,
      paymentMethod: paymentMethod || null,
      receiptUrl,
      notes:         notes.trim() || null,
      status:        "CONFIRMED",
      items: items.length > 0 ? items.map(it => ({
        description: it.description,
        quantity:    it.quantity,
        unitPrice:   bahtToSatang(it.unitPrice),
        totalPrice:  bahtToSatang(it.totalPrice),
      })) : undefined,
    };
    const url    = mode === "edit" && initial?.id ? `/api/admin/expenses/${initial.id}` : "/api/admin/expenses";
    const method = mode === "edit" ? "PATCH" : "POST";
    const res = await fetch(url, {
      method, headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "บันทึกไม่สำเร็จ");
      return;
    }
    router.push("/admin/m/expenses");
    router.refresh();
  }

  // ── Delete (edit mode only) ──────────────────────────────────────────────
  async function handleDelete() {
    if (!initial?.id) return;
    if (!confirm("ลบรายจ่ายนี้?")) return;
    setDeleting(true);
    const res = await fetch(`/api/admin/expenses/${initial.id}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) { setError("ลบไม่สำเร็จ"); return; }
    router.push("/admin/m/expenses");
    router.refresh();
  }

  // ── Item helpers ─────────────────────────────────────────────────────────
  function addItem() { setItems(prev => [...prev, { description: "", quantity: 1, unitPrice: 0, totalPrice: 0 }]); }
  function removeItem(idx: number) { setItems(prev => prev.filter((_, i) => i !== idx)); }
  function updateItem(idx: number, key: keyof LineItem, value: string | number) {
    setItems(prev => prev.map((it, i) => {
      if (i !== idx) return it;
      const updated = { ...it, [key]: value };
      if (key === "quantity" || key === "unitPrice") {
        const q = Number(key === "quantity"  ? value : it.quantity)  || 0;
        const u = Number(key === "unitPrice" ? value : it.unitPrice) || 0;
        updated.totalPrice = Math.round(q * u * 100) / 100;
      }
      return updated;
    }));
  }

  return (
    <main className="min-h-screen pb-12" style={{ background: BG }}>
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <div className="px-4 py-3 flex items-center gap-3">
          <Link href="/admin/m/expenses" className="w-9 h-9 flex items-center justify-center rounded-full" style={{ color: TEXT }}>
            <ArrowLeft size={20} />
          </Link>
          <h1 className="flex-1 text-base font-semibold" style={{ color: TEXT }}>
            {mode === "edit" ? "แก้ไขรายจ่าย" : "เพิ่มรายจ่าย"}
          </h1>
        </div>
      </header>

      <div className="px-4 pt-4 pb-12 space-y-4">
        {/* Tabs */}
        {mode === "create" && (
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setTab("upload")}
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
              style={{
                background: tab === "upload" ? PRIMARY : "white",
                color:      tab === "upload" ? "white" : TEXT,
                border:     `1.5px solid ${tab === "upload" ? PRIMARY : BORDER}`,
              }}>
              <Upload size={14} /> AI อัปโหลด
            </button>
            <button onClick={() => setTab("manual")}
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
              style={{
                background: tab === "manual" ? PRIMARY : "white",
                color:      tab === "manual" ? "white" : TEXT,
                border:     `1.5px solid ${tab === "manual" ? PRIMARY : BORDER}`,
              }}>
              <FileEdit size={14} /> กรอกเอง
            </button>
          </div>
        )}

        {/* Upload pane */}
        {tab === "upload" && (
          <div className="bg-white rounded-2xl p-6 text-center" style={{ border: `2px dashed ${BORDER}` }}>
            <Sparkles size={28} className="mx-auto mb-3" style={{ color: PRIMARY }} />
            <h2 className="text-base font-semibold mb-1" style={{ color: TEXT }}>อัปโหลดใบเสร็จ</h2>
            <p className="text-xs mb-4" style={{ color: MUTED }}>
              AI จะกรอกฟอร์มให้ คุณตรวจสอบและแก้ไขก่อนบันทึก
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleScanFile(f);
                e.target.value = "";
              }}
            />
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={scanning}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50"
              style={{ background: PRIMARY }}>
              <Upload size={16} />
              {scanning ? "กำลังอ่าน..." : "ถ่ายรูป / เลือกใบเสร็จ"}
            </button>
            <p className="text-[10px] mt-3" style={{ color: MUTED }}>JPEG / PNG / WebP สูงสุด 8MB</p>
            {scanMsg && <p className="text-xs mt-3 font-medium" style={{ color: PRIMARY }}>{scanMsg}</p>}
            {error   && <p className="text-xs mt-3 text-red-600">{error}</p>}
          </div>
        )}

        {/* Manual form */}
        {tab === "manual" && (
          <form onSubmit={submit} className="bg-white rounded-2xl p-4 space-y-4" style={{ border: `1px solid ${BORDER}` }}>
            {scanMsg && (
              <p className="text-xs font-medium px-3 py-2 rounded-lg" style={{ background: "#FFF8F4", color: PRIMARY }}>
                {scanMsg}
              </p>
            )}

            {/* Branch */}
            <div>
              <label className="text-[10px] uppercase tracking-widest block mb-1" style={{ color: MUTED }}>สาขา</label>
              <select value={branchId} onChange={e => setBranchId(e.target.value)}
                className="w-full border rounded-lg px-3 py-2.5 text-sm" style={{ borderColor: BORDER, color: TEXT }}>
                <option value="">ส่วนกลาง / HQ</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>

            {/* Category */}
            <div>
              <label className="text-[10px] uppercase tracking-widest block mb-1" style={{ color: MUTED }}>หมวด *</label>
              <select value={category} onChange={e => setCategory(e.target.value)} required
                className="w-full border rounded-lg px-3 py-2.5 text-sm" style={{ borderColor: BORDER, color: TEXT }}>
                {EXPENSE_CATEGORY_GROUPS.map(group => (
                  <optgroup key={group.label} label={group.label}>
                    {group.categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>

            {/* Vendor */}
            <div>
              <label className="text-[10px] uppercase tracking-widest block mb-1" style={{ color: MUTED }}>ผู้รับเงิน / ร้านค้า / พนักงาน</label>
              <input value={vendor} onChange={e => setVendor(e.target.value)} placeholder="เช่น ชื่อร้าน ผู้ให้เช่า หรือชื่อพนักงาน"
                className="w-full border rounded-lg px-3 py-2.5 text-sm" style={{ borderColor: BORDER, color: TEXT }} />
            </div>

            {/* Date */}
            <div>
              <label className="text-[10px] uppercase tracking-widest block mb-1" style={{ color: MUTED }}>วันที่ *</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} required
                className="w-full border rounded-lg px-3 py-2.5 text-sm" style={{ borderColor: BORDER, color: TEXT }} />
            </div>

            {/* Total + VAT */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase tracking-widest block mb-1" style={{ color: MUTED }}>รวม (฿) *</label>
                <input type="number" inputMode="decimal" step="0.01" min="0" required
                  value={totalBaht} onChange={e => setTotalBaht(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="0.00"
                  className="w-full border rounded-lg px-3 py-2.5 text-sm font-semibold" style={{ borderColor: BORDER, color: TEXT }} />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest block mb-1" style={{ color: MUTED }}>VAT (฿)</label>
                <input type="number" inputMode="decimal" step="0.01" min="0"
                  value={vatBaht} onChange={e => setVatBaht(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="0.00"
                  className="w-full border rounded-lg px-3 py-2.5 text-sm" style={{ borderColor: BORDER, color: TEXT }} />
              </div>
            </div>

            {/* Payment method */}
            <div>
              <label className="text-[10px] uppercase tracking-widest block mb-1" style={{ color: MUTED }}>วิธีจ่าย</label>
              <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
                className="w-full border rounded-lg px-3 py-2.5 text-sm" style={{ borderColor: BORDER, color: TEXT }}>
                <option value="">ไม่ระบุ</option>
                {PAYMENT_METHODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>

            {/* Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>รายการ (ไม่บังคับ)</label>
                <button type="button" onClick={addItem}
                  className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md" style={{ color: PRIMARY }}>
                  <Plus size={12} /> เพิ่ม
                </button>
              </div>
              {items.length === 0 ? (
                <p className="text-xs italic" style={{ color: MUTED }}>ไม่มีรายการย่อย</p>
              ) : (
                <div className="space-y-3">
                  {items.map((it, idx) => (
                    <div key={idx} className="bg-stone-50 rounded-lg p-2.5 space-y-2"
                      style={{ border: `1px solid ${BORDER}` }}>
                      <div className="flex items-center gap-2">
                        <input value={it.description} onChange={e => updateItem(idx, "description", e.target.value)}
                          placeholder="รายการ"
                          className="flex-1 border rounded-md px-2 py-1.5 text-sm bg-white" style={{ borderColor: BORDER, color: TEXT }} />
                        <button type="button" onClick={() => removeItem(idx)}
                          className="p-1.5 rounded-md hover:bg-red-50" title="ลบ">
                          <Trash2 size={14} className="text-red-500" />
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-[9px] block mb-0.5" style={{ color: MUTED }}>จำนวน</label>
                          <input type="number" inputMode="decimal" step="0.5" min="0" value={it.quantity}
                            onChange={e => updateItem(idx, "quantity", Number(e.target.value))}
                            className="w-full border rounded-md px-2 py-1.5 text-sm bg-white" style={{ borderColor: BORDER, color: TEXT }} />
                        </div>
                        <div>
                          <label className="text-[9px] block mb-0.5" style={{ color: MUTED }}>ราคา/หน่วย</label>
                          <input type="number" inputMode="decimal" step="0.01" min="0" value={it.unitPrice}
                            onChange={e => updateItem(idx, "unitPrice", Number(e.target.value))}
                            className="w-full border rounded-md px-2 py-1.5 text-sm bg-white" style={{ borderColor: BORDER, color: TEXT }} />
                        </div>
                        <div>
                          <label className="text-[9px] block mb-0.5" style={{ color: MUTED }}>รวม</label>
                          <input type="number" inputMode="decimal" step="0.01" min="0" value={it.totalPrice}
                            onChange={e => updateItem(idx, "totalPrice", Number(e.target.value))}
                            className="w-full border rounded-md px-2 py-1.5 text-sm bg-white font-semibold" style={{ borderColor: BORDER, color: TEXT }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="text-[10px] uppercase tracking-widest block mb-1" style={{ color: MUTED }}>หมายเหตุ</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                placeholder="ข้อมูลเพิ่มเติม (ไม่บังคับ)"
                className="w-full border rounded-lg px-3 py-2 text-sm resize-none" style={{ borderColor: BORDER, color: TEXT }} />
            </div>

            {/* Receipt preview */}
            {receiptUrl && (
              <div>
                <label className="text-[10px] uppercase tracking-widest block mb-1" style={{ color: MUTED }}>รูปใบเสร็จ</label>
                <a href={receiptUrl} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-lg border"
                  style={{ borderColor: BORDER, color: PRIMARY }}>
                  <ImageIcon size={14} /> ดูรูปใบเสร็จ
                </a>
              </div>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex flex-col gap-2 pt-2">
              <button type="submit" disabled={saving}
                className="w-full py-3 rounded-xl text-white text-sm font-bold disabled:opacity-50"
                style={{ background: PRIMARY }}>
                {saving ? "กำลังบันทึก..." : (mode === "edit" ? "บันทึกการแก้ไข" : "บันทึกรายจ่าย")}
              </button>
              {mode === "edit" && (
                <button type="button" onClick={handleDelete} disabled={deleting}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold border disabled:opacity-50"
                  style={{ borderColor: "#FECACA", color: "#DC2626", background: "white" }}>
                  {deleting ? "กำลังลบ..." : "🗑️ ลบรายจ่ายนี้"}
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
