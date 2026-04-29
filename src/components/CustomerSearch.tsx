"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Search, User, X, UserPlus, Plus } from "lucide-react";

export interface CustomerValue {
  id: string | null;
  name: string;
  phone: string;
}

interface Suggestion {
  id: string;
  name: string;
  phone: string | null;
}

interface Props {
  value: CustomerValue;
  onChange: (v: CustomerValue) => void;
  /** Force phone to be required when registering a new customer (default false) */
  requirePhoneOnCreate?: boolean;
  /** Show the manual phone input below when no customer selected (default true) */
  showManualPhone?: boolean;
  /** Compact spacing for narrow sidebars */
  compact?: boolean;
}

export default function CustomerSearch({
  value, onChange,
  requirePhoneOnCreate = false,
  showManualPhone     = true,
  compact             = false,
}: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSug, setShowSug]         = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // Add-customer form state
  const [newName,     setNewName]     = useState("");
  const [newNickname, setNewNickname] = useState("");
  const [newPhone,    setNewPhone]    = useState("");
  const [newGender,   setNewGender]   = useState("");
  const [creating,    setCreating]    = useState(false);
  const [createErr,   setCreateErr]   = useState("");

  const wrapRef     = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Display name comes directly from `value.name` — no separate query state needed.
  const query = value.name;

  // Close dropdown on outside click
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setShowSug(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const search = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) { setSuggestions([]); setShowSug(false); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/customers?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data: Suggestion[] = await res.json();
          setSuggestions(data);
          setShowSug(true);
        }
      } catch { /* ignore */ }
    }, 250);
  }, []);

  const select = (c: Suggestion) => {
    onChange({ id: c.id, name: c.name, phone: c.phone ?? "" });
    setShowSug(false);
    setSuggestions([]);
  };

  const clear = () => {
    onChange({ id: null, name: "", phone: "" });
    setSuggestions([]);
    setShowSug(false);
  };

  const openAddForm = () => {
    setNewName(query.trim());
    setNewNickname("");
    setNewPhone("");
    setNewGender("");
    setCreateErr("");
    setShowAddForm(true);
    setShowSug(false);
  };

  const submitNewCustomer = async () => {
    setCreateErr("");
    if (!newName.trim()) { setCreateErr("กรุณาระบุชื่อ"); return; }
    if (requirePhoneOnCreate && !newPhone.trim()) {
      setCreateErr("กรุณาระบุเบอร์โทร");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/admin/customers", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:     newName.trim(),
          nickname: newNickname.trim() || undefined,
          phone:    newPhone.trim() || `pos-${Date.now()}`, // backend requires phone — synthesize for walk-ins
          gender:   newGender || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateErr(data.error ?? "สร้างลูกค้าไม่สำเร็จ");
        setCreating(false);
        return;
      }
      onChange({ id: data.id, name: data.name, phone: data.phone ?? "" });
      setShowAddForm(false);
    } catch {
      setCreateErr("เกิดข้อผิดพลาด");
    } finally {
      setCreating(false);
    }
  };

  const selected = !!value.id;

  return (
    <div className="space-y-2">
      {/* Search row */}
      <div className="relative" ref={wrapRef}>
        <div className="flex items-center border rounded-lg px-3 py-2 gap-2"
          style={{
            borderColor:     selected ? "#22c55e" : "#D6BCAE",
            backgroundColor: selected ? "#F0FFF4" : "white",
          }}>
          {selected
            ? <User   className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#22c55e" }} />
            : <Search className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#A08070" }} />
          }
          <input
            type="text"
            placeholder="ค้นหาลูกค้า (ชื่อ / เบอร์)"
            value={query}
            onChange={(e) => {
              const v = e.target.value;
              // user is typing free-text → tentative new customer (no id)
              onChange({ id: null, name: v, phone: value.phone });
              search(v);
            }}
            onFocus={() => { if (suggestions.length > 0) setShowSug(true); }}
            className="flex-1 text-sm outline-none bg-transparent min-w-0"
            style={{ color: "#3B2A24" }}
          />
          {(query || selected) && (
            <button type="button" onClick={clear} style={{ color: "#A08070" }}>
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Suggestions dropdown */}
        {showSug && suggestions.length > 0 && (
          <div className="absolute z-50 left-0 right-0 top-full mt-1 rounded-xl border shadow-lg overflow-hidden"
            style={{ borderColor: "#E8D8CC", backgroundColor: "white" }}>
            {suggestions.map((c) => (
              <button
                key={c.id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); select(c); }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-stone-50 text-left"
              >
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 text-white"
                  style={{ backgroundColor: "#8B1D24" }}>
                  {c.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "#3B2A24" }}>{c.name}</p>
                  {c.phone && <p className="text-xs" style={{ color: "#A08070" }}>{c.phone}</p>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* + Add customer button */}
      {!selected && !showAddForm && (
        <button
          type="button"
          onClick={openAddForm}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium border-2 transition-colors hover:bg-stone-50"
          style={{ borderColor: "#8B1D24", color: "#8B1D24", borderStyle: "dashed" }}
        >
          <UserPlus className="w-3.5 h-3.5" />
          เพิ่มลูกค้าใหม่
        </button>
      )}

      {/* Inline add-customer form */}
      {showAddForm && (
        <div className="rounded-xl border-2 p-3 space-y-2"
          style={{ borderColor: "#8B1D24", backgroundColor: "#FFF8F4" }}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold" style={{ color: "#8B1D24" }}>เพิ่มลูกค้าใหม่</p>
            <button type="button" onClick={() => setShowAddForm(false)} style={{ color: "#A08070" }}>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <input
            type="text"
            placeholder="ชื่อ-นามสกุล *"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
            style={{ borderColor: "#D6BCAE" }}
          />
          <input
            type="text"
            placeholder="ชื่อเล่น (ไม่บังคับ)"
            value={newNickname}
            onChange={(e) => setNewNickname(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
            style={{ borderColor: "#D6BCAE" }}
          />
          <input
            type="tel"
            placeholder={`เบอร์โทร${requirePhoneOnCreate ? " *" : " (ไม่บังคับ)"}`}
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
            style={{ borderColor: "#D6BCAE" }}
          />
          <div className="flex gap-1.5">
            {[
              { v: "FEMALE", t: "หญิง" },
              { v: "MALE",   t: "ชาย" },
              { v: "OTHER",  t: "อื่น ๆ" },
            ].map(g => (
              <button
                key={g.v}
                type="button"
                onClick={() => setNewGender(newGender === g.v ? "" : g.v)}
                className="flex-1 py-1.5 rounded-lg text-xs transition-colors"
                style={{
                  backgroundColor: newGender === g.v ? "#8B1D24" : "white",
                  color:           newGender === g.v ? "white"   : "#6B5245",
                  border:          "1px solid #D6BCAE",
                }}
              >
                {g.t}
              </button>
            ))}
          </div>
          {createErr && <p className="text-xs text-red-600">{createErr}</p>}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="flex-1 py-2 rounded-lg text-xs font-medium"
              style={{ border: "1px solid #D6BCAE", color: "#6B5245", background: "white" }}
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={submitNewCustomer}
              disabled={creating}
              className="flex-1 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: "#8B1D24" }}
            >
              {creating ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        </div>
      )}

      {/* Selected info chip / manual phone */}
      {selected ? (
        <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: "#F0FFF4", border: "1px solid #BBF7D0" }}>
          <p className="font-medium" style={{ color: "#166534" }}>{value.name}</p>
          {value.phone && <p className="text-xs mt-0.5" style={{ color: "#15803d" }}>{value.phone}</p>}
        </div>
      ) : showManualPhone && !showAddForm && (
        <input
          type="tel"
          placeholder="เบอร์โทร (ไม่บังคับ)"
          value={value.phone}
          onChange={(e) => onChange({ ...value, phone: e.target.value })}
          className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
          style={{ borderColor: "#D6BCAE" }}
        />
      )}
    </div>
  );
}
