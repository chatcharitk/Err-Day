"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Users, CheckCircle, XCircle, Clock } from "lucide-react";

const PRIMARY = "#8B1D24";
const BORDER  = "#E8D8CC";
const TEXT    = "#3B2A24";
const MUTED   = "#A08070";
const BG      = "#FDF7F2";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MemberTier {
  id: string;
  name: string;
  discountPercent: number;
}

interface MembershipInfo {
  id: string;
  label: string | null;
  isValid: boolean;
  expired: boolean;
  usedUp: boolean;
  expiresAt: string | null;
  activatedAt: string | null;
  usagesAllowed: number;
  usagesUsed: number;
  points: number;
  tier: MemberTier | null;
}

interface CustomerRow {
  id: string;
  name: string;
  phone: string | null;
  membership: MembershipInfo;
  cycleBookings: number;
  totalBookings: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    year: "2-digit",
  });
}

function daysLeft(iso: string | null): number | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// ─── Customer membership card ─────────────────────────────────────────────────

function CustomerCard({
  row,
  onRenew,
  renewing,
}: {
  row: CustomerRow;
  onRenew: (id: string) => void;
  renewing: boolean;
}) {
  const m    = row.membership;
  const days = daysLeft(m.expiresAt);

  let statusColor = "#166534";
  let statusBg    = "#F0FFF4";
  let statusText  = "ใช้งานได้";

  if (m.expired) {
    statusColor = "#991b1b"; statusBg = "#FEF2F2"; statusText = "หมดอายุ";
  } else if (m.usedUp) {
    statusColor = "#92400e"; statusBg = "#FFFBEB"; statusText = "ใช้ครบแล้ว";
  } else if (days !== null && days <= 5) {
    statusColor = "#b45309"; statusBg = "#FFFBEB"; statusText = `เหลือ ${days} วัน`;
  }

  // Cycle usage bar (if usagesAllowed > 0)
  const hasCycleLimit = m.usagesAllowed > 0;
  const cycleUsedPct  = hasCycleLimit ? Math.min(100, Math.round((row.cycleBookings / m.usagesAllowed) * 100)) : null;

  return (
    <div
      className="rounded-2xl bg-white p-4 flex flex-col gap-3"
      style={{ border: `1.5px solid ${m.isValid ? BORDER : "#FECACA"}` }}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Avatar */}
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
            style={{ backgroundColor: m.isValid ? PRIMARY : MUTED }}
          >
            {row.name.charAt(0)}
          </div>
          {/* Name + phone */}
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate" style={{ color: TEXT }}>{row.name}</p>
            {row.phone && (
              <p className="text-xs" style={{ color: MUTED }}>{row.phone}</p>
            )}
          </div>
        </div>

        {/* Status badge */}
        <span
          className="text-xs px-2.5 py-1 rounded-full font-semibold flex-shrink-0 flex items-center gap-1"
          style={{ backgroundColor: statusBg, color: statusColor }}
        >
          {m.isValid
            ? <CheckCircle size={11} />
            : m.expired
              ? <XCircle size={11} />
              : <Clock size={11} />
          }
          {statusText}
        </span>
      </div>

      {/* Membership label + tier */}
      <div className="flex items-center gap-2 flex-wrap">
        {m.label && (
          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "#F9F0E8", color: PRIMARY }}>
            {m.label}
          </span>
        )}
        {m.tier && (
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: BG, color: MUTED }}>
            {m.tier.name}
            {m.tier.discountPercent > 0 && ` (${m.tier.discountPercent}%)`}
          </span>
        )}
        {m.points > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#EFF6FF", color: "#1d4ed8" }}>
            {m.points} แต้ม
          </span>
        )}
      </div>

      {/* Expiry + cycle stats */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <p style={{ color: MUTED }}>หมดอายุ</p>
          <p className="font-medium mt-0.5" style={{ color: m.expired ? "#991b1b" : TEXT }}>
            {fmtDate(m.expiresAt)}
          </p>
        </div>
        <div>
          <p style={{ color: MUTED }}>ครั้งที่ใช้ (รอบนี้)</p>
          <p className="font-medium mt-0.5" style={{ color: TEXT }}>
            {row.cycleBookings}
            {hasCycleLimit && ` / ${m.usagesAllowed} ครั้ง`}
          </p>
        </div>
        <div>
          <p style={{ color: MUTED }}>เริ่มรอบปัจจุบัน</p>
          <p className="font-medium mt-0.5" style={{ color: TEXT }}>{fmtDate(m.activatedAt)}</p>
        </div>
        <div>
          <p style={{ color: MUTED }}>ทั้งหมด (ตลอดกาล)</p>
          <p className="font-medium mt-0.5" style={{ color: TEXT }}>{row.totalBookings} ครั้ง</p>
        </div>
      </div>

      {/* Cycle usage progress bar */}
      {hasCycleLimit && cycleUsedPct !== null && (
        <div>
          <div className="flex items-center justify-between text-xs mb-1" style={{ color: MUTED }}>
            <span>การใช้งานรอบนี้</span>
            <span style={{ color: cycleUsedPct >= 100 ? "#991b1b" : TEXT }}>{cycleUsedPct}%</span>
          </div>
          <div className="w-full h-1.5 rounded-full" style={{ background: BORDER }}>
            <div
              className="h-1.5 rounded-full transition-all"
              style={{
                width: `${cycleUsedPct}%`,
                backgroundColor: cycleUsedPct >= 100 ? "#ef4444" : cycleUsedPct >= 80 ? "#f59e0b" : "#22c55e",
              }}
            />
          </div>
        </div>
      )}

      {/* Renew button */}
      <button
        onClick={() => onRenew(row.id)}
        disabled={renewing}
        className="w-full py-2 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
        style={{ background: m.isValid ? BG : PRIMARY, color: m.isValid ? PRIMARY : "white", border: m.isValid ? `1px solid ${BORDER}` : "none" }}
      >
        <RefreshCw size={12} className={renewing ? "animate-spin" : ""} />
        {renewing ? "กำลังต่ออายุ..." : "ต่ออายุ (+30 วัน)"}
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MembershipManager() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");
  const [renewing,  setRenewing]  = useState<string | null>(null);
  const [filter,    setFilter]    = useState<"all" | "active" | "expired">("all");
  const [search,    setSearch]    = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetch("/api/admin/membership/customers").then(r => r.json());
      setCustomers(data);
    } catch {
      setError("โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleRenew(customerId: string) {
    setRenewing(customerId);
    try {
      const res = await fetch(
        `/api/admin/membership/customers/${customerId}/renew`,
        { method: "POST" }
      );
      if (!res.ok) throw new Error();
      await load();
    } catch {
      setError("ต่ออายุไม่สำเร็จ");
    } finally {
      setRenewing(null);
    }
  }

  // Filter + search
  const filtered = customers.filter(c => {
    if (filter === "active"  && !c.membership.isValid)  return false;
    if (filter === "expired" &&  c.membership.isValid)  return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return c.name.toLowerCase().includes(q) || (c.phone ?? "").includes(q);
    }
    return true;
  });

  const activeCount  = customers.filter(c =>  c.membership.isValid).length;
  const expiredCount = customers.filter(c => !c.membership.isValid).length;

  return (
    <div className="px-6 py-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: MUTED }}>Admin</p>
          <h1 className="text-2xl font-medium" style={{ color: TEXT }}>สมาชิก</h1>
          <p className="text-sm mt-0.5" style={{ color: MUTED }}>
            ลูกค้าที่มีสมาชิก — ดูสถานะ ประวัติการใช้งาน และต่ออายุ
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm border transition-colors hover:bg-stone-50"
          style={{ borderColor: BORDER, color: MUTED }}
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          รีเฟรช
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: "สมาชิกทั้งหมด", value: customers.length, color: TEXT },
          { label: "ใช้งานได้",     value: activeCount,      color: "#166534" },
          { label: "หมดอายุ / ใช้ครบ", value: expiredCount, color: "#991b1b" },
        ].map(s => (
          <div key={s.label} className="rounded-2xl p-4 bg-white" style={{ border: `1.5px solid ${BORDER}` }}>
            <p className="text-xs mb-1" style={{ color: MUTED }}>{s.label}</p>
            <p className="text-xl font-semibold" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filter + Search */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: BG }}>
          {(["all", "active", "expired"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{
                background: filter === f ? PRIMARY    : "transparent",
                color:      filter === f ? "white"    : MUTED,
              }}
            >
              {f === "all" ? `ทั้งหมด (${customers.length})` : f === "active" ? `ใช้งานได้ (${activeCount})` : `หมดอายุ (${expiredCount})`}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="ค้นหาชื่อ / เบอร์..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-48 px-3 py-2 text-sm rounded-xl border outline-none"
          style={{ borderColor: BORDER, color: TEXT }}
        />
      </div>

      {/* Error */}
      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {/* List */}
      {loading ? (
        <div className="text-center py-16" style={{ color: MUTED }}>กำลังโหลด...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 flex flex-col items-center gap-3" style={{ color: MUTED }}>
          <Users size={36} style={{ color: BORDER }} />
          <p className="text-sm">ไม่พบสมาชิก</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(row => (
            <CustomerCard
              key={row.id}
              row={row}
              onRenew={handleRenew}
              renewing={renewing === row.id}
            />
          ))}
        </div>
      )}

      {/* Line integration note */}
      <div className="mt-8 rounded-2xl p-4 bg-white" style={{ border: `1.5px solid ${BORDER}` }}>
        <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: PRIMARY }}>
          Line Integration
        </p>
        <p className="text-sm mb-2" style={{ color: TEXT }}>
          ลูกค้าดูสถานะสมาชิกได้ที่:
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
