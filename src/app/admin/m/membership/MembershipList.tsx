"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Search, Sparkles, AlertCircle, Clock } from "lucide-react";

const PRIMARY = "#8B1D24";
const TEXT    = "#3B2A24";
const MUTED   = "#A08070";
const BORDER  = "#E8D8CC";

interface Membership {
  id:                string;
  label:             string;
  activatedAt:       string;
  expiresAt:         string | null;
  usagesUsed:        number;
  usagesAllowed:     number;
  pendingActivation: boolean;
  customer: { id: string; name: string; nickname: string | null; phone: string; pictureUrl: string | null };
}

type Filter = "all" | "active" | "pending" | "expiring" | "expired";

function fmtDate(iso: string | null): string {
  if (!iso) return "ตลอดชีพ";
  return new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}

function statusOf(m: Membership): "active" | "pending" | "expired" {
  if (m.pendingActivation) return "pending";
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const expired = m.expiresAt != null && new Date(m.expiresAt) < today;
  const usedUp = m.usagesAllowed > 0 && m.usagesUsed >= m.usagesAllowed;
  if (expired || usedUp) return "expired";
  return "active";
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export default function MembershipList({ memberships }: { memberships: Membership[] }) {
  const router = useRouter();
  const [query, setQuery]   = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(() => {
    let list = memberships;
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(m =>
        m.customer.name.toLowerCase().includes(q) ||
        (m.customer.nickname?.toLowerCase().includes(q) ?? false) ||
        m.customer.phone.includes(q)
      );
    }
    if (filter !== "all") {
      list = list.filter(m => {
        const s = statusOf(m);
        if (filter === "expiring") {
          if (s !== "active") return false;
          const d = daysUntil(m.expiresAt);
          return d != null && d <= 7;
        }
        return s === filter;
      });
    }
    return list;
  }, [memberships, query, filter]);

  const counts = useMemo(() => {
    const c = { all: memberships.length, active: 0, pending: 0, expiring: 0, expired: 0 };
    for (const m of memberships) {
      const s = statusOf(m);
      if (s === "active")  c.active++;
      if (s === "pending") c.pending++;
      if (s === "expired") c.expired++;
      if (s === "active") {
        const d = daysUntil(m.expiresAt);
        if (d != null && d <= 7) c.expiring++;
      }
    }
    return c;
  }, [memberships]);

  return (
    <main className="pb-20">
      <header className="sticky top-0 z-20 bg-white" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <div className="px-4 py-3 flex items-center gap-2">
          <button onClick={() => router.push("/admin/m")} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ color: TEXT }}>
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-base font-medium flex-1" style={{ color: TEXT }}>สมาชิก</h1>
        </div>
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 border rounded-xl px-3 py-2.5" style={{ borderColor: BORDER }}>
            <Search size={15} style={{ color: MUTED }} />
            <input
              type="text"
              placeholder="ค้นหาชื่อหรือเบอร์โทร"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="flex-1 text-sm outline-none bg-transparent"
              style={{ color: TEXT }}
            />
          </div>
        </div>
        {/* Filter tabs */}
        <div className="px-4 pb-3 flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {[
            { k: "all"      as Filter, label: "ทั้งหมด",   count: counts.all },
            { k: "active"   as Filter, label: "ใช้งานได้", count: counts.active },
            { k: "expiring" as Filter, label: "ใกล้หมด",   count: counts.expiring },
            { k: "pending"  as Filter, label: "รอเปิด",    count: counts.pending },
            { k: "expired"  as Filter, label: "หมดอายุ",   count: counts.expired },
          ].map(t => (
            <button
              key={t.k}
              onClick={() => setFilter(t.k)}
              className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs"
              style={{
                background: filter === t.k ? PRIMARY : "white",
                color:      filter === t.k ? "white"  : TEXT,
                border:     `1px solid ${filter === t.k ? PRIMARY : BORDER}`,
              }}
            >
              {t.label} <span style={{ opacity: 0.7 }}>{t.count}</span>
            </button>
          ))}
        </div>
      </header>

      <section className="px-4 pt-3">
        {filtered.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed p-8 text-center" style={{ borderColor: BORDER, color: MUTED }}>
            <p className="text-sm font-medium">ไม่พบสมาชิก</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {filtered.map(m => {
              const s = statusOf(m);
              const days = daysUntil(m.expiresAt);
              const colorBg =
                s === "active"  ? (days != null && days <= 7 ? "#FFFBEB" : "#F0FDF4") :
                s === "pending" ? "#FFF7ED" :
                "#F3F4F6";
              const colorBorder =
                s === "active"  ? (days != null && days <= 7 ? "#FDE68A" : "#86EFAC") :
                s === "pending" ? "#FED7AA" :
                "#E5E7EB";
              const colorFg =
                s === "active"  ? (days != null && days <= 7 ? "#92400E" : "#166534") :
                s === "pending" ? "#9A3412" :
                "#6B7280";
              return (
                <li key={m.id}>
                  <Link
                    href={`/admin/m/customers/${m.customer.id}`}
                    className="block rounded-xl p-3"
                    style={{ background: colorBg, border: `1px solid ${colorBorder}` }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 text-white" style={{ background: PRIMARY }}>
                        {m.customer.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium truncate" style={{ color: TEXT }}>
                            {m.customer.name}
                            {m.customer.nickname && <span style={{ color: MUTED }}> · {m.customer.nickname}</span>}
                          </p>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold inline-flex items-center gap-0.5" style={{ background: "white", color: colorFg }}>
                            <Sparkles size={9} />
                            {s === "active"  && (days != null && days <= 7 ? `เหลือ ${days} วัน` : "ใช้งานได้")}
                            {s === "pending" && "รอเปิดใช้งาน"}
                            {s === "expired" && "หมดอายุ"}
                          </span>
                        </div>
                        <p className="text-[11px] mt-0.5 flex items-center gap-2" style={{ color: MUTED }}>
                          <span className="inline-flex items-center gap-1"><Clock size={10} />{fmtDate(m.expiresAt)}</span>
                          {m.usagesAllowed > 0 && (
                            <span>· ใช้ {m.usagesUsed}/{m.usagesAllowed}</span>
                          )}
                          <span>· {m.customer.phone}</span>
                        </p>
                      </div>
                      {s === "expired" && <AlertCircle size={14} style={{ color: "#991B1B" }} />}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
