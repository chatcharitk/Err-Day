"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, ChevronDown, Trash2, Phone, Calendar, X, Loader2 } from "lucide-react";

const PRIMARY = "#8B1D24";
const TEXT    = "#3B2A24";
const MUTED   = "#A08070";
const BORDER  = "#E8D8CC";

interface Branch { id: string; name: string }
interface Staff {
  id:           string;
  name:         string;
  phone:        string | null;
  todayShifts:  { id: string; startTime: string; endTime: string }[];
}

interface Props {
  branches:       Branch[];
  activeBranchId: string;
  staff:          Staff[];
}

export default function StaffList({ branches, activeBranchId, staff: initial }: Props) {
  const router = useRouter();
  const [staff, setStaff] = useState(initial);
  // Re-sync when the server sends a new list (branch switch / refresh / add).
  // Without this, useState(initial) keeps the first branch's staff forever.
  useEffect(() => { setStaff(initial); }, [initial]);
  const [showBranchPicker, setShowBranchPicker] = useState(false);
  const [showAddForm, setShowAddForm]           = useState(false);
  const [newName,     setNewName]               = useState("");
  const [newPhone,    setNewPhone]              = useState("");
  const [busy, setBusy]                         = useState(false);
  const [err,  setErr]                          = useState("");

  const switchBranch = (id: string) => {
    setShowBranchPicker(false);
    router.replace(`/admin/m/staff?branchId=${id}`);
    router.refresh();
  };

  const activeBranch = branches.find(b => b.id === activeBranchId);

  const addStaff = async () => {
    if (!newName.trim()) { setErr("กรุณาระบุชื่อ"); return; }
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/admin/staff", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ name: newName.trim(), phone: newPhone.trim() || null, branchId: activeBranchId }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setErr(d.error ?? "เพิ่มไม่สำเร็จ"); return; }
      setNewName(""); setNewPhone(""); setShowAddForm(false);
      router.refresh();
    } finally { setBusy(false); }
  };

  const deleteStaff = async (id: string, name: string) => {
    if (!confirm(`ลบช่าง ${name}?`)) return;
    setBusy(true);
    try {
      await fetch(`/api/admin/staff/${id}`, { method: "DELETE" });
      setStaff(prev => prev.filter(s => s.id !== id));
    } finally { setBusy(false); }
  };

  return (
    <main className="pb-20">
      <header className="sticky top-0 z-20 bg-white" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <div className="px-4 py-3 flex items-center gap-2">
          <button onClick={() => router.push("/admin/m")} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ color: TEXT }}>
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-base font-medium flex-1" style={{ color: TEXT }}>ช่าง / กะการทำงาน</h1>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1 px-3 h-9 rounded-full text-sm font-medium text-white"
            style={{ background: PRIMARY }}
          >
            <Plus size={15} /> เพิ่ม
          </button>
        </div>
        {/* Branch picker */}
        <div className="px-4 pb-3">
          <button
            onClick={() => setShowBranchPicker(true)}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm"
            style={{ border: `1px solid ${BORDER}`, color: TEXT, background: "white" }}
          >
            <span>{activeBranch?.name ?? "เลือกสาขา"}</span>
            <ChevronDown size={14} style={{ color: MUTED }} />
          </button>
        </div>
      </header>

      {/* Add form */}
      {showAddForm && (
        <section className="px-4 py-3">
          <div className="rounded-xl border-2 p-3 space-y-2" style={{ borderColor: PRIMARY, background: "#FFF8F4" }}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold" style={{ color: PRIMARY }}>เพิ่มช่าง</p>
              <button onClick={() => { setShowAddForm(false); setErr(""); }} style={{ color: MUTED }}><X size={14} /></button>
            </div>
            <input
              type="text" placeholder="ชื่อช่าง *"
              value={newName} onChange={e => setNewName(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
              style={{ borderColor: BORDER, background: "white" }}
            />
            <input
              type="tel" placeholder="เบอร์โทร (ไม่บังคับ)"
              value={newPhone} onChange={e => setNewPhone(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
              style={{ borderColor: BORDER, background: "white" }}
            />
            {err && <p className="text-xs text-red-600">{err}</p>}
            <button
              onClick={addStaff}
              disabled={busy}
              className="w-full py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
              style={{ background: PRIMARY }}
            >
              {busy ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        </section>
      )}

      {/* Staff list */}
      <section className="px-4 pt-3">
        {staff.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed p-8 text-center" style={{ borderColor: BORDER, color: MUTED }}>
            <p className="text-sm font-medium">ยังไม่มีช่างในสาขานี้</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {staff.map(s => (
              <li key={s.id} className="rounded-xl p-3" style={{ background: "white", border: `1px solid ${BORDER}` }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 text-white" style={{ background: PRIMARY }}>
                    {s.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: TEXT }}>{s.name}</p>
                    {s.phone && (
                      <p className="text-[11px] flex items-center gap-1" style={{ color: MUTED }}>
                        <Phone size={10} /> {s.phone}
                      </p>
                    )}
                    <p className="text-[11px] mt-0.5" style={{ color: s.todayShifts.length > 0 ? "#166534" : MUTED }}>
                      {s.todayShifts.length === 0 ? "วันนี้ไม่ได้เข้ากะ" : `วันนี้ ${s.todayShifts.map(t => `${t.startTime}–${t.endTime}`).join(", ")}`}
                    </p>
                  </div>
                  <Link
                    href={`/admin/m/staff/${s.id}`}
                    className="px-3 py-1.5 rounded-lg text-xs flex items-center gap-1"
                    style={{ border: `1px solid ${BORDER}`, color: TEXT }}
                  >
                    <Calendar size={11} /> กะ
                  </Link>
                  <button
                    onClick={() => deleteStaff(s.id, s.name)}
                    disabled={busy}
                    className="p-1.5 disabled:opacity-50"
                    style={{ color: "#991B1B" }}
                  >
                    {busy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Branch picker bottom sheet */}
      {showBranchPicker && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(0,0,0,0.4)" }} onClick={() => setShowBranchPicker(false)}>
          <div className="w-full max-w-md bg-white rounded-t-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${BORDER}` }}>
              <p className="font-medium" style={{ color: TEXT }}>เลือกสาขา</p>
              <button onClick={() => setShowBranchPicker(false)} style={{ color: MUTED }}><X size={18} /></button>
            </div>
            <div className="p-2">
              {branches.map(b => (
                <button
                  key={b.id}
                  onClick={() => switchBranch(b.id)}
                  className="w-full text-left px-4 py-3 rounded-xl text-sm"
                  style={{ color: TEXT, background: b.id === activeBranchId ? "#FFF8F4" : "transparent" }}
                >
                  {b.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
