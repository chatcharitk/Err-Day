"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Save, Trash2, RotateCcw, Check, X } from "lucide-react";

const PRIMARY = "#8B1D24";
const TEXT    = "#3B2A24";
const MUTED   = "#A08070";
const BORDER  = "#E8D8CC";

interface Addon {
  id:       string;
  name:     string;
  nameTh:   string;
  price:    number;  // satang
  isActive: boolean;
}

interface Props {
  initial: Addon[];
}

function fmt(satang: number) { return `฿${(satang / 100).toLocaleString("th-TH")}`; }

export default function AddonsManager({ initial }: Props) {
  const router = useRouter();
  const [addons, setAddons] = useState<Addon[]>(initial);

  // ── New row ────────────────────────────────────────────────────────────────
  const [showNew, setShowNew] = useState(false);
  const [newNameTh, setNewNameTh] = useState("");
  const [newName,   setNewName]   = useState("");
  const [newPrice,  setNewPrice]  = useState<number | "">("");
  const [busy,      setBusy]      = useState(false);
  const [error,     setError]     = useState("");

  // ── Per-row edit ──────────────────────────────────────────────────────────
  const [editing, setEditing] = useState<Record<string, { nameTh: string; price: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  async function createAddon() {
    if (!newNameTh.trim() || typeof newPrice !== "number" || newPrice < 0) {
      setError("กรุณากรอกชื่อและราคา");
      return;
    }
    setBusy(true); setError("");
    const res = await fetch("/api/admin/addons", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ nameTh: newNameTh.trim(), name: newName.trim() || newNameTh.trim(), price: newPrice }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "เพิ่มไม่สำเร็จ");
      return;
    }
    const data = await res.json();
    setAddons(prev => [...prev, data.addon].sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.nameTh.localeCompare(b.nameTh)));
    setNewNameTh(""); setNewName(""); setNewPrice("");
    setShowNew(false);
    router.refresh();
  }

  async function patchAddon(id: string, body: Record<string, unknown>) {
    setSavingId(id);
    const res = await fetch(`/api/admin/addons/${id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
    });
    setSavingId(null);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error ?? "บันทึกไม่สำเร็จ");
      return false;
    }
    const data = await res.json();
    setAddons(prev => prev.map(a => a.id === id ? data.addon : a));
    return true;
  }

  async function saveEdit(id: string) {
    const e = editing[id];
    if (!e) return;
    const ok = await patchAddon(id, { nameTh: e.nameTh, price: Number(e.price) });
    if (ok) setEditing(prev => { const n = { ...prev }; delete n[id]; return n; });
  }

  async function toggleActive(a: Addon) {
    await patchAddon(a.id, { isActive: !a.isActive });
  }

  async function deleteAddon(a: Addon) {
    if (!confirm(`ลบบริการเสริม "${a.nameTh}"? (จะถูกปิดใช้งาน ประวัติการจองยังเก็บอยู่)`)) return;
    const res = await fetch(`/api/admin/addons/${a.id}`, { method: "DELETE" });
    if (!res.ok) { alert("ลบไม่สำเร็จ"); return; }
    setAddons(prev => prev.map(x => x.id === a.id ? { ...x, isActive: false } : x));
  }

  return (
    <div className="max-w-3xl px-8 py-8">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 mb-6 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: MUTED }}>Add-on Services</p>
          <h1 className="text-2xl font-medium" style={{ color: TEXT }}>บริการเสริม</h1>
          <p className="text-xs mt-1" style={{ color: MUTED }}>
            บริการเสริมเลือกเพิ่มได้ระหว่างจอง (เช่น สครับศีรษะ, ผมต่อ, นวดเพิ่ม)
          </p>
        </div>
        {!showNew && (
          <button onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: PRIMARY }}>
            <Plus size={16} /> เพิ่มบริการเสริม
          </button>
        )}
      </div>

      {/* New form */}
      {showNew && (
        <div className="bg-white rounded-2xl p-5 mb-4" style={{ border: `1.5px solid ${BORDER}` }}>
          <h2 className="text-sm font-semibold mb-3" style={{ color: TEXT }}>เพิ่มบริการเสริมใหม่</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-widest block mb-1" style={{ color: MUTED }}>ชื่อ (ไทย) *</label>
              <input value={newNameTh} onChange={e => setNewNameTh(e.target.value)} autoFocus
                placeholder="เช่น นวดศีรษะเพิ่ม 10 นาที"
                className="w-full border rounded-lg px-3 py-2 text-sm" style={{ borderColor: BORDER, color: TEXT }} />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest block mb-1" style={{ color: MUTED }}>ชื่อ (English)</label>
              <input value={newName} onChange={e => setNewName(e.target.value)}
                placeholder="e.g. 10-min Scalp Massage"
                className="w-full border rounded-lg px-3 py-2 text-sm" style={{ borderColor: BORDER, color: TEXT }} />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest block mb-1" style={{ color: MUTED }}>ราคา (฿) *</label>
              <input type="number" inputMode="decimal" min="0" step="50"
                value={newPrice} onChange={e => setNewPrice(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="100"
                className="w-full border rounded-lg px-3 py-2 text-sm" style={{ borderColor: BORDER, color: TEXT }} />
            </div>
          </div>
          {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
          <div className="flex gap-2 mt-4">
            <button onClick={createAddon} disabled={busy}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: PRIMARY }}>
              <Save size={14} />
              {busy ? "กำลังบันทึก..." : "บันทึก"}
            </button>
            <button onClick={() => { setShowNew(false); setError(""); }}
              className="px-4 py-2 rounded-lg text-sm font-medium"
              style={{ color: MUTED, border: `1px solid ${BORDER}` }}>
              ยกเลิก
            </button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="bg-white rounded-2xl overflow-hidden" style={{ border: `1.5px solid ${BORDER}` }}>
        {addons.length === 0 ? (
          <div className="text-center py-12 text-sm" style={{ color: MUTED }}>
            ยังไม่มีบริการเสริม
          </div>
        ) : (
          <ul className="divide-y" style={{ borderColor: BORDER }}>
            {addons.map(a => {
              const isEditing = a.id in editing;
              const e = editing[a.id];
              return (
                <li key={a.id} className="px-4 py-3 flex items-center gap-3" style={{ opacity: a.isActive ? 1 : 0.5 }}>
                  {isEditing ? (
                    <>
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <input value={e.nameTh} autoFocus
                          onChange={ev => setEditing(prev => ({ ...prev, [a.id]: { ...e, nameTh: ev.target.value } }))}
                          className="border rounded px-2 py-1 text-sm" style={{ borderColor: BORDER, color: TEXT }} />
                        <input type="number" inputMode="decimal" min="0" step="50" value={e.price}
                          onChange={ev => setEditing(prev => ({ ...prev, [a.id]: { ...e, price: ev.target.value } }))}
                          className="border rounded px-2 py-1 text-sm" style={{ borderColor: BORDER, color: TEXT }} />
                      </div>
                      <button onClick={() => saveEdit(a.id)} disabled={savingId === a.id}
                        className="text-sm px-3 py-1 rounded-lg text-white disabled:opacity-50" style={{ background: PRIMARY }}>
                        <Check size={14} />
                      </button>
                      <button onClick={() => setEditing(prev => { const n = { ...prev }; delete n[a.id]; return n; })}
                        className="text-sm px-3 py-1 rounded-lg" style={{ color: MUTED, border: `1px solid ${BORDER}` }}>
                        <X size={14} />
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="flex-1">
                        <p className="text-sm font-medium" style={{ color: TEXT }}>
                          {a.nameTh}
                          {a.name && a.name !== a.nameTh && (
                            <span className="ml-2 font-normal" style={{ color: MUTED }}>· {a.name}</span>
                          )}
                        </p>
                      </div>
                      <p className="text-sm font-semibold w-20 text-right" style={{ color: PRIMARY }}>
                        +{fmt(a.price)}
                      </p>
                      <button
                        onClick={() => setEditing(prev => ({ ...prev, [a.id]: { nameTh: a.nameTh, price: String(a.price / 100) } }))}
                        className="text-xs px-2.5 py-1 rounded-md"
                        style={{ color: TEXT, border: `1px solid ${BORDER}` }}>
                        แก้ไข
                      </button>
                      <button
                        onClick={() => toggleActive(a)}
                        className="text-xs px-2.5 py-1 rounded-md"
                        style={{
                          background: a.isActive ? "transparent" : "#F0FDF4",
                          color:      a.isActive ? MUTED         : "#166534",
                          border:     `1px solid ${a.isActive ? BORDER : "#BBF7D0"}`,
                        }}
                        title={a.isActive ? "ปิดใช้งาน" : "เปิดใช้งานใหม่"}>
                        {a.isActive ? "ปิด" : <><RotateCcw size={11} className="inline mr-1" />เปิด</>}
                      </button>
                      {a.isActive && (
                        <button onClick={() => deleteAddon(a)}
                          className="text-xs px-2 py-1 rounded-md"
                          style={{ color: "#DC2626", border: "1px solid #FECACA" }}
                          title="ลบ (soft delete)">
                          <Trash2 size={12} />
                        </button>
                      )}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
