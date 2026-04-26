"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { Plus, Pencil, Trash2, ChevronDown, ChevronUp, X, Save, Check } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BranchInfo {
  id: string;
  name: string;
}

interface BranchServiceRow {
  id: string;
  branchId: string;
  price: number;      // satang
  duration: number;   // minutes
  isActive: boolean;
  branch: BranchInfo;
}

interface ServiceItem {
  id: string;
  name: string;
  nameTh: string;
  category: string;
  advanceBookingRequired: boolean;
  memberPrice: number | null;
  isActive: boolean;
  branches: BranchServiceRow[];
}

interface Props {
  services: ServiceItem[];
  branches: BranchInfo[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function baht(satang: number) {
  return satang / 100;
}
function satang(baht: number) {
  return Math.round(Number(baht) * 100);
}
function fmt(satang: number) {
  return `฿${(satang / 100).toLocaleString("th-TH")}`;
}

const CATEGORIES = [
  "Hair Cut", "Hair Color", "Hair Treatment", "Nail", "Facial", "Massage", "Eyelash", "Eyebrow", "Other",
];

const PRIMARY = "#8B1D24";
const BG      = "#FDF7F2";
const BORDER  = "#E8D8CC";
const TEXT    = "#3B2A24";
const MUTED   = "#A08070";

// ─── Portal modal wrapper ─────────────────────────────────────────────────────

function Modal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}

// ─── Per-branch pricing row inside the edit form ──────────────────────────────

interface BranchPricingRowProps {
  branch: BranchInfo;
  price: string;
  duration: string;
  isActive: boolean;
  onChange: (field: "price" | "duration" | "isActive", value: string | boolean) => void;
}

function BranchPricingRow({ branch, price, duration, isActive, onChange }: BranchPricingRowProps) {
  return (
    <div className="flex items-center gap-3 py-2 border-b last:border-0" style={{ borderColor: BORDER }}>
      <div className="w-28 text-sm font-medium truncate" style={{ color: TEXT }}>{branch.name}</div>

      <div className="flex-1 flex items-center gap-2">
        <div className="flex items-center gap-1">
          <span className="text-xs" style={{ color: MUTED }}>฿</span>
          <input
            type="number"
            min="0"
            step="50"
            value={price}
            onChange={e => onChange("price", e.target.value)}
            disabled={!isActive}
            className="w-24 px-2 py-1 text-sm rounded-lg border text-right"
            style={{ borderColor: BORDER, color: isActive ? TEXT : MUTED, background: isActive ? "white" : "#F9F3EE" }}
          />
        </div>
        <div className="flex items-center gap-1">
          <input
            type="number"
            min="15"
            step="15"
            value={duration}
            onChange={e => onChange("duration", e.target.value)}
            disabled={!isActive}
            className="w-16 px-2 py-1 text-sm rounded-lg border text-right"
            style={{ borderColor: BORDER, color: isActive ? TEXT : MUTED, background: isActive ? "white" : "#F9F3EE" }}
          />
          <span className="text-xs" style={{ color: MUTED }}>นาที</span>
        </div>
      </div>

      {/* active toggle */}
      <button
        type="button"
        onClick={() => onChange("isActive", !isActive)}
        className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors"
        style={{
          background: isActive ? "#EFF6EE" : "#F9F3EE",
          color: isActive ? "#2D7A3A" : MUTED,
          border: `1px solid ${isActive ? "#B6DDB9" : BORDER}`,
        }}
      >
        {isActive ? <Check size={11} /> : <X size={11} />}
        {isActive ? "เปิด" : "ปิด"}
      </button>
    </div>
  );
}

// ─── Service form modal (add + edit) ─────────────────────────────────────────

interface ServiceFormProps {
  initial?: ServiceItem;
  branches: BranchInfo[];
  onClose: () => void;
  onSaved: () => void;
}

type BranchPricingState = Record<string, { price: string; duration: string; isActive: boolean }>;

function ServiceFormModal({ initial, branches, onClose, onSaved }: ServiceFormProps) {
  const isEdit = !!initial;

  const [name, setName]         = useState(initial?.name ?? "");
  const [nameTh, setNameTh]     = useState(initial?.nameTh ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [customCat, setCustomCat] = useState(
    initial?.category && !CATEGORIES.includes(initial.category) ? initial.category : "",
  );
  const [advance, setAdvance]   = useState(initial?.advanceBookingRequired ?? false);
  const [memberPrice, setMemberPrice] = useState(
    initial?.memberPrice ? String(baht(initial.memberPrice)) : "",
  );

  // build branch pricing state keyed by branchId
  const initBranchPricing = (): BranchPricingState => {
    const m: BranchPricingState = {};
    branches.forEach(b => {
      const existing = initial?.branches.find(bs => bs.branchId === b.id);
      m[b.id] = {
        price:    existing ? String(baht(existing.price))   : "",
        duration: existing ? String(existing.duration)       : "60",
        isActive: existing ? existing.isActive               : true,
      };
    });
    return m;
  };
  const [branchPricing, setBranchPricing] = useState<BranchPricingState>(initBranchPricing);

  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  const effectiveCategory = category === "__custom__" ? customCat : category;

  function updateBranch(branchId: string, field: "price" | "duration" | "isActive", value: string | boolean) {
    setBranchPricing(prev => ({
      ...prev,
      [branchId]: { ...prev[branchId], [field]: value },
    }));
  }

  async function handleSave() {
    if (!name.trim()) { setError("กรุณากรอกชื่อบริการ (ภาษาอังกฤษ)"); return; }
    if (!effectiveCategory.trim()) { setError("กรุณาเลือกหมวดหมู่"); return; }

    const pricingRows = branches
      .filter(b => branchPricing[b.id]?.price)
      .map(b => ({
        branchId: b.id,
        price:    Number(branchPricing[b.id].price),
        duration: Number(branchPricing[b.id].duration) || 60,
        isActive: branchPricing[b.id].isActive,
      }));

    setSaving(true);
    setError("");

    try {
      if (isEdit) {
        // 1. update service metadata
        const r1 = await fetch(`/api/admin/services/${initial!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            nameTh: nameTh.trim(),
            category: effectiveCategory.trim(),
            advanceBookingRequired: advance,
            memberPrice: memberPrice ? Number(memberPrice) : null,
          }),
        });
        if (!r1.ok) throw new Error((await r1.json()).error);

        // 2. upsert branch pricing
        if (pricingRows.length > 0) {
          const r2 = await fetch(`/api/admin/services/${initial!.id}/branches`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(pricingRows),
          });
          if (!r2.ok) throw new Error((await r2.json()).error);
        }
      } else {
        // create
        const r = await fetch("/api/admin/services", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            nameTh: nameTh.trim(),
            category: effectiveCategory.trim(),
            advanceBookingRequired: advance,
            memberPrice: memberPrice ? Number(memberPrice) : null,
            branchPricing: pricingRows,
          }),
        });
        if (!r.ok) throw new Error((await r.json()).error);
      }
      onSaved();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal>
      <div
        className="fixed inset-0 flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.45)", zIndex: 99999 }}
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div
          className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          style={{ background: "white", maxHeight: "90vh" }}
        >
          {/* header */}
          <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: BORDER }}>
            <h2 className="font-semibold text-base" style={{ color: TEXT }}>
              {isEdit ? "แก้ไขบริการ" : "เพิ่มบริการใหม่"}
            </h2>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
              <X size={18} color={MUTED} />
            </button>
          </div>

          {/* body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            {/* Service name */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs mb-1 font-medium" style={{ color: MUTED }}>ชื่อ (ภาษาไทย)</label>
                <input
                  value={nameTh}
                  onChange={e => setNameTh(e.target.value)}
                  placeholder="เช่น ตัดผม"
                  className="w-full px-3 py-2 text-sm rounded-lg border"
                  style={{ borderColor: BORDER, color: TEXT }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1 font-medium" style={{ color: MUTED }}>ชื่อ (English) *</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Hair Cut"
                  className="w-full px-3 py-2 text-sm rounded-lg border"
                  style={{ borderColor: BORDER, color: TEXT }}
                />
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs mb-1 font-medium" style={{ color: MUTED }}>หมวดหมู่ *</label>
              <select
                value={CATEGORIES.includes(category) ? category : category ? "__custom__" : ""}
                onChange={e => {
                  if (e.target.value === "__custom__") {
                    setCategory("__custom__");
                  } else {
                    setCategory(e.target.value);
                    setCustomCat("");
                  }
                }}
                className="w-full px-3 py-2 text-sm rounded-lg border"
                style={{ borderColor: BORDER, color: TEXT }}
              >
                <option value="">-- เลือกหมวดหมู่ --</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                <option value="__custom__">อื่นๆ (ระบุเอง)</option>
              </select>
              {(category === "__custom__" || (category && !CATEGORIES.includes(category))) && (
                <input
                  value={customCat}
                  onChange={e => setCustomCat(e.target.value)}
                  placeholder="ระบุหมวดหมู่"
                  className="mt-2 w-full px-3 py-2 text-sm rounded-lg border"
                  style={{ borderColor: BORDER, color: TEXT }}
                />
              )}
            </div>

            {/* Flags row */}
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={advance}
                  onChange={e => setAdvance(e.target.checked)}
                  className="w-4 h-4 accent-red-800"
                />
                <span className="text-sm" style={{ color: TEXT }}>ต้องจองล่วงหน้า</span>
              </label>
            </div>

            {/* Member price */}
            <div>
              <label className="block text-xs mb-1 font-medium" style={{ color: MUTED }}>ราคาสมาชิก (฿) — เว้นว่างถ้าไม่มี</label>
              <input
                type="number"
                min="0"
                step="50"
                value={memberPrice}
                onChange={e => setMemberPrice(e.target.value)}
                placeholder="เช่น 350"
                className="w-40 px-3 py-2 text-sm rounded-lg border"
                style={{ borderColor: BORDER, color: TEXT }}
              />
            </div>

            {/* Per-branch pricing */}
            <div>
              <label className="block text-xs mb-2 font-medium" style={{ color: MUTED }}>ราคา / ระยะเวลา ต่อสาขา</label>
              <div className="rounded-xl border p-3" style={{ borderColor: BORDER }}>
                {branches.map(b => (
                  <BranchPricingRow
                    key={b.id}
                    branch={b}
                    price={branchPricing[b.id]?.price ?? ""}
                    duration={branchPricing[b.id]?.duration ?? "60"}
                    isActive={branchPricing[b.id]?.isActive ?? true}
                    onChange={(field, value) => updateBranch(b.id, field, value)}
                  />
                ))}
              </div>
              <p className="text-xs mt-1" style={{ color: MUTED }}>เว้นว่าง "ราคา" ถ้าไม่ให้บริการที่สาขานั้น</p>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>

          {/* footer */}
          <div className="px-6 py-4 border-t flex justify-end gap-3" style={{ borderColor: BORDER }}>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-xl border font-medium"
              style={{ borderColor: BORDER, color: MUTED }}
            >
              ยกเลิก
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 text-sm rounded-xl font-medium text-white"
              style={{ background: saving ? MUTED : PRIMARY }}
            >
              <Save size={15} />
              {saving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─── Delete confirm dialog ────────────────────────────────────────────────────

function DeleteConfirm({ service, onConfirm, onCancel, loading }: {
  service: ServiceItem;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <Modal>
      <div
        className="fixed inset-0 flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.45)", zIndex: 99999 }}
        onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
      >
        <div className="w-full max-w-sm rounded-2xl shadow-2xl p-6" style={{ background: "white" }}>
          <h3 className="font-semibold text-base mb-2" style={{ color: TEXT }}>ลบบริการ</h3>
          <p className="text-sm mb-5" style={{ color: MUTED }}>
            ต้องการปิดบริการ <span className="font-semibold" style={{ color: TEXT }}>&ldquo;{service.nameTh || service.name}&rdquo;</span> ใช่หรือไม่?
            (สามารถเปิดใหม่ได้ภายหลัง)
          </p>
          <div className="flex justify-end gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm rounded-xl border"
              style={{ borderColor: BORDER, color: MUTED }}
            >ยกเลิก</button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className="px-4 py-2 text-sm rounded-xl font-medium text-white"
              style={{ background: "#C0392B" }}
            >{loading ? "..." : "ลบบริการ"}</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─── Single service card ──────────────────────────────────────────────────────

function ServiceCard({
  service,
  onEdit,
  onDelete,
}: {
  service: ServiceItem;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const activeBranches = service.branches.filter(b => b.isActive);

  return (
    <div className="border rounded-2xl overflow-hidden" style={{ borderColor: BORDER, background: "white" }}>
      {/* main row */}
      <div className="flex items-center gap-4 px-5 py-4">
        {/* text */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm" style={{ color: TEXT }}>
            {service.nameTh || service.name}
          </p>
          {service.nameTh && (
            <p className="text-xs" style={{ color: MUTED }}>{service.name}</p>
          )}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: "#F9F0E8", color: PRIMARY }}
            >
              {service.category}
            </span>
            {service.advanceBookingRequired && (
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#FFF3E0", color: "#E67E22" }}>
                จองล่วงหน้า
              </span>
            )}
            {!service.isActive && (
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#F9F3EE", color: MUTED }}>
                ปิดใช้งาน
              </span>
            )}
          </div>
        </div>

        {/* branch count */}
        <div className="text-right flex-shrink-0 hidden sm:block">
          <p className="text-xs" style={{ color: MUTED }}>{activeBranches.length} สาขา</p>
          {activeBranches.length > 0 && (
            <p className="text-xs font-medium" style={{ color: TEXT }}>
              {fmt(Math.min(...activeBranches.map(b => b.price)))}
              {activeBranches.length > 1 && ` – ${fmt(Math.max(...activeBranches.map(b => b.price)))}`}
            </p>
          )}
        </div>

        {/* actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setExpanded(x => !x)}
            className="p-2 rounded-xl hover:bg-gray-50 transition-colors"
            title={expanded ? "ซ่อน" : "ดูราคาต่อสาขา"}
          >
            {expanded ? <ChevronUp size={16} color={MUTED} /> : <ChevronDown size={16} color={MUTED} />}
          </button>
          <button
            onClick={onEdit}
            className="p-2 rounded-xl hover:bg-blue-50 transition-colors"
            title="แก้ไข"
          >
            <Pencil size={15} color="#2563EB" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 rounded-xl hover:bg-red-50 transition-colors"
            title="ลบ"
          >
            <Trash2 size={15} color="#C0392B" />
          </button>
        </div>
      </div>

      {/* expanded branch pricing */}
      {expanded && (
        <div className="border-t px-5 py-3" style={{ borderColor: BORDER, background: BG }}>
          {service.branches.length === 0 ? (
            <p className="text-xs py-1" style={{ color: MUTED }}>ยังไม่ได้ตั้งราคา กด แก้ไข เพื่อเพิ่ม</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr style={{ color: MUTED }}>
                  <th className="text-left pb-1 font-medium">สาขา</th>
                  <th className="text-right pb-1 font-medium">ราคา</th>
                  <th className="text-right pb-1 font-medium">เวลา</th>
                  <th className="text-center pb-1 font-medium">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {service.branches.map(bs => (
                  <tr key={bs.id} style={{ color: bs.isActive ? TEXT : MUTED }}>
                    <td className="py-0.5">{bs.branch.name}</td>
                    <td className="text-right">{fmt(bs.price)}</td>
                    <td className="text-right">{bs.duration} นาที</td>
                    <td className="text-center">
                      {bs.isActive ? (
                        <span className="inline-flex items-center gap-1 text-green-700"><Check size={11} />เปิด</span>
                      ) : (
                        <span style={{ color: MUTED }}>ปิด</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ServicesManager({ services: initialServices, branches }: Props) {
  const router = useRouter();
  const [services, setServices] = useState<ServiceItem[]>(initialServices);
  const [showAdd, setShowAdd]   = useState(false);
  const [editing, setEditing]   = useState<ServiceItem | null>(null);
  const [deleting, setDeleting] = useState<ServiceItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showInactive, setShowInactive]   = useState(false);

  function refresh() {
    router.refresh();
    // also fetch fresh data
    fetch("/api/admin/services")
      .then(r => r.json())
      .then(setServices);
  }

  async function handleDelete() {
    if (!deleting) return;
    setDeleteLoading(true);
    await fetch(`/api/admin/services/${deleting.id}`, { method: "DELETE" });
    setDeleteLoading(false);
    setDeleting(null);
    refresh();
  }

  const visible = showInactive ? services : services.filter(s => s.isActive);

  // group by category
  const byCategory = visible.reduce<Record<string, ServiceItem[]>>((acc, s) => {
    (acc[s.category] ??= []).push(s);
    return acc;
  }, {});

  return (
    <div className="px-6 py-8 max-w-3xl">
      {/* header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: MUTED }}>Service Menu</p>
          <h1 className="text-2xl font-medium" style={{ color: TEXT }}>รายการบริการ</h1>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none" style={{ color: MUTED }}>
            <input
              type="checkbox"
              checked={showInactive}
              onChange={e => setShowInactive(e.target.checked)}
              className="w-4 h-4"
            />
            แสดงที่ปิดแล้ว
          </label>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white"
            style={{ background: PRIMARY }}
          >
            <Plus size={16} />
            เพิ่มบริการ
          </button>
        </div>
      </div>

      {/* service list by category */}
      {Object.keys(byCategory).length === 0 ? (
        <div className="text-center py-16" style={{ color: MUTED }}>
          <p className="text-sm">ยังไม่มีบริการ กดเพิ่มบริการเพื่อเริ่มต้น</p>
        </div>
      ) : (
        Object.entries(byCategory)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([cat, items]) => (
            <div key={cat} className="mb-6">
              <h2
                className="text-xs uppercase tracking-widest mb-3 font-semibold"
                style={{ color: PRIMARY }}
              >
                {cat}
              </h2>
              <div className="space-y-2">
                {items.map(s => (
                  <ServiceCard
                    key={s.id}
                    service={s}
                    onEdit={() => setEditing(s)}
                    onDelete={() => setDeleting(s)}
                  />
                ))}
              </div>
            </div>
          ))
      )}

      {/* Add modal */}
      {showAdd && (
        <ServiceFormModal
          branches={branches}
          onClose={() => setShowAdd(false)}
          onSaved={refresh}
        />
      )}

      {/* Edit modal */}
      {editing && (
        <ServiceFormModal
          initial={editing}
          branches={branches}
          onClose={() => setEditing(null)}
          onSaved={refresh}
        />
      )}

      {/* Delete confirm */}
      {deleting && (
        <DeleteConfirm
          service={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
          loading={deleteLoading}
        />
      )}
    </div>
  );
}
