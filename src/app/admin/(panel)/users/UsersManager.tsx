"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  UserPlus, Pencil, KeyRound, Power, ShieldCheck, ShieldAlert,
  Check, X, AlertCircle, Trash2,
} from "lucide-react";

const PRIMARY = "#8B1D24";
const TEXT    = "#3B2A24";
const MUTED   = "#A08070";
const BORDER  = "#E8D8CC";

type Role = "OWNER" | "ADMIN";

interface AdminUser {
  id:        string;
  username:  string;
  name:      string;
  role:      Role;
  isActive:  boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface Props {
  users:         AdminUser[];
  currentUserId: string;
}

export default function UsersManager({ users, currentUserId }: Props) {
  const router = useRouter();

  /* ── Add user form ── */
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({
    username: "", password: "", name: "", role: "ADMIN" as Role,
  });
  const [addLoading, setAddLoading] = useState(false);
  const [addError,   setAddError]   = useState("");

  /* ── Edit (name/role) ── */
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", role: "ADMIN" as Role });
  const [editLoading, setEditLoading] = useState(false);

  /* ── Reset password ── */
  const [pwId, setPwId] = useState<string | null>(null);
  const [pwValue, setPwValue] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState("");

  /* ── Delete confirm ── */
  const [deleteId, setDeleteId] = useState<string | null>(null);

  /* ── Add ── */
  const handleAdd = async () => {
    setAddLoading(true); setAddError("");
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(addForm),
    });
    const data = await res.json();
    setAddLoading(false);
    if (!res.ok) { setAddError(data.error ?? "Failed"); return; }
    setShowAdd(false);
    setAddForm({ username: "", password: "", name: "", role: "ADMIN" });
    router.refresh();
  };

  /* ── Edit ── */
  const startEdit = (u: AdminUser) => {
    setEditId(u.id);
    setEditForm({ name: u.name, role: u.role });
  };
  const handleEdit = async () => {
    if (!editId) return;
    setEditLoading(true);
    await fetch(`/api/admin/users/${editId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    setEditLoading(false);
    setEditId(null);
    router.refresh();
  };

  /* ── Reset password ── */
  const handleResetPassword = async () => {
    if (!pwId) return;
    setPwError("");
    if (pwValue.length < 4) { setPwError("รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร"); return; }
    setPwLoading(true);
    const res = await fetch(`/api/admin/users/${pwId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pwValue }),
    });
    const data = await res.json();
    setPwLoading(false);
    if (!res.ok) { setPwError(data.error ?? "Failed"); return; }
    setPwId(null); setPwValue("");
    router.refresh();
  };

  /* ── Toggle active / Reactivate ── */
  const handleToggleActive = async (u: AdminUser) => {
    await fetch(`/api/admin/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !u.isActive }),
    });
    router.refresh();
  };

  /* ── Soft delete ── */
  const handleDelete = async (id: string) => {
    await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    setDeleteId(null);
    router.refresh();
  };

  return (
    <div className="px-8 py-8">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: MUTED }}>User Management</p>
          <h1 className="text-2xl font-medium" style={{ color: TEXT }}>จัดการผู้ใช้</h1>
          <p className="text-xs mt-1" style={{ color: MUTED }}>
            สร้าง/แก้ไข/ระงับบัญชีผู้ดูแล (เฉพาะ OWNER เท่านั้นที่เห็นหน้านี้)
          </p>
        </div>
        <button
          onClick={() => { setShowAdd(v => !v); setAddError(""); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white"
          style={{ background: PRIMARY }}
        >
          <UserPlus className="w-4 h-4" /> เพิ่มผู้ใช้
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="mb-6 p-5 rounded-2xl bg-white" style={{ border: `1.5px solid ${PRIMARY}` }}>
          <p className="font-medium mb-4" style={{ color: TEXT }}>เพิ่มผู้ใช้ใหม่</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
            <div>
              <label className="text-xs mb-1 block" style={{ color: MUTED }}>ชื่อผู้ใช้ *</label>
              <input
                type="text"
                placeholder="username"
                value={addForm.username}
                onChange={(e) => setAddForm(f => ({ ...f, username: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
                style={{ borderColor: BORDER }}
              />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: MUTED }}>ชื่อ-นามสกุล *</label>
              <input
                type="text"
                placeholder="ชื่อจริง"
                value={addForm.name}
                onChange={(e) => setAddForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
                style={{ borderColor: BORDER }}
              />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: MUTED }}>รหัสผ่าน *</label>
              <input
                type="text"
                placeholder="อย่างน้อย 4 ตัวอักษร"
                value={addForm.password}
                onChange={(e) => setAddForm(f => ({ ...f, password: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
                style={{ borderColor: BORDER }}
              />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: MUTED }}>สิทธิ์</label>
              <select
                value={addForm.role}
                onChange={(e) => setAddForm(f => ({ ...f, role: e.target.value as Role }))}
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none bg-white"
                style={{ borderColor: BORDER }}
              >
                <option value="ADMIN">ADMIN — ใช้งานทั่วไป</option>
                <option value="OWNER">OWNER — จัดการผู้ใช้ได้</option>
              </select>
            </div>
          </div>
          {addError && (
            <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm mb-3" style={{ background: "#FEF2F2", color: "#991b1b" }}>
              <AlertCircle size={14} /> {addError}
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={addLoading || !addForm.username || !addForm.password || !addForm.name}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
              style={{ background: PRIMARY }}
            >
              {addLoading ? "กำลังบันทึก..." : "บันทึก"}
            </button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-lg text-sm" style={{ color: MUTED }}>
              ยกเลิก
            </button>
          </div>
        </div>
      )}

      {/* Users table */}
      <div className="rounded-2xl bg-white overflow-hidden" style={{ border: `1.5px solid ${BORDER}` }}>
        <div
          className="grid grid-cols-[1.2fr_1.5fr_120px_120px_220px] gap-4 px-5 py-3 text-xs font-semibold uppercase tracking-widest"
          style={{ background: "#F9F4F0", color: MUTED, borderBottom: `1px solid ${BORDER}` }}
        >
          <span>ชื่อผู้ใช้</span>
          <span>ชื่อ-นามสกุล</span>
          <span>สิทธิ์</span>
          <span>สถานะ</span>
          <span className="text-right">การจัดการ</span>
        </div>

        {users.length === 0 ? (
          <p className="text-center py-12 text-sm" style={{ color: MUTED }}>ยังไม่มีผู้ใช้</p>
        ) : (
          <div className="divide-y" style={{ borderColor: "#F5EFE9" }}>
            {users.map((u) => {
              const isMe = u.id === currentUserId;
              return (
                <div key={u.id}>
                  {editId === u.id ? (
                    /* Edit row */
                    <div className="px-5 py-4 grid grid-cols-[1.2fr_1.5fr_120px_120px_220px] gap-4 items-center">
                      <span className="text-sm font-mono" style={{ color: TEXT }}>{u.username}</span>
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
                        className="border rounded-lg px-2 py-1.5 text-sm outline-none"
                        style={{ borderColor: BORDER }}
                      />
                      <select
                        value={editForm.role}
                        onChange={(e) => setEditForm(f => ({ ...f, role: e.target.value as Role }))}
                        className="border rounded-lg px-2 py-1.5 text-sm outline-none bg-white"
                        style={{ borderColor: BORDER }}
                      >
                        <option value="ADMIN">ADMIN</option>
                        <option value="OWNER">OWNER</option>
                      </select>
                      <span className="text-xs" style={{ color: MUTED }}>—</span>
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={handleEdit} disabled={editLoading} className="p-1.5 rounded-lg text-white" style={{ background: PRIMARY }}>
                          <Check size={16} />
                        </button>
                        <button onClick={() => setEditId(null)} className="p-1.5 rounded-lg" style={{ color: MUTED }}>
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  ) : pwId === u.id ? (
                    /* Reset password row */
                    <div className="px-5 py-4 grid grid-cols-[1.2fr_1.5fr_120px_120px_220px] gap-4 items-center"
                         style={{ background: "#FFF8F4" }}>
                      <span className="text-sm font-mono" style={{ color: TEXT }}>{u.username}</span>
                      <input
                        type="text"
                        autoFocus
                        placeholder="รหัสผ่านใหม่ (อย่างน้อย 4 ตัวอักษร)"
                        value={pwValue}
                        onChange={(e) => setPwValue(e.target.value)}
                        className="col-span-2 border rounded-lg px-2 py-1.5 text-sm outline-none"
                        style={{ borderColor: PRIMARY }}
                      />
                      {pwError ? (
                        <span className="text-xs" style={{ color: "#991b1b" }}>{pwError}</span>
                      ) : (
                        <span className="text-xs" style={{ color: MUTED }}>การเซ็ตรหัสใหม่จะออกจากระบบทุกอุปกรณ์</span>
                      )}
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={handleResetPassword} disabled={pwLoading} className="px-3 py-1.5 rounded-lg text-xs text-white" style={{ background: PRIMARY }}>
                          {pwLoading ? "..." : "บันทึก"}
                        </button>
                        <button onClick={() => { setPwId(null); setPwValue(""); setPwError(""); }} className="p-1.5 rounded-lg" style={{ color: MUTED }}>
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  ) : deleteId === u.id ? (
                    /* Delete confirm */
                    <div className="px-5 py-4 flex items-center justify-between gap-3" style={{ background: "#FEF2F2" }}>
                      <p className="text-sm" style={{ color: "#991b1b" }}>
                        ระงับบัญชี <strong>{u.username}</strong>? ผู้ใช้จะออกจากระบบทันที
                      </p>
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleDelete(u.id)} className="px-3 py-1.5 rounded-lg text-sm text-white" style={{ background: "#991B1B" }}>
                          ยืนยันระงับ
                        </button>
                        <button onClick={() => setDeleteId(null)} className="px-3 py-1.5 rounded-lg text-sm" style={{ color: MUTED }}>
                          ยกเลิก
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Normal row */
                    <div className="px-5 py-4 grid grid-cols-[1.2fr_1.5fr_120px_120px_220px] gap-4 items-center">
                      <span className="text-sm font-mono flex items-center gap-2" style={{ color: TEXT }}>
                        {u.username}
                        {isMe && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "#FFF0E8", color: PRIMARY }}>คุณ</span>}
                      </span>
                      <span className="text-sm" style={{ color: TEXT }}>{u.name}</span>
                      <span className="text-xs">
                        {u.role === "OWNER" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium" style={{ background: "#FFF0E8", color: PRIMARY }}>
                            <ShieldCheck size={12} /> OWNER
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium" style={{ background: "#F0E4D8", color: "#6B5245" }}>
                            <ShieldAlert size={12} /> ADMIN
                          </span>
                        )}
                      </span>
                      <span className="text-xs">
                        {u.isActive ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: "#F0FFF4", color: "#166534" }}>
                            ใช้งานได้
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: "#F3F4F6", color: "#6B7280" }}>
                            ถูกระงับ
                          </span>
                        )}
                      </span>
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        <button onClick={() => startEdit(u)} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs border" style={{ borderColor: BORDER, color: "#6B5245" }}>
                          <Pencil size={11} /> แก้ไข
                        </button>
                        <button onClick={() => { setPwId(u.id); setPwValue(""); setPwError(""); }} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs border" style={{ borderColor: BORDER, color: "#6B5245" }}>
                          <KeyRound size={11} /> รหัสผ่าน
                        </button>
                        {u.isActive ? (
                          !isMe && (
                            <button onClick={() => setDeleteId(u.id)} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs border" style={{ borderColor: "#FECACA", color: "#DC2626" }}>
                              <Trash2 size={11} /> ระงับ
                            </button>
                          )
                        ) : (
                          <button onClick={() => handleToggleActive(u)} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs border" style={{ borderColor: "#BBF7D0", color: "#166534" }}>
                            <Power size={11} /> เปิดใช้งาน
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
