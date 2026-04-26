"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Plus, Pencil, Trash2, Save, X, Users, Tag, Clock, Zap } from "lucide-react";

const PRIMARY = "#8B1D24";
const BORDER  = "#E8D8CC";
const TEXT    = "#3B2A24";
const MUTED   = "#A08070";
const BG      = "#FDF7F2";

interface Tier {
  id:              string;
  name:            string;
  nameTh:          string;
  minPoints:       number;
  discountPercent: number;
  color:           string;
  validityDays:    number;
  maxUsages:       number;
  isActive:        boolean;
  _count:          { memberships: number };
}

function Modal({ children }: { children: React.ReactNode }) {
  const [m, setM] = useState(false);
  useEffect(() => { setM(true); }, []);
  if (!m) return null;
  return createPortal(children, document.body);
}

const PRESET_COLORS = [
  "#6b7280", "#8B1D24", "#D97706", "#059669", "#2563EB", "#7C3AED", "#DB2777",
];

function TierForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Partial<Tier>;
  onSave: (data: Omit<Tier, "id" | "_count">) => Promise<void>;
  onCancel: () => void;
}) {
  const [name,            setName]            = useState(initial?.name            ?? "");
  const [nameTh,          setNameTh]          = useState(initial?.nameTh          ?? "");
  const [discountPercent, setDiscountPercent] = useState(initial?.discountPercent ?? 10);
  const [color,           setColor]           = useState(initial?.color           ?? "#8B1D24");
  const [validityDays,    setValidityDays]    = useState(initial?.validityDays    ?? 30);
  const [maxUsages,       setMaxUsages]       = useState(initial?.maxUsages       ?? 0);
  const [saving,          setSaving]          = useState(false);
  const [error,           setError]           = useState("");

  async function submit() {
    if (!name.trim() || !nameTh.trim()) { setError("กรุณากรอกชื่อ"); return; }
    setSaving(true);
    setError("");
    try {
      await onSave({
        name: name.trim(), nameTh: nameTh.trim(),
        minPoints: 0, discountPercent, color,
        validityDays, maxUsages,
        isActive: initial?.isActive ?? true,
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs mb-1 font-medium" style={{ color: MUTED }}>ชื่อภาษาไทย *</label>
          <input value={nameTh} onChange={e => setNameTh(e.target.value)}
            placeholder="เช่น โกลด์"
            className="w-full px-3 py-2 text-sm rounded-xl border"
            style={{ borderColor: BORDER, color: TEXT }} />
        </div>
        <div>
          <label className="block text-xs mb-1 font-medium" style={{ color: MUTED }}>ชื่อภาษาอังกฤษ *</label>
          <input value={name} onChange={e => setName(e.target.value)}
            placeholder="e.g. Gold"
            className="w-full px-3 py-2 text-sm rounded-xl border"
            style={{ borderColor: BORDER, color: TEXT }} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs mb-1 font-medium" style={{ color: MUTED }}>ส่วนลด (%)</label>
          <input value={discountPercent} type="number" min={0} max={100}
            onChange={e => setDiscountPercent(Number(e.target.value))}
            className="w-full px-3 py-2 text-sm rounded-xl border"
            style={{ borderColor: BORDER, color: TEXT }} />
        </div>
        <div>
          <label className="block text-xs mb-1 font-medium" style={{ color: MUTED }}>
            อายุสมาชิก (วัน, 0 = ไม่หมดอายุ)
          </label>
          <input value={validityDays} type="number" min={0}
            onChange={e => setValidityDays(Number(e.target.value))}
            className="w-full px-3 py-2 text-sm rounded-xl border"
            style={{ borderColor: BORDER, color: TEXT }} />
        </div>
      </div>

      <div>
        <label className="block text-xs mb-1 font-medium" style={{ color: MUTED }}>
          จำนวนครั้งที่ใช้ส่วนลดได้ (0 = ไม่จำกัด)
        </label>
        <input value={maxUsages} type="number" min={0}
          onChange={e => setMaxUsages(Number(e.target.value))}
          className="w-full px-3 py-2 text-sm rounded-xl border"
          style={{ borderColor: BORDER, color: TEXT }} />
      </div>

      <div>
        <label className="block text-xs mb-1 font-medium" style={{ color: MUTED }}>สี</label>
        <div className="flex gap-2 flex-wrap">
          {PRESET_COLORS.map(c => (
            <button key={c} type="button"
              onClick={() => setColor(c)}
              className="w-8 h-8 rounded-full border-2 transition-all"
              style={{
                background: c,
                borderColor: color === c ? "#3B2A24" : "transparent",
                transform: color === c ? "scale(1.2)" : "scale(1)",
              }}
            />
          ))}
          <input type="color" value={color} onChange={e => setColor(e.target.value)}
            className="w-8 h-8 rounded-full border cursor-pointer"
            style={{ padding: 0 }} title="เลือกสีเอง" />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onCancel}
          className="px-4 py-2 text-sm rounded-xl border font-medium"
          style={{ borderColor: BORDER, color: MUTED }}>
          ยกเลิก
        </button>
        <button onClick={submit} disabled={saving}
          className="flex items-center gap-2 px-5 py-2 text-sm rounded-xl font-medium text-white"
          style={{ background: saving ? MUTED : PRIMARY }}>
          <Save size={14} />
          {saving ? "กำลังบันทึก..." : "บันทึก"}
        </button>
      </div>
    </div>
  );
}

interface Props {
  tiers: Tier[];
}

export default function MembershipManager({ tiers: initial }: Props) {
  const [tiers,    setTiers]   = useState<Tier[]>(initial);
  const [showAdd,  setShowAdd] = useState(false);
  const [editId,   setEditId]  = useState<string | null>(null);

  async function handleCreate(data: Omit<Tier, "id" | "_count">) {
    const res = await fetch("/api/admin/membership-tiers", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(data),
    });
    if (!res.ok) throw new Error((await res.json()).error ?? "เกิดข้อผิดพลาด");
    const created = await res.json();
    setTiers(prev => [...prev, { ...created, _count: { memberships: 0 } }]);
    setShowAdd(false);
  }

  async function handleUpdate(id: string, data: Omit<Tier, "id" | "_count">) {
    const res = await fetch(`/api/admin/membership-tiers/${id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(data),
    });
    if (!res.ok) throw new Error((await res.json()).error ?? "เกิดข้อผิดพลาด");
    const updated = await res.json();
    setTiers(prev => prev.map(t => t.id === id ? { ...t, ...updated } : t));
    setEditId(null);
  }

  async function handleDelete(id: string) {
    if (!confirm("ต้องการปิดการใช้งานเทียร์นี้ใช่ไหม?")) return;
    const res = await fetch(`/api/admin/membership-tiers/${id}`, { method: "DELETE" });
    if (!res.ok) { alert("ไม่สามารถลบได้"); return; }
    setTiers(prev => prev.map(t => t.id === id ? { ...t, isActive: false } : t));
  }

  const activeTiers = tiers.filter(t => t.isActive);

  return (
    <div className="px-6 py-8 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: MUTED }}>Admin</p>
          <h1 className="text-2xl font-medium" style={{ color: TEXT }}>ระดับสมาชิก</h1>
          <p className="text-sm mt-0.5" style={{ color: MUTED }}>
            จัดการเทียร์, ส่วนลด, และอายุสมาชิก
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white"
          style={{ background: PRIMARY }}>
          <Plus size={16} /> เพิ่มเทียร์
        </button>
      </div>

      {/* Tiers list */}
      {activeTiers.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed p-12 text-center" style={{ borderColor: BORDER }}>
          <Tag className="w-8 h-8 mx-auto mb-3" style={{ color: MUTED }} />
          <p className="text-sm font-medium" style={{ color: MUTED }}>ยังไม่มีระดับสมาชิก</p>
          <p className="text-xs mt-1" style={{ color: MUTED }}>กด "+ เพิ่มเทียร์" เพื่อเริ่มต้น</p>
        </div>
      ) : (
        <div className="space-y-4">
          {activeTiers.map(tier => (
            <div key={tier.id}>
              {editId === tier.id ? (
                <div className="rounded-2xl bg-white p-5" style={{ border: `2px solid ${tier.color}` }}>
                  <p className="text-sm font-semibold mb-4" style={{ color: TEXT }}>
                    แก้ไขเทียร์: {tier.nameTh}
                  </p>
                  <TierForm
                    initial={tier}
                    onSave={data => handleUpdate(tier.id, data)}
                    onCancel={() => setEditId(null)}
                  />
                </div>
              ) : (
                <div
                  className="rounded-2xl bg-white p-5"
                  style={{ border: `1.5px solid ${BORDER}` }}
                >
                  <div className="flex items-start gap-4">
                    {/* Color dot */}
                    <div
                      className="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center"
                      style={{ background: tier.color + "22" }}
                    >
                      <span className="text-lg font-bold" style={{ color: tier.color }}>
                        {tier.nameTh[0]}
                      </span>
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold" style={{ color: TEXT }}>{tier.nameTh}</h3>
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ background: tier.color + "22", color: tier.color }}>
                          {tier.name}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                        <StatChip icon={<Zap size={12} />} label="ส่วนลด" value={`${tier.discountPercent}%`} />
                        <StatChip icon={<Clock size={12} />} label="อายุ"
                          value={tier.validityDays > 0 ? `${tier.validityDays} วัน` : "ไม่จำกัด"} />
                        <StatChip icon={<Tag size={12} />} label="ใช้ได้"
                          value={tier.maxUsages > 0 ? `${tier.maxUsages} ครั้ง` : "ไม่จำกัด"} />
                        <StatChip icon={<Users size={12} />} label="สมาชิก"
                          value={`${tier._count.memberships} คน`} />
                      </div>
                    </div>

                    <div className="flex gap-1">
                      <button onClick={() => setEditId(tier.id)}
                        className="p-2 rounded-lg hover:bg-gray-100"
                        title="แก้ไข">
                        <Pencil size={15} color={MUTED} />
                      </button>
                      <button onClick={() => handleDelete(tier.id)}
                        className="p-2 rounded-lg hover:bg-red-50"
                        title="ปิดใช้งาน">
                        <Trash2 size={15} color="#EF4444" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Link to Line membership status page */}
      <div className="mt-8 rounded-2xl p-4 bg-white" style={{ border: `1.5px solid ${BORDER}` }}>
        <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: PRIMARY }}>
          Line Integration
        </p>
        <p className="text-sm mb-2" style={{ color: TEXT }}>
          ลูกค้าสามารถดูสถานะสมาชิกผ่าน Line ได้ที่:
        </p>
        <code className="text-xs px-3 py-1.5 rounded-lg block" style={{ background: BG, color: PRIMARY }}>
          {typeof window !== "undefined" ? window.location.origin : "https://book.err-daysalon.com"}/liff/membership
        </code>
        <p className="text-xs mt-2" style={{ color: MUTED }}>
          เพิ่ม URL นี้ใน Line Official Account Rich Menu หรือ Messaging API
        </p>
      </div>

      {/* Add tier modal */}
      {showAdd && (
        <Modal>
          <div
            className="fixed inset-0 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.45)", zIndex: 99999 }}
            onClick={e => { if (e.target === e.currentTarget) setShowAdd(false); }}
          >
            <div className="w-full max-w-md rounded-2xl shadow-2xl bg-white overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b"
                style={{ borderColor: BORDER }}>
                <h2 className="font-semibold text-sm" style={{ color: TEXT }}>เพิ่มระดับสมาชิกใหม่</h2>
                <button onClick={() => setShowAdd(false)} className="p-1 rounded-lg hover:bg-gray-100">
                  <X size={17} color={MUTED} />
                </button>
              </div>
              <div className="px-6 py-5">
                <TierForm onSave={handleCreate} onCancel={() => setShowAdd(false)} />
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function StatChip({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl px-3 py-2" style={{ background: BG }}>
      <div className="flex items-center gap-1 mb-0.5" style={{ color: MUTED }}>{icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-sm font-semibold" style={{ color: TEXT }}>{value}</p>
    </div>
  );
}
