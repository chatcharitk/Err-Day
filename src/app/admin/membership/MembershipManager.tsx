"use client";

import { useState, useEffect, useCallback } from "react";
import { Save, RefreshCw, Percent, Tag } from "lucide-react";

const PRIMARY = "#8B1D24";
const BORDER  = "#E8D8CC";
const TEXT    = "#3B2A24";
const MUTED   = "#A08070";
const BG      = "#FDF7F2";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BranchPrice { branchId: string; price: number; branch: { name: string } }

interface ServiceRow {
  id:                    string;
  nameTh:                string;
  name:                  string;
  category:              string;
  memberDiscountPercent: number;
  branches:              BranchPrice[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtBaht(satang: number) {
  return (satang / 100).toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/** lowest branch price for a service (satang), or null */
function basePrice(svc: ServiceRow): number | null {
  if (!svc.branches.length) return null;
  return Math.min(...svc.branches.map(b => b.price));
}

/** satang → baht display string */
function satangToDisplay(s: number) { return (s / 100).toFixed(2).replace(/\.00$/, ""); }

// ─── Per-service discount row ─────────────────────────────────────────────────

interface RowState {
  pct:     string; // discount %
  net:     string; // net price in baht
  changed: boolean;
}

function ServiceDiscountRow({
  svc,
  state,
  onChange,
}: {
  svc:      ServiceRow;
  state:    RowState;
  onChange: (next: RowState) => void;
}) {
  const base = basePrice(svc); // satang or null

  function handlePctChange(raw: string) {
    const pctNum = parseFloat(raw);
    if (base !== null && !isNaN(pctNum) && raw !== "") {
      const netSatang = Math.round(base * (1 - Math.min(100, Math.max(0, pctNum)) / 100));
      onChange({ pct: raw, net: satangToDisplay(netSatang), changed: true });
    } else {
      onChange({ pct: raw, net: state.net, changed: true });
    }
  }

  function handleNetChange(raw: string) {
    const netBaht = parseFloat(raw);
    if (base !== null && !isNaN(netBaht) && raw !== "" && base > 0) {
      const netSatang = Math.round(netBaht * 100);
      const pct = Math.max(0, Math.min(100, ((base - netSatang) / base) * 100));
      onChange({ pct: pct.toFixed(1).replace(/\.0$/, ""), net: raw, changed: true });
    } else {
      onChange({ pct: state.pct, net: raw, changed: true });
    }
  }

  const pctNum = parseFloat(state.pct) || 0;
  const hasDiscount = pctNum > 0;

  return (
    <tr
      className="border-b last:border-0 transition-colors"
      style={{ borderColor: BORDER, background: state.changed ? "#FFFBF5" : "white" }}
    >
      {/* Service name */}
      <td className="px-4 py-3">
        <p className="text-sm font-medium" style={{ color: TEXT }}>{svc.nameTh || svc.name}</p>
        <p className="text-xs" style={{ color: MUTED }}>{svc.category}</p>
      </td>

      {/* Base price */}
      <td className="px-4 py-3 text-right">
        {base !== null ? (
          <div>
            <p className="text-sm font-medium" style={{ color: TEXT }}>฿{fmtBaht(base)}</p>
            {svc.branches.length > 1 && (
              <p className="text-xs" style={{ color: MUTED }}>ราคาต่ำสุด</p>
            )}
          </div>
        ) : (
          <span className="text-xs" style={{ color: MUTED }}>—</span>
        )}
      </td>

      {/* Discount % input */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            min="0"
            max="100"
            step="1"
            value={state.pct}
            onChange={e => handlePctChange(e.target.value)}
            placeholder="0"
            className="w-16 px-2 py-1.5 text-sm rounded-lg border text-right"
            style={{
              borderColor: hasDiscount ? PRIMARY : BORDER,
              color: hasDiscount ? PRIMARY : TEXT,
              fontWeight: hasDiscount ? 600 : 400,
            }}
          />
          <span className="text-sm" style={{ color: MUTED }}>%</span>
        </div>
      </td>

      {/* Net price input */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="text-sm" style={{ color: MUTED }}>฿</span>
          <input
            type="number"
            min="0"
            step="1"
            value={state.net}
            onChange={e => handleNetChange(e.target.value)}
            placeholder={base !== null ? satangToDisplay(base) : "—"}
            disabled={base === null}
            className="w-24 px-2 py-1.5 text-sm rounded-lg border text-right"
            style={{
              borderColor: hasDiscount ? "#059669" : BORDER,
              color: hasDiscount ? "#059669" : TEXT,
              fontWeight: hasDiscount ? 600 : 400,
              background: base === null ? BG : "white",
            }}
          />
        </div>
      </td>

      {/* Per-branch breakdown */}
      <td className="px-4 py-3">
        {hasDiscount && svc.branches.length > 0 ? (
          <div className="space-y-0.5">
            {svc.branches.map(b => {
              const net = Math.round(b.price * (1 - pctNum / 100));
              return (
                <div key={b.branchId} className="flex items-center gap-1.5 text-xs">
                  <span style={{ color: MUTED }} className="truncate max-w-20">
                    {b.branch.name.replace("err.day ", "")}
                  </span>
                  <span style={{ color: TEXT }}>
                    <span className="line-through" style={{ color: MUTED }}>
                      ฿{fmtBaht(b.price)}
                    </span>
                    {" → "}
                    <strong style={{ color: "#059669" }}>฿{fmtBaht(net)}</strong>
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <span className="text-xs" style={{ color: MUTED }}>—</span>
        )}
      </td>

      {/* Reset */}
      <td className="px-2 py-3">
        {(state.changed || pctNum > 0) && (
          <button
            onClick={() => onChange({ pct: "0", net: "", changed: true })}
            title="ล้างส่วนลด"
            className="p-1.5 rounded-lg hover:bg-gray-100"
          >
            <RefreshCw size={13} style={{ color: MUTED }} />
          </button>
        )}
      </td>
    </tr>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MembershipManager() {
  const [services,  setServices]  = useState<ServiceRow[]>([]);
  const [rowStates, setRowStates] = useState<Record<string, RowState>>({});
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [error,     setError]     = useState("");
  const [category,  setCategory]  = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data: ServiceRow[] = await fetch("/api/admin/services/member-discounts").then(r => r.json());
      setServices(data);
      const initial: Record<string, RowState> = {};
      for (const s of data) {
        const base = s.branches.length ? Math.min(...s.branches.map(b => b.price)) : null;
        const pct  = s.memberDiscountPercent;
        const net  = base !== null && pct > 0
          ? satangToDisplay(Math.round(base * (1 - pct / 100)))
          : "";
        initial[s.id] = { pct: pct > 0 ? String(pct) : "", net, changed: false };
      }
      setRowStates(initial);
    } catch {
      setError("โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const updates = services.map(s => ({
        id:                    s.id,
        memberDiscountPercent: Math.min(100, Math.max(0, parseFloat(rowStates[s.id]?.pct || "0") || 0)),
      }));
      const res = await fetch("/api/admin/services/member-discounts", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(updates),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "บันทึกไม่สำเร็จ");
      // Mark all as unchanged
      setRowStates(prev => Object.fromEntries(
        Object.entries(prev).map(([k, v]) => [k, { ...v, changed: false }]),
      ));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setSaving(false);
    }
  }

  const categories = ["all", ...Array.from(new Set(services.map(s => s.category))).sort()];
  const filtered   = category === "all" ? services : services.filter(s => s.category === category);
  const anyChanged = Object.values(rowStates).some(r => r.changed);
  const withDiscount = services.filter(s => (parseFloat(rowStates[s.id]?.pct || "0") || 0) > 0).length;

  return (
    <div className="px-6 py-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: MUTED }}>Admin</p>
          <h1 className="text-2xl font-medium" style={{ color: TEXT }}>ส่วนลดสมาชิก</h1>
          <p className="text-sm mt-0.5" style={{ color: MUTED }}>
            ตั้งส่วนลด (%) หรือราคาสมาชิก (฿) ต่อบริการ — แก้ไขอย่างใดอย่างหนึ่ง อีกค่าคำนวณอัตโนมัติ
          </p>
        </div>

        <div className="flex items-center gap-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          {saved && (
            <span className="text-sm font-medium" style={{ color: "#059669" }}>✓ บันทึกแล้ว</span>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !anyChanged}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium text-white transition-opacity disabled:opacity-40"
            style={{ background: PRIMARY }}
          >
            <Save size={15} />
            {saving ? "กำลังบันทึก..." : "บันทึกทั้งหมด"}
          </button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="rounded-2xl p-4 bg-white" style={{ border: `1.5px solid ${BORDER}` }}>
          <p className="text-xs mb-1" style={{ color: MUTED }}>บริการทั้งหมด</p>
          <p className="text-xl font-semibold" style={{ color: TEXT }}>{services.length}</p>
        </div>
        <div className="rounded-2xl p-4 bg-white" style={{ border: `1.5px solid ${BORDER}` }}>
          <p className="text-xs mb-1" style={{ color: MUTED }}>มีส่วนลดสมาชิก</p>
          <p className="text-xl font-semibold" style={{ color: PRIMARY }}>{withDiscount}</p>
        </div>
        <div className="rounded-2xl p-4 bg-white" style={{ border: `1.5px solid ${BORDER}` }}>
          <p className="text-xs mb-1" style={{ color: MUTED }}>ยังไม่มีส่วนลด</p>
          <p className="text-xl font-semibold" style={{ color: MUTED }}>{services.length - withDiscount}</p>
        </div>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap mb-4">
        {categories.map(c => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className="px-3 py-1.5 text-xs rounded-full font-medium transition-colors"
            style={
              category === c
                ? { background: PRIMARY, color: "white" }
                : { background: BG, color: MUTED, border: `1px solid ${BORDER}` }
            }
          >
            {c === "all" ? "ทั้งหมด" : c}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-16" style={{ color: MUTED }}>กำลังโหลด...</div>
      ) : (
        <div className="rounded-2xl bg-white overflow-hidden" style={{ border: `1.5px solid ${BORDER}` }}>
          <table className="w-full">
            <thead>
              <tr style={{ background: BG, borderBottom: `1px solid ${BORDER}` }}>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                  style={{ color: MUTED }}>บริการ</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide"
                  style={{ color: MUTED }}>ราคาปกติ</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                  style={{ color: MUTED }}>
                  <span className="flex items-center gap-1"><Percent size={11} />ส่วนลด</span>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                  style={{ color: MUTED }}>
                  <span className="flex items-center gap-1"><Tag size={11} />ราคาสมาชิก</span>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                  style={{ color: MUTED }}>รายละเอียดต่อสาขา</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-sm" style={{ color: MUTED }}>
                    ไม่มีบริการ
                  </td>
                </tr>
              ) : (
                filtered.map(svc => (
                  <ServiceDiscountRow
                    key={svc.id}
                    svc={svc}
                    state={rowStates[svc.id] ?? { pct: "", net: "", changed: false }}
                    onChange={next => setRowStates(prev => ({ ...prev, [svc.id]: next }))}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {anyChanged && (
        <div
          className="fixed bottom-6 right-6 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl text-white text-sm font-medium"
          style={{ background: PRIMARY, zIndex: 50 }}
        >
          มีการเปลี่ยนแปลงที่ยังไม่บันทึก
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1 rounded-xl font-semibold"
            style={{ background: "rgba(255,255,255,0.2)" }}
          >
            <Save size={13} /> {saving ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>
      )}

      {/* Line integration */}
      <div className="mt-8 rounded-2xl p-4 bg-white" style={{ border: `1.5px solid ${BORDER}` }}>
        <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: PRIMARY }}>
          Line Integration
        </p>
        <p className="text-sm mb-2" style={{ color: TEXT }}>
          ลูกค้าดูสถานะสมาชิก + ราคาสมาชิกต่อบริการได้ที่:
        </p>
        <code className="text-xs px-3 py-1.5 rounded-lg block break-all" style={{ background: BG, color: PRIMARY }}>
          {typeof window !== "undefined" ? window.location.origin : "https://book.err-daysalon.com"}/liff/membership
        </code>
        <p className="text-xs mt-2" style={{ color: MUTED }}>
          เพิ่ม URL นี้ใน Line Official Account Rich Menu เพื่อให้ลูกค้าเช็กสถานะได้เอง
        </p>
      </div>
    </div>
  );
}
