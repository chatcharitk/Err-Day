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
interface Service { id: string; nameTh: string; category: string; price: number; duration: number; }
interface Staff   { id: string; name: string; }

interface CustomerHit {
  id:        string;
  name:      string;
  nickname:  string | null;
  phone:     string;
  email:     string | null;
}

interface Props {
  branches:       Branch[];
  activeBranchId: string;
  defaultDate:    string;
  branchServices: Service[];
  branchStaff:    Staff[];
}

function formatPrice(satang: number) { return `฿${(satang / 100).toLocaleString()}`; }

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function generateTimeSlots(openTime: string, closeTime: string): string[] {
  const [oh, om] = openTime.split(":").map(Number);
  const [ch, cm] = closeTime.split(":").map(Number);
  const o = oh * 60 + om;
  const c = ch * 60 + cm;
  const slots: string[] = [];
  for (let t = o; t <= c - 30; t += 30) {
    slots.push(`${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`);
  }
  return slots;
}

export default function NewBookingForm({ branches, activeBranchId, defaultDate, branchServices, branchStaff }: Props) {
  const router = useRouter();
  const [branchId,  setBranchId]  = useState(activeBranchId);
  const [date,      setDate]      = useState(defaultDate);
  const [serviceId, setServiceId] = useState<string>("");
  const [staffId,   setStaffId]   = useState<string>("");
  const [time,      setTime]      = useState<string>("");

  // Customer
  const [phone,    setPhone]    = useState("");
  const [name,     setName]     = useState("");
  const [nickname, setNickname] = useState("");
  const [searchHits, setSearchHits] = useState<CustomerHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [matched, setMatched] = useState<CustomerHit | null>(null);

  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  const branch = branches.find((b) => b.id === branchId);
  const service = branchServices.find((s) => s.id === serviceId);

  // Group services by category
  const grouped = useMemo(() => {
    const out: Record<string, Service[]> = {};
    for (const s of branchServices) (out[s.category] ??= []).push(s);
    return out;
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

  /* ── Customer phone search (debounced) ── */
  useEffect(() => {
    if (matched && matched.phone === phone) return; // already matched, no need to re-search
    if (!phone || phone.length < 4) { setSearchHits([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await fetch(`/api/admin/customers?q=${encodeURIComponent(phone)}&limit=6`);
        if (r.ok) {
          const json = await r.json();
          setSearchHits(json.customers ?? json ?? []);
        }
      } finally { setSearching(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [phone, matched]);

  const useCustomer = (c: CustomerHit) => {
    setMatched(c);
    setPhone(c.phone);
    setName(c.name);
    setNickname(c.nickname ?? "");
    setSearchHits([]);
  };

  const clearMatch = () => {
    setMatched(null);
    setName(""); setNickname("");
  };

  const canSubmit = !!branchId && !!serviceId && !!date && !!time
                 && !!phone.trim() && !!name.trim() && !submitting;

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
          totalPrice: service.price,
          name:       name.trim(),
          phone:      phone.trim(),
          nickname:   finalNickname,
          notes:      notes.trim() || undefined,
          skipConflictCheck: true, // admin override; conflicts shown but allowed
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
        <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: MUTED }}>ลูกค้า</p>

        {matched ? (
          <div className="rounded-2xl bg-white p-4 flex items-center gap-3" style={{ border: `1.5px solid ${PRIMARY}` }}>
            <div className="w-10 h-10 rounded-full flex items-center justify-center font-semibold flex-shrink-0"
                 style={{ background: "#FFF8F4", color: PRIMARY }}>
              {(matched.nickname || matched.name)[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold" style={{ color: TEXT }}>
                {matched.name}
                {matched.nickname && <span style={{ color: MUTED }}> · {matched.nickname}</span>}
              </p>
              <p className="text-xs" style={{ color: MUTED }}>{matched.phone}</p>
            </div>
            <button onClick={clearMatch} className="p-2" style={{ color: MUTED }} aria-label="ล้าง">
              <X size={16} />
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 bg-white" style={{ border: `1px solid ${BORDER}` }}>
              <Phone size={14} style={{ color: MUTED }} />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="เบอร์โทรศัพท์"
                className="flex-1 text-sm outline-none bg-transparent"
                style={{ color: TEXT }}
              />
              {searching && <Loader2 size={12} className="animate-spin" style={{ color: MUTED }} />}
            </div>

            {searchHits.length > 0 && (
              <div className="rounded-xl bg-white overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
                {searchHits.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => useCustomer(c)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-stone-50"
                    style={{ color: TEXT }}
                  >
                    <Search size={12} style={{ color: MUTED }} />
                    <span className="font-medium">{c.name}</span>
                    {c.nickname && <span style={{ color: MUTED }}>· {c.nickname}</span>}
                    <span style={{ color: MUTED }} className="ml-auto text-xs">{c.phone}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 bg-white" style={{ border: `1px solid ${BORDER}` }}>
              <User size={14} style={{ color: MUTED }} />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ชื่อ-นามสกุล"
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
            <p className="text-[10px]" style={{ color: MUTED }}>
              หากเว้นว่างจะใช้ชื่อแรกของลูกค้าแทน
            </p>
          </div>
        )}
      </section>

      {/* Service */}
      <section className="px-4 pt-5">
        <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: MUTED }}>บริการ</p>
        <div className="space-y-3">
          {Object.entries(grouped).map(([cat, items]) => (
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
                      <p className="text-sm font-bold mt-1" style={{ color: PRIMARY }}>{formatPrice(s.price)}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Staff */}
      <section className="px-4 pt-5">
        <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: MUTED }}>ช่าง <span style={{ color: MUTED }}>(ไม่บังคับ)</span></p>
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
          {submitting ? "กำลังบันทึก..." : `บันทึกการจอง${service ? ` · ${formatPrice(service.price)}` : ""}`}
        </button>
      </div>
    </main>
  );
}
