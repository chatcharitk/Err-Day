"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ChevronDown, Search, Phone, User, Loader2,
  AlertCircle, Check, X, Clock,
} from "lucide-react";

const PRIMARY = "#8B1D24";
const TEXT    = "#3B2A24";
const MUTED   = "#A08070";
const BORDER  = "#E8D8CC";

interface Branch { id: string; name: string; openTime: string | null; closeTime: string | null; }
interface Service {
  id:                    string;
  nameTh:                string;
  category:              string;
  price:                 number;
  duration:              number;
  memberPrice?:          number | null;
  memberDiscountPercent?: number;
}

/** Effective member price for a service (null = no discount configured). */
function computeMemberPrice(svc: Service): number | null {
  if (svc.memberPrice != null && svc.memberPrice > 0) return svc.memberPrice;
  if (svc.memberDiscountPercent) return Math.round(svc.price * (1 - svc.memberDiscountPercent / 100));
  return null;
}
interface Staff   { id: string; name: string; }
interface Addon   { id: string; nameTh: string; price: number; }

interface CustomerHit {
  id:          string;
  name:        string;
  nickname:    string | null;
  phone:       string;
  email:       string | null;
  isMember?:   boolean;
  isPending?:  boolean;
  hasPackage?: boolean;
}

interface Props {
  branches:       Branch[];
  activeBranchId: string;
  defaultDate:    string;
  branchServices: Service[];
  branchStaff:    Staff[];
  addons:         Addon[];
}

function formatPrice(satang: number) { return `฿${(satang / 100).toLocaleString()}`; }

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

// 15-min granularity for admin-created bookings — accommodates 45-min services
// like สระไดร์. Customer-facing booking flow still uses 30-min slots.
function generateTimeSlots(openTime: string, closeTime: string): string[] {
  const [oh, om] = openTime.split(":").map(Number);
  const [ch, cm] = closeTime.split(":").map(Number);
  const o = oh * 60 + om;
  const c = ch * 60 + cm;
  const slots: string[] = [];
  for (let t = o; t <= c - 30; t += 15) {
    slots.push(`${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`);
  }
  return slots;
}

