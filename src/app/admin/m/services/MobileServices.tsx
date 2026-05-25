"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Scissors, Search } from "lucide-react";

const PRIMARY = "#8B1D24";
const TEXT    = "#3B2A24";
const MUTED   = "#A08070";
const BORDER  = "#E8D8CC";
const BG      = "#FDF8F3";

interface BranchPrice {
  id:         string;
  branchId:   string;
  branchName: string;
  price:      number;   // satang
  duration:   number;
  isActive:   boolean;
}
interface Service {
  id:                     string;
  nameTh:                 string;
  name:                   string;
  category:               string;
  advanceBookingRequired: boolean;
  memberPrice:            number | null;
  memberDiscountPercent:  number;
  isActive:               boolean;
  branches:               BranchPrice[];
}
interface Branch { id: string; name: string }

interface Props {
  services: Service[];
  branches: Branch[];
}

function fmt(satang: number) { return `฿${(satang / 100).toLocaleString("th-TH")}`; }
const satangToBaht = (s: number) => s / 100;


export default function MobileServices({ services, branches }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query,    setQuery]    = useState("");

  const grouped = useMemo(() => {
    const filtered = query.trim()
      ? services.filter(s => s.nameTh.includes(query) || s.name.toLowerCase().includes(query.toLowerCase()))
      : services;
    const map = new Map<string, Service[]>();
    for (const s of filtered) {
      if (!map.has(s.category)) map.set(s.category, []);
      map.get(s.category)!.push(s);
    }
    return Array.from(map.entries());
  }, [services, query]);

  const active = services.find(s => s.id === activeId) ?? null;

  return (
    <main className="min-h-screen pb-12" style={{ background: BG }}>
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <div className="px-4 py-3 flex items-center gap-3">
          <Link href={active ? "#" : "/admin/m"}
            onClick={(e) => { if (active) { e.preventDefault(); setActiveId(null); } }}
            className="w-9 h-9 flex items-center justify-center rounded-full" style={{ color: TEXT }}>
            <ArrowLeft size={20} />
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>Services</p>
            <h1 className="text-base font-semibold leading-tight truncate" style={{ color: TEXT }}>
              {active ? active.nameTh : "บริการ & ราคา"}
            </h1>
          </div>
        </div>
      </header>

      {!active ? (
        <>
          {/* Search */}
          <section className="px-4 pt-4">
            <div className="bg-white rounded-xl flex items-center gap-2 px-3 py-2" style={{ border: `1px solid ${BORDER}` }}>
              <Search size={14} style={{ color: MUTED }} />
              <input value={query} onChange={e => setQuery(e.target.value)}
                placeholder="ค้นหาบริการ..."
                className="flex-1 outline-none text-sm bg-transparent" style={{ color: TEXT }} />
            </div>
          </section>

          {/* Grouped list */}
          <section className="px-4 pt-4 space-y-4">
            {grouped.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center" style={{ border: `1px solid ${BORDER}` }}>
                <Scissors size={24} className="mx-auto mb-2 opacity-40" style={{ color: MUTED }} />
                <p className="text-sm" style={{ color: MUTED }}>ไม่พบบริการ</p>
              </div>
            ) : (
              grouped.map(([cat, items]) => (
                <div key={cat}>
                  <p className="text-xs font-semibold px-1 mb-2 uppercase tracking-wide" style={{ color: PRIMARY }}>
                    {cat}
                  </p>
                  <ul className="space-y-2">
                    {items.map(s => {
                      const minPrice = s.branches.length > 0
                        ? Math.min(...s.branches.map(b => b.price))
                        : null;
                      const maxPrice = s.branches.length > 0
                        ? Math.max(...s.branches.map(b => b.price))
                        : null;
                      return (
                        <li key={s.id}>
                          <button onClick={() => setActiveId(s.id)}
                            className="w-full bg-white rounded-xl px-3 py-3 text-left active:scale-[0.99] transition-transform"
                            style={{
                              border: `1px solid ${BORDER}`,
                              opacity: s.isActive ? 1 : 0.5,
                            }}>
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold truncate" style={{ color: TEXT }}>
                                  {s.nameTh}
                                  {!s.isActive && (
                                    <span className="text-[10px] font-normal ml-1.5" style={{ color: MUTED }}>
                                      (ปิดใช้งาน)
                                    </span>
                                  )}
                                </p>
                                <p className="text-[11px] truncate" style={{ color: MUTED }}>
                                  {s.branches.length} สาขา
                                  {s.memberPrice && <span className="ml-1.5">· ราคาสมาชิก {fmt(s.memberPrice)}</span>}
                                  {!s.memberPrice && s.memberDiscountPercent > 0 && <span className="ml-1.5">· ส่วนลดสมาชิก {s.memberDiscountPercent}%</span>}
                                </p>
                              </div>
                              <div className="text-right flex-shrink-0">
                                {minPrice !== null && (
                                  <p className="text-sm font-bold" style={{ color: PRIMARY }}>
                                    {minPrice === maxPrice ? fmt(minPrice) : `${fmt(minPrice)} - ${fmt(maxPrice!)}`}
                                  </p>
                                )}
                              </div>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))
            )}
          </section>
        </>
      ) : (
        <ServiceEditor service={active} branches={branches} onBack={() => setActiveId(null)} />
      )}
    </main>
  );
}


// ─── Service editor (detail view) ───────────────────────────────────────────

interface EditableBranchRow {
  branchId:   string;
  branchName: string;
  price:      number;   // BAHT (for editing UX)
  duration:   number;
  isActive:   boolean;
}

function ServiceEditor({
  service, branches, onBack,
}: {
  service: Service;
  branches: Branch[];
  onBack: () => void;
}) {
  const router = useRouter();

  // Service-level state
  const [nameTh,                 setNameTh]                 = useState(service.nameTh);
  const [category,               setCategory]               = useState(service.category);
  const [advanceBookingRequired, setAdvanceBookingRequired] = useState(service.advanceBookingRequired);
  const [memberPriceBaht,        setMemberPriceBaht]        = useState<number | "">(service.memberPrice != null ? satangToBaht(service.memberPrice) : "");
  const [memberDiscountPercent,  setMemberDiscountPercent]  = useState<number>(service.memberDiscountPercent);
  const [isActive,               setIsActive]               = useState(service.isActive);

  // Per-branch rows — merge existing prices with branches that don't have one yet
  const [rows, setRows] = useState<EditableBranchRow[]>(() => {
    const byId = new Map(service.branches.map(b => [b.branchId, b]));
    return branches.map(br => {
      const existing = byId.get(br.id);
      return {
        branchId:   br.id,
        branchName: br.name,
        price:      existing ? satangToBaht(existing.price) : 0,
        duration:   existing ? existing.duration            : 60,
        isActive:   existing ? existing.isActive            : false,
      };
    });
  });

  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [error,  setError]  = useState("");

  function updateRow(branchId: string, key: keyof EditableBranchRow, value: number | boolean) {
    setRows(prev => prev.map(r => r.branchId === branchId ? { ...r, [key]: value } : r));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSaved(false); setSaving(true);

    try {
      // 1. Update service-level fields
      const r1 = await fetch(`/api/admin/services/${service.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nameTh:                 nameTh.trim(),
          category,
          advanceBookingRequired,
          memberPrice:            memberPriceBaht === "" ? null : Number(memberPriceBaht),
          memberDiscountPercent:  Number(memberDiscountPercent) || 0,
          isActive,
        }),
      });
      if (!r1.ok) throw new Error("update service failed");

      // 2. Upsert per-branch pricing
      const r2 = await fetch(`/api/admin/services/${service.id}/branches`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rows.map(r => ({
          branchId: r.branchId,
          price:    Number(r.price),
          duration: Number(r.duration),
          isActive: r.isActive,
        }))),
      });
      if (!r2.ok) throw new Error("update branch pricing failed");

      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="px-4 pt-4 pb-12 space-y-4 max-w-lg mx-auto">
      <button type="button" onClick={onBack} className="text-xs font-medium" style={{ color: PRIMARY }}>
        ← กลับไปรายชื่อบริการ
      </button>

      {/* Service-level */}
      <div className="bg-white rounded-2xl p-4 space-y-4" style={{ border: `1px solid ${BORDER}` }}>
        <Field label="ชื่อบริการ (ไทย)">
          <input value={nameTh} onChange={e => setNameTh(e.target.value)} required
            className="w-full border rounded-lg px-3 py-2.5 text-sm" style={{ borderColor: BORDER, color: TEXT }} />
        </Field>

        <Field label="หมวด">
          <input value={category} onChange={e => setCategory(e.target.value)} required
            className="w-full border rounded-lg px-3 py-2.5 text-sm" style={{ borderColor: BORDER, color: TEXT }} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="ราคาสมาชิก (฿)">
            <input type="number" inputMode="decimal" min="0" step="0.01"
              value={memberPriceBaht}
              onChange={e => setMemberPriceBaht(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="ไม่กำหนด"
              className="w-full border rounded-lg px-3 py-2.5 text-sm" style={{ borderColor: BORDER, color: TEXT }} />
          </Field>
          <Field label="ส่วนลดสมาชิก (%)">
            <input type="number" inputMode="numeric" min="0" max="100"
              value={memberDiscountPercent}
              onChange={e => setMemberDiscountPercent(Number(e.target.value))}
              className="w-full border rounded-lg px-3 py-2.5 text-sm" style={{ borderColor: BORDER, color: TEXT }} />
          </Field>
        </div>

        <label className="flex items-center justify-between gap-3 cursor-pointer">
          <div>
            <p className="text-sm font-semibold" style={{ color: TEXT }}>ต้องจองล่วงหน้า</p>
            <p className="text-xs mt-0.5" style={{ color: MUTED }}>เช่น ทำสี ดัดผม</p>
          </div>
          <input type="checkbox" checked={advanceBookingRequired}
            onChange={e => setAdvanceBookingRequired(e.target.checked)}
            className="w-5 h-5 accent-[#8B1D24]" />
        </label>

        <label className="flex items-center justify-between gap-3 cursor-pointer pt-2 border-t" style={{ borderColor: BORDER }}>
          <div>
            <p className="text-sm font-semibold" style={{ color: TEXT }}>เปิดใช้งาน</p>
            <p className="text-xs mt-0.5" style={{ color: MUTED }}>ปิดเพื่อซ่อนจากหน้าจอง</p>
          </div>
          <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)}
            className="w-5 h-5 accent-[#8B1D24]" />
        </label>
      </div>

      {/* Per-branch pricing */}
      <div className="bg-white rounded-2xl p-4 space-y-3" style={{ border: `1px solid ${BORDER}` }}>
        <h2 className="text-sm font-semibold" style={{ color: TEXT }}>ราคาและเวลาต่อสาขา</h2>
        {rows.map(r => (
          <div key={r.branchId} className="rounded-lg p-3 space-y-2"
            style={{ background: "#FAFAFA", border: `1px solid ${BORDER}` }}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold" style={{ color: TEXT }}>{r.branchName}</p>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: MUTED }}>
                <input type="checkbox" checked={r.isActive}
                  onChange={e => updateRow(r.branchId, "isActive", e.target.checked)}
                  className="w-4 h-4 accent-[#8B1D24]" />
                เปิดที่สาขานี้
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] block mb-0.5" style={{ color: MUTED }}>ราคา (฿)</label>
                <input type="number" inputMode="decimal" min="0" step="0.01"
                  value={r.price}
                  onChange={e => updateRow(r.branchId, "price", Number(e.target.value))}
                  className="w-full border rounded-md px-2 py-1.5 text-sm bg-white font-semibold" style={{ borderColor: BORDER, color: TEXT }} />
              </div>
              <div>
                <label className="text-[10px] block mb-0.5" style={{ color: MUTED }}>ระยะเวลา (นาที)</label>
                <input type="number" inputMode="numeric" min="0" step="5"
                  value={r.duration}
                  onChange={e => updateRow(r.branchId, "duration", Number(e.target.value))}
                  className="w-full border rounded-md px-2 py-1.5 text-sm bg-white" style={{ borderColor: BORDER, color: TEXT }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-red-600 px-3 py-2 rounded-lg bg-red-50">{error}</p>}
      {saved && <p className="text-sm text-green-700 px-3 py-2 rounded-lg bg-green-50">✓ บันทึกแล้ว</p>}

      <button type="submit" disabled={saving}
        className="w-full py-3 rounded-xl text-white text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
        style={{ background: PRIMARY }}>
        <Save size={16} />
        {saving ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-widest block mb-1" style={{ color: MUTED }}>
        {label}
      </label>
      {children}
    </div>
  );
}
