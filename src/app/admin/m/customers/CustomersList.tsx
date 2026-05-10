"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Search, Plus, User, Phone, Sparkles, Clock, Package } from "lucide-react";

const PRIMARY = "#8B1D24";
const TEXT    = "#3B2A24";
const MUTED   = "#A08070";
const BORDER  = "#E8D8CC";

interface CustomerRow {
  id:         string;
  name:       string;
  nickname:   string | null;
  phone:      string;
  bookings:   number;
  isMember:   boolean;
  isPending:  boolean;
  hasPackage?: boolean;
}

/** Single customer row card — shared by both grouped browse and flat search render. */
function CustomerRow({ c }: { c: CustomerRow }) {
  return (
    <li>
      <Link
        href={`/admin/m/customers/${c.id}`}
        className="block rounded-xl border p-3"
        style={{ borderColor: BORDER, background: "white" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 text-white"
            style={{ background: PRIMARY }}
          >
            {c.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium truncate" style={{ color: TEXT }}>{c.name}</p>
              {c.isMember && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: "#F0FDF4", color: "#166534" }}>
                  <Sparkles size={9} className="inline mr-0.5" />สมาชิก
                </span>
              )}
              {c.isPending && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: "#FFF7ED", color: "#9A3412" }}>
                  รอเปิดใช้
                </span>
              )}
              {c.hasPackage && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: "#EFF6FF", color: "#1D4ED8" }}>
                  <Package size={9} className="inline mr-0.5" />แพ็กเกจ
                </span>
              )}
            </div>
            {c.nickname && (
              <p className="text-xs truncate" style={{ color: MUTED }}>{c.nickname}</p>
            )}
            <p className="text-[11px] mt-0.5 flex items-center gap-2" style={{ color: MUTED }}>
              <span className="inline-flex items-center gap-1"><Phone size={10} />{c.phone}</span>
              {c.bookings > 0 && (
                <span className="inline-flex items-center gap-1"><Clock size={10} />{c.bookings} จอง</span>
              )}
            </p>
          </div>
          <User size={14} style={{ color: MUTED }} />
        </div>
      </Link>
    </li>
  );
}

/** Group a sorted list by the first character of each customer's name. */
function groupByInitial(list: CustomerRow[]) {
  const groups: { initial: string; items: CustomerRow[] }[] = [];
  for (const c of list) {
    const initial = c.name.charAt(0) || "#";
    const last    = groups[groups.length - 1];
    if (last && last.initial === initial) last.items.push(c);
    else groups.push({ initial, items: [c] });
  }
  return groups;
}

export default function CustomersList({ initialCustomers }: { initialCustomers: CustomerRow[] }) {
  const router = useRouter();
  const [query,      setQuery]      = useState("");
  const [memberOnly, setMemberOnly] = useState(false);
  const [results, setResults] = useState<CustomerRow[] | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults(null); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/customers?q=${encodeURIComponent(query)}&limit=50`);
        if (res.ok) {
          const data: { id: string; name: string; nickname: string | null; phone: string; isMember?: boolean; isPending?: boolean; hasPackage?: boolean }[] = await res.json();
          setResults(data.map(d => ({
            id:        d.id,
            name:      d.name,
            nickname:  d.nickname,
            phone:     d.phone,
            bookings:  0,
            isMember:  d.isMember  ?? false,
            isPending: d.isPending ?? false,
            hasPackage: d.hasPackage ?? false,
          })));
        }
      } catch { /* ignore */ }
    }, 250);
  }, [query]);

  const baseList = results ?? initialCustomers;
  const list     = memberOnly ? baseList.filter(c => c.isMember || c.isPending) : baseList;

  return (
    <main className="pb-32">
      <header className="sticky top-0 z-20 bg-white" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <div className="px-4 py-3 flex items-center gap-2">
          <button onClick={() => router.push("/admin/m")} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ color: TEXT }}>
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-base font-medium flex-1" style={{ color: TEXT }}>ลูกค้า</h1>
          <Link
            href="/admin/m/customers/new"
            className="flex items-center gap-1 px-3 h-9 rounded-full text-sm font-medium text-white"
            style={{ background: PRIMARY }}
          >
            <Plus size={15} /> เพิ่ม
          </Link>
        </div>
        <div className="px-4 pb-3 space-y-2">
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
          {/* Filter pills */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMemberOnly(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
              style={memberOnly
                ? { background: "#F0FDF4", color: "#166534", border: "1.5px solid #86EFAC" }
                : { background: "white", color: MUTED, border: `1.5px solid ${BORDER}` }
              }
            >
              <Sparkles size={11} />
              สมาชิก
              {memberOnly && (
                <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "#DCFCE7", color: "#166534" }}>
                  {list.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <section className="px-4 pt-3 pb-6">
        {list.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed p-8 text-center" style={{ borderColor: BORDER, color: MUTED }}>
            <p className="text-sm font-medium">ไม่พบลูกค้า</p>
            <p className="text-xs mt-1">ลองค้นหาด้วยคำอื่น หรือกด &quot;เพิ่ม&quot; เพื่อสร้างใหม่</p>
          </div>
        ) : results ? (
          /* ── Search results: flat list ── */
          <ul className="space-y-2">
            {list.map(c => <CustomerRow key={c.id} c={c} />)}
          </ul>
        ) : (
          /* ── Browse mode: grouped by initial ── */
          <div className="space-y-5">
            {groupByInitial(list).map(({ initial, items }) => (
              <div key={initial}>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <span className="text-base font-bold" style={{ color: PRIMARY }}>{initial}</span>
                  <div className="flex-1 h-px" style={{ background: BORDER }} />
                </div>
                <ul className="space-y-2">
                  {items.map(c => <CustomerRow key={c.id} c={c} />)}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