export default function NewBookingForm({ branches, activeBranchId, defaultDate, branchServices, branchStaff, addons }: Props) {
  const router = useRouter();
  const [branchId,      setBranchId]      = useState(activeBranchId);
  const [date,          setDate]          = useState(defaultDate);
  const [serviceId,     setServiceId]     = useState<string>("");
  const [staffId,       setStaffId]       = useState<string>("");
  const [extraStaffIds, setExtraStaffIds] = useState<string[]>([]);
  const [time,      setTime]      = useState<string>("");

  // Customer
  const [isWalkin,    setIsWalkin]    = useState(false);
  const [searchQuery, setSearchQuery] = useState("");   // what's typed in the search box
  const [phone,    setPhone]    = useState("");         // actual phone for booking submission
  const [name,     setName]     = useState("");
  const [nickname, setNickname] = useState("");
  const [searchHits, setSearchHits] = useState<CustomerHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [matched, setMatched] = useState<CustomerHit | null>(null);

  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [discountBaht, setDiscountBaht] = useState(0); // discount in baht (display units)
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  const branch = branches.find((b) => b.id === branchId);
  const service = branchServices.find((s) => s.id === serviceId);

  // Group bookable services by category — exclude membership/package/hair/wellness/skin
  // Note: "บริการทั่วไป" (สระไดร์) is intentionally kept.
  const groupedEntries = useMemo(() => {
    const SKIP_CATS = ["hair", "wellness", "skin", "membership", "package", "สมาชิก", "แพ็กเกจ", "member"];
    const SKIP_IDS  = ["svc-membership-30d", "svc-buffet", "svc-pkg5",
                       "svc-member-monthly", "svc-member-pkg"];

    const out: Record<string, Service[]> = {};
    for (const s of branchServices) {
      const catL = s.category.toLowerCase();
      if (SKIP_CATS.some((ex) => catL.includes(ex))) continue;
      if (SKIP_IDS.includes(s.id)) continue;
      (out[s.category] ??= []).push(s);
    }

    // Within each category: สระ* first, then alphabetical
    for (const cat in out) {
      out[cat].sort((a, b) => {
        const aP = a.nameTh.startsWith("สระ") ? 0 : 1;
        const bP = b.nameTh.startsWith("สระ") ? 0 : 1;
        return aP - bP || a.nameTh.localeCompare(b.nameTh, "th");
      });
    }

    // Bring the category that contains สระ* to the top
    return Object.entries(out).sort(([, aI], [, bI]) => {
      const aP = aI.some((s) => s.nameTh.startsWith("สระ")) ? 0 : 1;
      const bP = bI.some((s) => s.nameTh.startsWith("สระ")) ? 0 : 1;
      return aP - bP;
    });
  }, [branchServices]);

  // Slot list adapts to day-of-week (Sunday opens at 10:00)
  const timeSlots = useMemo(() => {
    if (!branch) return [];
    const [y, m, d] = date.split("-").map(Number);
    const isSunday  = new Date(y, m - 1, d).getDay() === 0;
    const open  = isSunday ? "10:00" : (branch.openTime  ?? "08:00");
    const close = branch.closeTime ?? "21:00";
    return generateTimeSlots(open, close);
  }, [branch, date]);

  /* ── Customer search (debounced) — name, nickname, or phone ── */
  useEffect(() => {
    if (matched) return; // already selected, stop searching
    if (!searchQuery || searchQuery.length < 2) { setSearchHits([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await fetch(`/api/admin/customers?q=${encodeURIComponent(searchQuery)}&limit=8`);
        if (r.ok) {
          const json = await r.json();
          setSearchHits(json.customers ?? json ?? []);
        }
      } finally { setSearching(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [searchQuery, matched]);

  const useCustomer = (c: CustomerHit) => {
    setMatched(c);
    setPhone(c.phone);
    setName(c.name);
    setNickname(c.nickname ?? "");
    setSearchQuery("");
    setSearchHits([]);
  };

  const clearMatch = () => {
    setMatched(null);
    setPhone(""); setName(""); setNickname("");
    setSearchQuery("");
  };

  const addonTotal = selectedAddonIds.reduce((sum, id) => {
    const a = addons.find((a) => a.id === id);
    return sum + (a?.price ?? 0);
  }, 0);

  const isMember = matched?.isMember ?? false;
  const effectiveServicePrice = service
    ? (isMember ? (computeMemberPrice(service) ?? service.price) : service.price)
    : 0;

  const discountSatang = Math.round(discountBaht * 100);
  const finalPrice = service ? Math.max(0, effectiveServicePrice + addonTotal - discountSatang) : 0;

  const canSubmit = !!branchId && !!serviceId && !!date && !!time && !submitting
                 && (isWalkin || (!!phone.trim() && !!name.trim()));

  const handleSubmit = async () => {
    if (!service || !canSubmit) return;
    setErr(""); setSubmitting(true);
    try {
      const endTime = addMinutes(time, service.duration);
      const finalNickname = nickname.trim() || name.trim().split(/\s+/)[0];

      const res = await fetch("/api/bookings", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId,
          serviceId,
          staffId:    staffId || null,
          date,
          startTime:  time,
          endTime,
          totalPrice: finalPrice,
          name:       name.trim() || undefined,
          phone:      phone.trim() || undefined,
          nickname:   finalNickname || undefined,
          notes:         notes.trim() || undefined,
          addonIds:      selectedAddonIds.length > 0 ? selectedAddonIds : undefined,
          extraStaffIds: extraStaffIds.length > 0 ? extraStaffIds : undefined,
          isWalkin:      isWalkin && !(name.trim() && phone.trim()),
          skipConflictCheck: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "บันทึกไม่สำเร็จ");
        return;
      }
      router.replace(`/admin/m/${data.id ?? data.booking?.id ?? ""}`);
    } catch {
      setErr("เกิดข้อผิดพลาด");
    } finally { setSubmitting(false); }
  };

  return (
    <main className="pb-32">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <div className="px-4 py-3 flex items-center gap-2">
          <button onClick={() => router.back()} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ color: TEXT }}>
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1">
            <p className="text-xs" style={{ color: MUTED }}>การจอง</p>
            <p className="text-sm font-medium" style={{ color: TEXT }}>เพิ่มการจองใหม่</p>
          </div>
        </div>
      </header>

      {/* Branch + date */}
      <section className="px-4 pt-4 grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] uppercase tracking-widest mb-1.5 block" style={{ color: MUTED }}>สาขา</label>
          <div className="relative">
            <select
              value={branchId}
              onChange={(e) => { setBranchId(e.target.value); /* reload to get this branch's services */
                const url = new URL(window.location.href);
                url.searchParams.set("branchId", e.target.value);
                window.location.assign(url.toString());
              }}
              className="w-full appearance-none rounded-xl px-3 py-2.5 text-sm bg-white"
              style={{ border: `1px solid ${BORDER}`, color: TEXT }}
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: MUTED }} />
          </div>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-widest mb-1.5 block" style={{ color: MUTED }}>วันที่</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-xl px-3 py-2.5 text-sm bg-white"
            style={{ border: `1px solid ${BORDER}`, color: TEXT }}
          />
        </div>
      </section>

      {/* Customer */}
      <section className="px-4 pt-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>ลูกค้า</p>
          {/* Walk-in toggle — makes name & phone optional */}
          <button
            onClick={() => setIsWalkin((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all"
            style={{
              background: isWalkin ? PRIMARY : "white",
              color:      isWalkin ? "white"  : MUTED,
              border:     `1px solid ${isWalkin ? PRIMARY : BORDER}`,
            }}
          >
            {isWalkin && <Check size={10} />}
            Walk-in
          </button>
        </div>

        {/* ── Search box (hidden once a customer is matched) ── */}
        {!matched && (
          <div className="mb-2">
            <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 bg-white" style={{ border: `1px solid ${BORDER}` }}>
              <Search size={14} style={{ color: MUTED }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาชื่อ ชื่อเล่น หรือ เบอร์โทร"
                className="flex-1 text-sm outline-none bg-transparent"
                style={{ color: TEXT }}
                autoComplete="off"
              />
              {searching && <Loader2 size={12} className="animate-spin" style={{ color: MUTED }} />}
              {searchQuery && !searching && (
                <button onClick={() => { setSearchQuery(""); setSearchHits([]); }} style={{ color: MUTED }}>
                  <X size={12} />
                </button>
              )}
            </div>

            {searchHits.length > 0 && (
              <div className="mt-1 rounded-xl bg-white overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
                {searchHits.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => useCustomer(c)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm active:bg-stone-50"
                    style={{ color: TEXT, borderBottom: `1px solid ${BORDER}` }}
                  >
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
                         style={{ background: "#F0E4D8", color: PRIMARY }}>
                      {(c.nickname || c.name)[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 flex-wrap">
                        <p className="font-medium truncate">
                          {c.name}
                          {c.nickname && <span style={{ color: MUTED }}> · {c.nickname}</span>}
                        </p>
                        {c.isMember && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0" style={{ background: "#F0FDF4", color: "#166534" }}>สมาชิก</span>
                        )}
                        {c.isPending && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0" style={{ background: "#FFF7ED", color: "#9A3412" }}>รอเปิดใช้</span>
                        )}
                        {c.hasPackage && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0" style={{ background: "#EFF6FF", color: "#1D4ED8" }}>แพ็กเกจ</span>
                        )}
                      </div>
                      <p className="text-[11px]" style={{ color: MUTED }}>{c.phone}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {searchQuery.length >= 2 && !searching && searchHits.length === 0 && (
              <p className="text-xs mt-1.5 px-1" style={{ color: MUTED }}>ไม่พบลูกค้า — กรอกข้อมูลด้านล่าง</p>
            )}
          </div>
        )}

        {/* ── Matched customer card ── */}
        {matched ? (
          <div className="rounded-2xl bg-white p-4 flex items-center gap-3" style={{ border: `1.5px solid ${PRIMARY}` }}>
            <div className="w-10 h-10 rounded-full flex items-center justify-center font-semibold flex-shrink-0"
                 style={{ background: "#FFF8F4", color: PRIMARY }}>
              {(matched.nickname || matched.name)[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 flex-wrap">
                <p className="text-sm font-semibold" style={{ color: TEXT }}>
                  {matched.name}
                  {matched.nickname && <span style={{ color: MUTED }}> · {matched.nickname}</span>}
                </p>
                {matched.isMember && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: "#F0FDF4", color: "#166534" }}>สมาชิก</span>
                )}
                {matched.hasPackage && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: "#EFF6FF", color: "#1D4ED8" }}>แพ็กเกจ</span>
                )}
              </div>
              <p className="text-xs" style={{ color: MUTED }}>{matched.phone}</p>
            </div>
            <button onClick={clearMatch} className="p-2" style={{ color: MUTED }} aria-label="ล้าง">
              <X size={16} />
            </button>
          </div>
        ) : (
          /* ── Manual entry — optional when Walk-in is on ── */
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 bg-white" style={{ border: `1px solid ${BORDER}` }}>
              <Phone size={14} style={{ color: MUTED }} />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={isWalkin ? "เบอร์โทรศัพท์ (ไม่บังคับ)" : "เบอร์โทรศัพท์ *"}
                className="flex-1 text-sm outline-none bg-transparent"
                style={{ color: TEXT }}
              />
            </div>

            <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 bg-white" style={{ border: `1px solid ${BORDER}` }}>
              <User size={14} style={{ color: MUTED }} />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={isWalkin ? "ชื่อ-นามสกุล (ไม่บังคับ)" : "ชื่อ-นามสกุล *"}
                className="flex-1 text-sm outline-none bg-transparent"
                style={{ color: TEXT }}
              />
            </div>

            <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 bg-white" style={{ border: `1px solid ${BORDER}` }}>
              <span className="text-xs" style={{ color: MUTED }}>ชื่อเล่น</span>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder={name.trim().split(/\s+/)[0] || "—"}
                className="flex-1 text-sm outline-none bg-transparent"
                style={{ color: TEXT }}
              />
            </div>
            {isWalkin && !(name.trim() && phone.trim()) && (
              <p className="text-[10px]" style={{ color: MUTED }}>
                หากไม่กรอกชื่อ ระบบจะบันทึกเป็น &quot;Walk-in&quot; โดยอัตโนมัติ
              </p>
            )}
            {isWalkin && name.trim() && phone.trim() && (
              <p className="text-[10px] px-2 py-1.5 rounded-lg" style={{ background: "#F0FDF4", color: "#166534" }}>
                ✓ จะลงทะเบียนเป็นลูกค้าในระบบอัตโนมัติ
              </p>
            )}
          </div>
        )}
      </section>

      {/* Service */}
      <section className="px-4 pt-5">
        <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: MUTED }}>บริการ</p>
        <div className="space-y-3">
          {groupedEntries.map(([cat, items]) => (
            <div key={cat}>
              <p className="text-xs font-medium mb-1.5" style={{ color: PRIMARY }}>{cat}</p>
              <div className="grid grid-cols-2 gap-2">
                {items.map((s) => {
                  const selected = s.id === serviceId;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setServiceId(s.id)}
                      className="rounded-xl p-3 text-left"
                      style={{
                        background: selected ? "#FFF8F4" : "white",
                        border: `1.5px solid ${selected ? PRIMARY : BORDER}`,
                        color: TEXT,
                      }}
                    >
                      <p className="text-xs font-medium leading-tight">{s.nameTh}</p>
                      <p className="text-[10px] mt-1 flex items-center gap-1" style={{ color: MUTED }}>
                        <Clock size={9} />{s.duration} นาที
                      </p>
                      {isMember && computeMemberPrice(s) !== null && computeMemberPrice(s)! < s.price ? (
                        <div className="mt-1 flex items-baseline gap-1">
                          <span className="text-[10px] line-through" style={{ color: MUTED }}>{formatPrice(s.price)}</span>
                          <span className="text-sm font-bold" style={{ color: "#16a34a" }}>{formatPrice(computeMemberPrice(s)!)}</span>
                        </div>
                      ) : (
                        <p className="text-sm font-bold mt-1" style={{ color: PRIMARY }}>{formatPrice(s.price)}</p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Add-ons */}
      {addons.length > 0 && (
        <section className="px-4 pt-5">
          <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: MUTED }}>
            เพิ่มเติม <span style={{ color: MUTED }}>(ไม่บังคับ)</span>
          </p>
          <div className="space-y-2">
            {addons.map((a) => {
              const active = selectedAddonIds.includes(a.id);
              return (
                <button
                  key={a.id}
                  onClick={() =>
                    setSelectedAddonIds((prev) =>
                      active ? prev.filter((id) => id !== a.id) : [...prev, a.id]
                    )
                  }
                  className="w-full flex items-center justify-between rounded-xl px-4 py-3 text-left"
                  style={{
                    background: active ? "#FFF8F4" : "white",
                    border:     `1.5px solid ${active ? PRIMARY : BORDER}`,
                  }}
                >
                  <p className="text-sm" style={{ color: TEXT }}>{a.nameTh}</p>
                  <p className="text-sm font-bold" style={{ color: active ? PRIMARY : MUTED }}>
                    +{formatPrice(a.price)}
                  </p>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Staff */}
      <section className="px-4 pt-5">
        <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: MUTED }}>ช่างหลัก <span style={{ color: MUTED }}>(ไม่บังคับ)</span></p>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setStaffId("")}
            className="px-3 py-1.5 rounded-full text-xs"
            style={{
              background: staffId === "" ? PRIMARY : "white",
              color:      staffId === "" ? "white"  : TEXT,
              border:     `1px solid ${staffId === "" ? PRIMARY : BORDER}`,
            }}
          >
            ไม่ระบุ
          </button>
          {branchStaff.map((s) => (
            <button
              key={s.id}
              onClick={() => setStaffId(s.id)}
              className="px-3 py-1.5 rounded-full text-xs"
              style={{
                background: staffId === s.id ? PRIMARY : "white",
                color:      staffId === s.id ? "white"  : TEXT,
                border:     `1px solid ${staffId === s.id ? PRIMARY : BORDER}`,
              }}
            >
              {s.name}
            </button>
          ))}
        </div>
        {branchStaff.length > 1 && (
          <>
            <p className="text-[10px] uppercase tracking-widest mt-3 mb-2" style={{ color: MUTED }}>ช่างเพิ่มเติม</p>
            <div className="flex flex-wrap gap-1.5">
              {branchStaff.filter(s => s.id !== staffId).map((s) => {
                const active = extraStaffIds.includes(s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => setExtraStaffIds(prev => active ? prev.filter(x => x !== s.id) : [...prev, s.id])}
                    className="px-3 py-1.5 rounded-full text-xs"
                    style={{
                      background: active ? "#374151" : "white",
                      color:      active ? "white"   : TEXT,
                      border:     `1px solid ${active ? "#374151" : BORDER}`,
                    }}
                  >
                    {s.name}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </section>

      {/* Time */}
      <section className="px-4 pt-5">
        <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: MUTED }}>เวลา</p>
        <div className="grid grid-cols-4 gap-1.5">
          {timeSlots.map((t) => (
            <button
              key={t}
              onClick={() => setTime(t)}
              className="py-2 rounded-lg text-xs font-medium"
              style={{
                background: time === t ? PRIMARY : "white",
                color:      time === t ? "white"  : TEXT,
                border:     `1px solid ${time === t ? PRIMARY : BORDER}`,
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </section>

      {/* Discount */}
      {service && (
        <section className="px-4 pt-5">
          <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: MUTED }}>ส่วนลด</p>
          <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 bg-white" style={{ border: `1px solid ${BORDER}` }}>
            <span className="text-sm" style={{ color: MUTED }}>฿</span>
            <input
              type="number"
              min={0}
              value={discountBaht || ""}
              onChange={e => setDiscountBaht(Math.max(0, Number(e.target.value)))}
              placeholder="0"
              className="flex-1 text-sm outline-none bg-transparent"
              style={{ color: TEXT }}
            />
            {discountBaht > 0 && (
              <span className="text-xs font-medium" style={{ color: "#166534" }}>
                รวม {formatPrice(finalPrice)}
              </span>
            )}
          </div>
        </section>
      )}

      {/* Notes */}
      <section className="px-4 pt-5">
        <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: MUTED }}>หมายเหตุ <span style={{ color: MUTED }}>(ไม่บังคับ)</span></p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="ข้อมูลพิเศษเกี่ยวกับลูกค้าหรือนัด"
          rows={2}
          className="w-full rounded-xl px-3 py-2.5 text-sm outline-none bg-white"
          style={{ border: `1px solid ${BORDER}`, color: TEXT, resize: "none" }}
        />
      </section>

      {/* Footer / Submit */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white p-4"
           style={{ borderTop: `1px solid ${BORDER}` }}>
        {err && (
          <div className="flex items-center gap-2 rounded-xl px-3 py-2 mb-2 text-xs" style={{ background: "#FEF2F2", color: "#991b1b" }}>
            <AlertCircle size={12} /> {err}
          </div>
        )}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full py-3.5 rounded-xl text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
          style={{ background: PRIMARY }}
        >
          {submitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          {submitting ? "กำลังบันทึก..." : `บันทึกการจอง${service ? ` · ${formatPrice(finalPrice)}` : ""}`}
        </button>
      </div>
    </main>
  );
}
