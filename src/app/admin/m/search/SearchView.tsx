"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Search, Phone, Loader2, Calendar, Clock } from "lucide-react";

const PRIMARY = "#8B1D24";
const TEXT    = "#3B2A24";
const MUTED   = "#A08070";
const BORDER  = "#E8D8CC";

type Status = "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED" | "NO_SHOW";

interface BookingHit {
  id:          string;
  date:        string;       // ISO
  startTime:   string;
  status:      Status;
  serviceName: string;
  branchName:  string;
}

interface CustomerHit {
  id:        string;
  name:      string;
  nickname:  string | null;
  phone:     string;
  upcoming:  BookingHit[];
}

const STATUS_META: Record<Status, { label: string; bg: string; fg: string }> = {
  PENDING:   { label: "รอยืนยัน",  bg: "#FFF7ED", fg: "#9A3412" },
  CONFIRMED: { label: "ยืนยัน",     bg: "#EFF6FF", fg: "#1D4ED8" },
  COMPLETED: { label: "เสร็จ",       bg: "#F0FDF4", fg: "#166534" },
  CANCELLED: { label: "ยกเลิก",     bg: "#F3F4F6", fg: "#6B7280" },
  NO_SHOW:   { label: "ไม่มา",       bg: "#FEF2F2", fg: "#991B1B" },
};

export default function SearchView() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [customers, setCustomers] = useState<CustomerHit[]>([]);
  const [loading,   setLoading]   = useState(false);

  const debRef = useRef<NodeJS.Timeout | null>(null);
  const reqRef = useRef(0); // ignores stale responses

  useEffect(() => {
    if (debRef.current) clearTimeout(debRef.current);
    if (q.trim().length < 1) { setCustomers([]); return; }

    debRef.current = setTimeout(async () => {
      const reqId = ++reqRef.current;
      setLoading(true);
      try {
        // Single round-trip endpoint: customers + their upcoming bookings
        const r = await fetch(`/api/admin/search?q=${encodeURIComponent(q.trim())}&limit=8`);
        if (reqId !== reqRef.current) return; // a newer query is in flight
        if (r.ok) {
          const list: CustomerHit[] = await r.json();
          setCustomers(list);
        }
      } finally {
        if (reqId === reqRef.current) setLoading(false);
      }
    }, 200);

    return () => { if (debRef.current) clearTimeout(debRef.current); };
  }, [q]);

  return (
    <main className="pb-20">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <div className="px-4 py-3 flex items-center gap-2">
          <button onClick={() => router.back()} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ color: TEXT }}>
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1 flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: "#FFF8F4", border: `1px solid ${BORDER}` }}>
            <Search size={14} style={{ color: MUTED }} />
            <input
              type="text"
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ค้นหาชื่อหรือเบอร์โทรศัพท์"
              className="flex-1 bg-transparent text-sm outline-none"
              style={{ color: TEXT }}
            />
            {loading && <Loader2 size={12} className="animate-spin" style={{ color: MUTED }} />}
          </div>
        </div>
      </header>

      {/* Results */}
      <section className="px-4 pt-4">
        {q.trim().length === 0 ? (
          <p className="text-center text-sm py-12" style={{ color: MUTED }}>
            พิมพ์เพื่อค้นหา
          </p>
        ) : customers.length === 0 ? (
          loading ? null : (
            <p className="text-center text-sm py-12" style={{ color: MUTED }}>
              ไม่พบลูกค้า
            </p>
          )
        ) : (
          <ul className="space-y-3">
            {customers.map((c) => {
              const upcoming = c.upcoming;
              return (
                <li key={c.id} className="rounded-2xl bg-white" style={{ border: `1px solid ${BORDER}` }}>
                  <div className="px-4 py-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center font-semibold flex-shrink-0"
                         style={{ background: "#FFF8F4", color: PRIMARY }}>
                      {(c.nickname || c.name)[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: TEXT }}>
                        {c.name}
                        {c.nickname && <span style={{ color: MUTED }} className="font-normal"> · {c.nickname}</span>}
                      </p>
                      <a href={`tel:${c.phone}`} className="text-xs flex items-center gap-1" style={{ color: PRIMARY }}>
                        <Phone size={10} /> {c.phone}
                      </a>
                    </div>
                  </div>

                  {upcoming.length > 0 && (
                    <div style={{ borderTop: `1px solid #F5EFE9` }}>
                      {upcoming.map((b) => {
                        const meta = STATUS_META[b.status];
                        return (
                          <Link
                            key={b.id}
                            href={`/admin/m/${b.id}`}
                            className="flex items-center gap-2 px-4 py-2.5 hover:bg-stone-50"
                            style={{ color: TEXT }}
                          >
                            <Calendar size={11} style={{ color: MUTED }} />
                            <span className="text-xs">{formatDateThaiShort(b.date)}</span>
                            <Clock size={11} style={{ color: MUTED }} />
                            <span className="text-xs">{b.startTime}</span>
                            <span className="text-xs ml-auto truncate min-w-0" style={{ color: MUTED }}>
                              {b.serviceName}
                            </span>
                            <span
                              className="text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0"
                              style={{ background: meta.bg, color: meta.fg }}
                            >
                              {meta.label}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  )}

                  {upcoming.length === 0 && (
                    <p className="px-4 py-2 text-[11px]" style={{ color: MUTED, borderTop: `1px solid #F5EFE9` }}>
                      ไม่มีนัดที่กำลังจะถึง
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

    </main>
  );
}

/** "2026-04-30T..." → "30 เม.ย." */
function formatDateThaiShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
}
