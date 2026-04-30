"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  UserPlus, Pencil, Trash2, Check, X, ChevronLeft, ChevronRight, Save,
} from "lucide-react";
import type { Branch, Staff } from "@/generated/prisma/client";

type StaffWithStats = Staff & {
  branch: Branch;
  monthlyRevenue: number;
  monthlyCommission: number;
};

interface Props {
  staff: StaffWithStats[];
  branches: Branch[];
  monthLabel: string;
  currentMonth: string; // "YYYY-MM"
  activeTab: "manage" | "commission";
}

function formatPrice(satang: number) {
  return `฿${(satang / 100).toLocaleString()}`;
}


function prevMonth(m: string) {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo - 2);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function nextMonth(m: string) {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function StaffManager({ staff, branches, monthLabel, currentMonth, activeTab }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"manage" | "commission">(activeTab);

  /* ── Add form ── */
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", phone: "", branchId: branches[0]?.id ?? "" });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");

  /* ── Edit form ── */
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", phone: "", branchId: "" });
  const [editLoading, setEditLoading] = useState(false);

  /* ── Commission editing ── */
  const [rates, setRates] = useState<Record<string, string>>(
    Object.fromEntries(staff.map((s) => [s.id, String(s.commissionRate)]))
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  /* ── Delete confirm ── */
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const switchTab = (t: "manage" | "commission") => {
    setTab(t);
    router.replace(`/admin/staff?tab=${t}&month=${currentMonth}`, { scroll: false });
  };

  /* --- Add staff --- */
  const handleAdd = async () => {
    if (!addForm.name.trim()) { setAddError("กรุณาระบุชื่อ"); return; }
    setAddLoading(true); setAddError("");
    const res = await fetch("/api/admin/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(addForm),
    });
    setAddLoading(false);
    if (!res.ok) { setAddError("เกิดข้อผิดพลาด"); return; }
    setShowAdd(false);
    setAddForm({ name: "", phone: "", branchId: branches[0]?.id ?? "" });
    router.refresh();
  };

  /* --- Edit staff --- */
  const startEdit = (s: StaffWithStats) => {
    setEditId(s.id);
    setEditForm({ name: s.name, phone: s.phone ?? "", branchId: s.branchId });
  };
  const cancelEdit = () => setEditId(null);
  const handleEdit = async () => {
    if (!editId) return;
    setEditLoading(true);
    await fetch(`/api/admin/staff/${editId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    setEditLoading(false);
    setEditId(null);
    router.refresh();
  };

  /* --- Delete staff --- */
  const handleDelete = async (id: string) => {
    await fetch(`/api/admin/staff/${id}`, { method: "DELETE" });
    setDeleteId(null);
    router.refresh();
  };

  /* --- Save commission rate --- */
  const saveRate = async (id: string) => {
    setSavingId(id);
    const commissionRate = parseFloat(rates[id]) || 0;
    await fetch(`/api/admin/staff/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commissionRate }),
    });
    setSavingId(null);
    setSavedId(id);
    setTimeout(() => setSavedId(null), 1800);
    router.refresh();
  };

  /* ── Group staff by branch for manage tab ── */
  const byBranch = branches.reduce<Record<string, StaffWithStats[]>>((acc, b) => {
    acc[b.id] = staff.filter((s) => s.branchId === b.id);
    return acc;
  }, {});

  const totalCommission = staff.reduce((s, st) => s + st.monthlyCommission, 0);

  return (
    <div className="px-8 py-8">
      {/* Page header */}
      <div className="mb-6">
        <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "#A08070" }}>Staff Management</p>
        <h1 className="text-2xl font-medium" style={{ color: "#3B2A24" }}>จัดการพนักงาน</h1>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-8 p-1 rounded-xl w-fit" style={{ backgroundColor: "#F0E4D8" }}>
        {(["manage", "commission"] as const).map((t) => (
          <button
            key={t}
            onClick={() => switchTab(t)}
            className="px-5 py-2 rounded-lg text-sm font-medium transition-all"
            style={
              tab === t
                ? { backgroundColor: "#8B1D24", color: "white" }
                : { color: "#6B5245" }
            }
          >
            {t === "manage" ? "จัดการพนักงาน" : "ค่าคอมมิชชั่น"}
          </button>
        ))}
      </div>

      {/* ══════════════ TAB 1: Manage Staff ══════════════ */}
      {tab === "manage" && (
        <div>
          {/* Add button */}
          <div className="flex justify-end mb-5">
            <button
              onClick={() => { setShowAdd((v) => !v); setAddError(""); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: "#8B1D24" }}
            >
              <UserPlus className="w-4 h-4" />
              เพิ่มพนักงาน
            </button>
          </div>

          {/* Add form */}
          {showAdd && (
            <div className="mb-6 p-5 rounded-2xl bg-white" style={{ border: "1.5px solid #8B1D24" }}>
              <p className="font-medium mb-4" style={{ color: "#3B2A24" }}>เพิ่มพนักงานใหม่</p>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="text-xs mb-1 block" style={{ color: "#6B5245" }}>ชื่อ *</label>
                  <input
                    type="text"
                    placeholder="ชื่อพนักงาน"
                    value={addForm.name}
                    onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
                    style={{ borderColor: "#D6BCAE" }}
                  />
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: "#6B5245" }}>เบอร์โทรศัพท์</label>
                  <input
                    type="tel"
                    placeholder="08X-XXX-XXXX"
                    value={addForm.phone}
                    onChange={(e) => setAddForm((f) => ({ ...f, phone: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
                    style={{ borderColor: "#D6BCAE" }}
                  />
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: "#6B5245" }}>สาขา *</label>
                  <select
                    value={addForm.branchId}
                    onChange={(e) => setAddForm((f) => ({ ...f, branchId: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm outline-none bg-white"
                    style={{ borderColor: "#D6BCAE" }}
                  >
                    {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              </div>
              {addError && <p className="text-red-500 text-xs mb-2">{addError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={handleAdd}
                  disabled={addLoading}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                  style={{ backgroundColor: "#8B1D24" }}
                >
                  {addLoading ? "กำลังบันทึก..." : "บันทึก"}
                </button>
                <button
                  onClick={() => setShowAdd(false)}
                  className="px-4 py-2 rounded-lg text-sm"
                  style={{ color: "#6B5245" }}
                >
                  ยกเลิก
                </button>
              </div>
            </div>
          )}

          {/* Staff by branch */}
          {branches.map((b) => {
            const branchStaff = byBranch[b.id] ?? [];
            return (
              <div key={b.id} className="mb-6">
                <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#8B1D24" }}>
                  {b.name}
                </h2>
                <div className="rounded-2xl bg-white overflow-hidden" style={{ border: "1.5px solid #E8D8CC" }}>
                  {branchStaff.length === 0 ? (
                    <p className="text-center py-6 text-sm" style={{ color: "#A08070" }}>ไม่มีพนักงานในสาขานี้</p>
                  ) : (
                    <div className="divide-y" style={{ borderColor: "#F5EFE9" }}>
                      {branchStaff.map((s) => (
                        <div key={s.id}>
                          {editId === s.id ? (
                            /* Inline edit row */
                            <div className="px-5 py-4 flex items-center gap-3">
                              <div
                                className="w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0"
                                style={{ backgroundColor: "#F0E4D8", color: "#6B5245" }}
                              >
                                {editForm.name[0] || "?"}
                              </div>
                              <input
                                type="text"
                                value={editForm.name}
                                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                                className="border rounded-lg px-2 py-1.5 text-sm outline-none w-32"
                                style={{ borderColor: "#D6BCAE" }}
                              />
                              <input
                                type="tel"
                                placeholder="08X-XXX-XXXX"
                                value={editForm.phone}
                                onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                                className="border rounded-lg px-2 py-1.5 text-sm outline-none w-36"
                                style={{ borderColor: "#D6BCAE" }}
                              />
                              <select
                                value={editForm.branchId}
                                onChange={(e) => setEditForm((f) => ({ ...f, branchId: e.target.value }))}
                                className="border rounded-lg px-2 py-1.5 text-sm outline-none bg-white flex-1"
                                style={{ borderColor: "#D6BCAE" }}
                              >
                                {branches.map((br) => <option key={br.id} value={br.id}>{br.name}</option>)}
                              </select>
                              <button
                                onClick={handleEdit}
                                disabled={editLoading}
                                className="p-1.5 rounded-lg"
                                style={{ backgroundColor: "#8B1D24", color: "white" }}
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button onClick={cancelEdit} className="p-1.5 rounded-lg" style={{ color: "#A08070" }}>
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : deleteId === s.id ? (
                            /* Delete confirm row */
                            <div className="px-5 py-4 flex items-center gap-3" style={{ backgroundColor: "#FEF2F2" }}>
                              <p className="text-sm flex-1" style={{ color: "#991B1B" }}>
                                ลบ <strong>{s.name}</strong> ออกจากระบบ?
                              </p>
                              <button
                                onClick={() => handleDelete(s.id)}
                                className="px-3 py-1.5 rounded-lg text-sm text-white"
                                style={{ backgroundColor: "#991B1B" }}
                              >
                                ยืนยันลบ
                              </button>
                              <button
                                onClick={() => setDeleteId(null)}
                                className="px-3 py-1.5 rounded-lg text-sm"
                                style={{ color: "#6B5245" }}
                              >
                                ยกเลิก
                              </button>
                            </div>
                          ) : (
                            /* Normal row */
                            <div className="px-5 py-4 flex items-center justify-between gap-4">
                              <div className="flex items-center gap-3">
                                <div
                                  className="w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0"
                                  style={{ backgroundColor: "#F0E4D8", color: "#6B5245" }}
                                >
                                  {s.name[0]}
                                </div>
                                <div>
                                  <p className="font-medium text-sm" style={{ color: "#3B2A24" }}>{s.name}</p>
                                  {s.phone && <p className="text-xs" style={{ color: "#A08070" }}>{s.phone}</p>}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => startEdit(s)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors"
                                  style={{ borderColor: "#D6BCAE", color: "#6B5245" }}
                                >
                                  <Pencil className="w-3 h-3" /> แก้ไข
                                </button>
                                <button
                                  onClick={() => setDeleteId(s.id)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors"
                                  style={{ borderColor: "#FECACA", color: "#DC2626" }}
                                >
                                  <Trash2 className="w-3 h-3" /> ลบ
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════════ TAB 2: Commissions ══════════════ */}
      {tab === "commission" && (
        <div>
          {/* Month navigator */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <a
                href={`/admin/staff?tab=commission&month=${prevMonth(currentMonth)}`}
                className="p-1.5 rounded-lg border transition-colors"
                style={{ borderColor: "#D6BCAE", color: "#6B5245" }}
              >
                <ChevronLeft className="w-4 h-4" />
              </a>
              <span className="font-medium text-sm" style={{ color: "#3B2A24" }}>{monthLabel}</span>
              <a
                href={`/admin/staff?tab=commission&month=${nextMonth(currentMonth)}`}
                className="p-1.5 rounded-lg border transition-colors"
                style={{ borderColor: "#D6BCAE", color: "#6B5245" }}
              >
                <ChevronRight className="w-4 h-4" />
              </a>
            </div>

            {/* Summary chip */}
            <div className="rounded-xl px-5 py-2 text-sm" style={{ backgroundColor: "#FFF0E8" }}>
              <span style={{ color: "#A08070" }}>ค่าคอมรวม </span>
              <span className="font-bold text-lg ml-1" style={{ color: "#8B1D24" }}>{formatPrice(totalCommission)}</span>
            </div>
          </div>

          {/* Commission table */}
          <div className="rounded-2xl bg-white overflow-hidden" style={{ border: "1.5px solid #E8D8CC" }}>
            {/* Table header */}
            <div
              className="grid grid-cols-[1fr_1fr_130px_120px_120px_80px] gap-4 px-5 py-3 text-xs font-semibold uppercase tracking-widest"
              style={{ backgroundColor: "#F9F4F0", color: "#A08070", borderBottom: "1px solid #F0E4D8" }}
            >
              <span>พนักงาน</span>
              <span>สาขา</span>
              <span>อัตราค่าคอม</span>
              <span className="text-right">รายรับ</span>
              <span className="text-right">ค่าคอม</span>
              <span></span>
            </div>

            {staff.length === 0 ? (
              <p className="text-center py-12 text-sm" style={{ color: "#A08070" }}>ไม่มีพนักงาน</p>
            ) : (
              <div className="divide-y" style={{ borderColor: "#F5EFE9" }}>
                {staff.map((s) => {
                  const rate = parseFloat(rates[s.id] ?? "0") || 0;
                  const previewCommission = Math.round(s.monthlyRevenue * rate / 100);
                  return (
                    <div
                      key={s.id}
                      className="grid grid-cols-[1fr_1fr_130px_120px_120px_80px] gap-4 items-center px-5 py-4"
                    >
                      {/* Name */}
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center font-semibold text-xs flex-shrink-0"
                          style={{ backgroundColor: "#F0E4D8", color: "#6B5245" }}
                        >
                          {s.name[0]}
                        </div>
                        <div>
                          <p className="text-sm font-medium" style={{ color: "#3B2A24" }}>{s.name}</p>
                          {s.phone && <p className="text-xs" style={{ color: "#A08070" }}>{s.phone}</p>}
                        </div>
                      </div>

                      {/* Branch */}
                      <span className="text-sm" style={{ color: "#6B5245" }}>
                        {s.branch.name.replace("err.day ", "")}
                      </span>

                      {/* Commission rate input */}
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={0.5}
                          value={rates[s.id] ?? "0"}
                          onChange={(e) => setRates((r) => ({ ...r, [s.id]: e.target.value }))}
                          className="w-16 border rounded-lg px-2 py-1.5 text-sm outline-none text-center"
                          style={{ borderColor: "#D6BCAE" }}
                        />
                        <span className="text-sm" style={{ color: "#A08070" }}>%</span>
                      </div>

                      {/* Revenue */}
                      <p className="text-sm text-right font-medium" style={{ color: "#3B2A24" }}>
                        {s.monthlyRevenue > 0 ? formatPrice(s.monthlyRevenue) : <span style={{ color: "#C4B0A4" }}>—</span>}
                      </p>

                      {/* Commission earned */}
                      <p className="text-sm text-right font-semibold" style={{ color: previewCommission > 0 ? "#8B1D24" : "#C4B0A4" }}>
                        {previewCommission > 0 ? formatPrice(previewCommission) : "—"}
                      </p>

                      {/* Save button */}
                      <div className="flex justify-end">
                        {savedId === s.id ? (
                          <span className="flex items-center gap-1 text-xs" style={{ color: "#22c55e" }}>
                            <Check className="w-3.5 h-3.5" /> บันทึกแล้ว
                          </span>
                        ) : (
                          <button
                            onClick={() => saveRate(s.id)}
                            disabled={savingId === s.id}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border transition-colors disabled:opacity-40"
                            style={{ borderColor: "#D6BCAE", color: "#6B5245" }}
                          >
                            {savingId === s.id ? (
                              "..."
                            ) : (
                              <><Save className="w-3 h-3" /> บันทึก</>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Footer total */}
            {staff.length > 0 && (
              <div
                className="grid grid-cols-[1fr_1fr_130px_120px_120px_80px] gap-4 items-center px-5 py-3"
                style={{ backgroundColor: "#F9F4F0", borderTop: "1px solid #F0E4D8" }}
              >
                <span className="text-xs font-semibold uppercase tracking-widest col-span-3" style={{ color: "#A08070" }}>
                  รวมทั้งหมด
                </span>
                <p className="text-sm text-right font-semibold" style={{ color: "#3B2A24" }}>
                  {formatPrice(staff.reduce((s, st) => s + st.monthlyRevenue, 0))}
                </p>
                <p className="text-sm text-right font-bold" style={{ color: "#8B1D24" }}>
                  {formatPrice(totalCommission)}
                </p>
                <span />
              </div>
            )}
          </div>

          <p className="text-xs mt-3" style={{ color: "#A08070" }}>
            * รายรับคำนวณจากการจองสถานะ &quot;เสร็จสิ้น&quot; ที่มีการระบุช่าง
          </p>
        </div>
      )}
    </div>
  );
}
