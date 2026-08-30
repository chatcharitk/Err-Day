"use client";

import { useState, useEffect, useMemo } from "react";
import CustomerSearch, { type CustomerValue } from "@/components/CustomerSearch";
import {
  Modal, addMinutes, formatPrice,
  type StaffItem, type BranchServiceItem, type AddonItem,
} from "./_shared";

export default function AddBookingModal({
  defaultDate, branchId, staff, branchServices, addons, onClose, onSaved,
}: {
  defaultDate:    string;
  branchId:       string;
  staff:          StaffItem[];
  branchServices: BranchServiceItem[];
  addons:         AddonItem[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [date,             setDate]             = useState(defaultDate);
  const [serviceId,        setServiceId]        = useState("");
  const [staffId,          setStaffId]          = useState("");
  const [extraStaffIds,    setExtraStaffIds]    = useState<string[]>([]);
  const [time,             setTime]             = useState("");
  const [customer,         setCustomer]         = useState<CustomerValue>({ id: null, name: "", phone: "" });
  const [isWalkin,         setIsWalkin]         = useState(false);
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [discountBaht,     setDiscountBaht]     = useState(0);
  const [commissionBaht,   setCommissionBaht]   = useState("");
  const [notesVal,         setNotesVal]         = useState("");
  const [saving,           setSaving]           = useState(false);
  const [error,            setError]            = useState("");
  const [isMember,         setIsMember]         = useState(false);
  const [memberLoading,    setMemberLoading]    = useState(false);
  const [checkoutNow,      setCheckoutNow]      = useState(false); // create already-completed

  function toggleExtraStaff(id: string) {
    setExtraStaffIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  useEffect(() => {
    if (!customer.id || !customer.phone) { setIsMember(false); setMemberLoading(false); return; }
    let cancelled = false;
    setMemberLoading(true);
    fetch(`/api/membership?phone=${encodeURIComponent(customer.phone)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (cancelled) return;
        setIsMember(data?.hasMemberPricing === true);
      })
      .catch(() => { if (!cancelled) setIsMember(false); })
      .finally(() => { if (!cancelled) setMemberLoading(false); });
    return () => { cancelled = true; };
  }, [customer.id, customer.phone]);

  function computeMemberPrice(svc: BranchServiceItem): number | null {
    if (svc.memberPrice != null && svc.memberPrice > 0) return svc.memberPrice;
    if (svc.memberDiscountPercent) return Math.round(svc.price * (1 - svc.memberDiscountPercent / 100));
    return null;
  }

  const groupedEntries = useMemo(() => {
    const SKIP_CATS = ["hair", "wellness", "skin", "membership", "package", "สมาชิก", "แพ็กเกจ", "member"];
    const SKIP_IDS  = ["svc-membership-30d", "svc-buffet", "svc-pkg5", "svc-member-monthly", "svc-member-pkg"];
    const out: Record<string, BranchServiceItem[]> = {};
    for (const s of branchServices) {
      if (SKIP_CATS.some(ex => s.category.toLowerCase().includes(ex))) continue;
      if (SKIP_IDS.includes(s.id)) continue;
      (out[s.category] ??= []).push(s);
    }
    for (const cat in out) {
      out[cat].sort((a, b) => {
        const aP = a.nameTh.startsWith("สระ") ? 0 : 1;
        const bP = b.nameTh.startsWith("สระ") ? 0 : 1;
        return aP - bP || a.nameTh.localeCompare(b.nameTh, "th");
      });
    }
    return Object.entries(out).sort(([, aI], [, bI]) => {
      const aP = aI.some(s => s.nameTh.startsWith("สระ")) ? 0 : 1;
      const bP = bI.some(s => s.nameTh.startsWith("สระ")) ? 0 : 1;
      return aP - bP;
    });
  }, [branchServices]);

  const timeSlots = useMemo(() => {
    const [y, mo, d] = date.split("-").map(Number);
    const isSunday = new Date(y, mo - 1, d).getDay() === 0;
    const openMins = isSunday && branchId !== "branch-bangna" ? 10 * 60 : 8 * 60;
    const slots: string[] = [];
    for (let t = openMins; t <= 21 * 60 - 30; t += 15) {
      slots.push(`${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`);
    }
    return slots;
  }, [date, branchId]);

  const selectedSvc    = branchServices.find(s => s.id === serviceId);
  const effectiveSvcPx = selectedSvc
    ? (isMember ? (computeMemberPrice(selectedSvc) ?? selectedSvc.price) : selectedSvc.price)
    : 0;
  const addonTotal     = selectedAddonIds.reduce((sum, id) => sum + (addons.find(a => a.id === id)?.price ?? 0), 0);
  const discountSatang = Math.round(discountBaht * 100);
  const finalPrice     = selectedSvc ? Math.max(0, effectiveSvcPx + addonTotal - discountSatang) : 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!serviceId) { setError("กรุณาเลือกบริการ"); return; }
    if (!time)      { setError("กรุณาเลือกเวลา");   return; }
    if (!isWalkin && (!customer.name.trim() || !customer.phone.trim())) {
      setError("กรุณากรอกชื่อและเบอร์โทร หรือเลือก Walk-in");
      return;
    }
    if (commissionBaht !== "" && (!Number.isFinite(Number(commissionBaht)) || Number(commissionBaht) < 0)) {
      setError("กรุณากรอกค่าตอบแทนเป็นจำนวนตั้งแต่ 0 ขึ้นไป");
      return;
    }
    // Wait for the membership check so a member is never saved at full price.
    if (memberLoading) { setError("กำลังตรวจสอบสถานะสมาชิก กรุณารอสักครู่"); return; }
    setSaving(true);
    const res = await fetch("/api/bookings", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        branchId,
        serviceId,
        staffId:           staffId || null,
        extraStaffIds:     extraStaffIds.length > 0 ? extraStaffIds : undefined,
        date,
        startTime:         time,
        endTime:           addMinutes(time, selectedSvc!.duration),
        totalPrice:        finalPrice,
        ...(commissionBaht !== ""
          ? { commissionSatang: Math.round(Number(commissionBaht) * 100) }
          : {}),
        name:              customer.name.trim()  || undefined,
        phone:             customer.phone.trim() || undefined,
        notes:             notesVal || null,
        addonIds:          selectedAddonIds.length > 0 ? selectedAddonIds : undefined,
        isWalkin,
        skipConflictCheck: true,
        ...(checkoutNow ? { status: "COMPLETED" } : {}),
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "เกิดข้อผิดพลาด");
      return;
    }
    onSaved();
    onClose();
  }

  return (
    <Modal>
    <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      style={{ zIndex: 99999 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 bg-[#8B1D24] text-white flex items-center justify-between flex-shrink-0">
          <h2 className="font-bold text-base">+ จองใหม่</h2>
          <button onClick={onClose} className="text-white/70 hover:text-white text-2xl leading-none">×</button>
        </div>
        <form onSubmit={submit} className="flex-1 overflow-y-auto">
          <div className="p-5 space-y-5">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-[#A08070] block mb-1.5">วันที่</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full border border-[#E8D8CC] rounded-xl px-3 py-2.5 text-sm focus:outline-none text-[#3B2A24]" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] uppercase tracking-widest text-[#A08070]">
                  ลูกค้า {!isWalkin && <span className="text-red-400">*</span>}
                </label>
                <button type="button" onClick={() => setIsWalkin(v => !v)}
                  className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border transition-all"
                  style={isWalkin
                    ? { background: "#8B1D24", color: "white", borderColor: "#8B1D24" }
                    : { background: "white",   color: "#A08070", borderColor: "#E8D8CC" }}>
                  {isWalkin && "✓ "}Walk-in
                </button>
              </div>
              <CustomerSearch value={customer} onChange={setCustomer} requirePhoneOnCreate={!isWalkin} />
              {isMember && (
                <div className="mt-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200">
                  🎟️ สมาชิก — ราคาพิเศษสมาชิก ✓
                </div>
              )}
              {isWalkin && !customer.name && (
                <p className="text-xs text-[#A08070] mt-1">หากไม่กรอกชื่อ จะบันทึกเป็น &quot;Walk-in&quot; อัตโนมัติ</p>
              )}
              {isWalkin && customer.name.trim() && customer.phone.trim() && (
                <p className="text-xs mt-1 px-2 py-1 rounded-lg" style={{ background: "#F0FDF4", color: "#166534" }}>
                  ✓ จะลงทะเบียนเป็นลูกค้าในระบบอัตโนมัติ
                </p>
              )}
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-[#A08070] block mb-1.5">บริการ</label>
              <div className="space-y-3">
                {groupedEntries.map(([cat, items]) => (
                  <div key={cat}>
                    <p className="text-xs font-semibold mb-1.5 text-[#8B1D24]">{cat}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {items.map(s => {
                        const selected = s.id === serviceId;
                        const mPrice   = computeMemberPrice(s);
                        return (
                          <button key={s.id} type="button" onClick={() => setServiceId(s.id)}
                            className="rounded-xl p-3 text-left transition-all"
                            style={{
                              background: selected ? "#FFF8F4" : "white",
                              border:     `1.5px solid ${selected ? "#8B1D24" : "#E8D8CC"}`,
                            }}>
                            <p className="text-xs font-medium leading-tight text-[#3B2A24]">{s.nameTh}</p>
                            <p className="text-[10px] mt-1 text-[#A08070]">{s.duration} นาที</p>
                            {isMember && mPrice !== null && mPrice < s.price ? (
                              <div className="mt-1 flex items-baseline gap-1">
                                <span className="text-[10px] line-through text-[#A08070]">{formatPrice(s.price)}</span>
                                <span className="text-sm font-bold text-green-600">{formatPrice(mPrice)}</span>
                              </div>
                            ) : (
                              <p className="text-sm font-bold mt-1 text-[#8B1D24]">{formatPrice(s.price)}</p>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {addons.length > 0 && (
              <div>
                <label className="text-[10px] uppercase tracking-widest text-[#A08070] block mb-1.5">
                  บริการเสริม <span className="text-[#A08070]">(ไม่บังคับ)</span>
                </label>
                <div className="space-y-2">
                  {addons.map(a => {
                    const active = selectedAddonIds.includes(a.id);
                    return (
                      <button key={a.id} type="button"
                        onClick={() => setSelectedAddonIds(prev =>
                          active ? prev.filter(id => id !== a.id) : [...prev, a.id])}
                        className="w-full flex items-center justify-between rounded-xl px-4 py-3 text-left transition-all"
                        style={{
                          background: active ? "#FFF8F4" : "white",
                          border:     `1.5px solid ${active ? "#8B1D24" : "#E8D8CC"}`,
                        }}>
                        <p className="text-sm text-[#3B2A24]">{a.nameTh}</p>
                        <p className="text-sm font-bold" style={{ color: active ? "#8B1D24" : "#A08070" }}>
                          +{formatPrice(a.price)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div>
              <label className="text-[10px] uppercase tracking-widest text-[#A08070] block mb-1.5">ช่างหลัก (ไม่บังคับ)</label>
              <div className="flex flex-wrap gap-1.5">
                <button type="button" onClick={() => setStaffId("")}
                  className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                  style={{
                    background: staffId === "" ? "#8B1D24" : "white",
                    color:      staffId === "" ? "white"   : "#3B2A24",
                    border:     `1px solid ${staffId === "" ? "#8B1D24" : "#E8D8CC"}`,
                  }}>ไม่ระบุ</button>
                {staff.map(s => (
                  <button key={s.id} type="button" onClick={() => setStaffId(s.id)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                    style={{
                      background: staffId === s.id ? "#8B1D24" : "white",
                      color:      staffId === s.id ? "white"   : "#3B2A24",
                      border:     `1px solid ${staffId === s.id ? "#8B1D24" : "#E8D8CC"}`,
                    }}>{s.name}</button>
                ))}
              </div>
            </div>
            {staff.length > 1 && (
              <div>
                <label className="text-[10px] uppercase tracking-widest text-[#A08070] block mb-1.5">ช่างเพิ่มเติม (หลายคน)</label>
                <div className="flex flex-wrap gap-1.5">
                  {staff.filter(s => s.id !== staffId).map(s => {
                    const active = extraStaffIds.includes(s.id);
                    return (
                      <button key={s.id} type="button" onClick={() => toggleExtraStaff(s.id)}
                        className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                        style={{
                          background: active ? "#374151" : "white",
                          color:      active ? "white"   : "#3B2A24",
                          border:     `1px solid ${active ? "#374151" : "#E8D8CC"}`,
                        }}>{s.name}</button>
                    );
                  })}
                </div>
              </div>
            )}
            <div>
              <label className="text-[10px] uppercase tracking-widest text-[#A08070] block mb-1.5">เวลา</label>
              <div className="grid grid-cols-5 gap-1.5">
                {timeSlots.map(t => (
                  <button key={t} type="button" onClick={() => setTime(t)}
                    className="py-2 rounded-lg text-xs font-medium transition-colors"
                    style={{
                      background: time === t ? "#8B1D24" : "white",
                      color:      time === t ? "white"   : "#3B2A24",
                      border:     `1px solid ${time === t ? "#8B1D24" : "#E8D8CC"}`,
                    }}>{t}</button>
                ))}
              </div>
            </div>
            {selectedSvc && (
              <div>
                <label className="text-[10px] uppercase tracking-widest text-[#A08070] block mb-1.5">ส่วนลด (บาท)</label>
                <div className="flex items-center gap-2 border border-[#E8D8CC] rounded-xl px-3 py-2.5">
                  <span className="text-sm text-[#A08070]">฿</span>
                  <input type="number" min={0} value={discountBaht || ""}
                    onChange={e => setDiscountBaht(Math.max(0, Number(e.target.value)))}
                    placeholder="0"
                    className="flex-1 text-sm outline-none bg-transparent text-[#3B2A24]" />
                  {discountBaht > 0 && (
                    <span className="text-xs font-medium text-green-600">รวม {formatPrice(finalPrice)}</span>
                  )}
                </div>
              </div>
            )}
            <div>
              <label className="text-[10px] uppercase tracking-widest text-[#A08070] block mb-1.5">
                ค่าตอบแทนช่าง (บาท)
              </label>
              <div className="flex items-center gap-2 border border-[#E8D8CC] rounded-xl px-3 py-2.5">
                <span className="text-sm text-[#A08070]">฿</span>
                <input type="number" min={0} step="0.01" value={commissionBaht}
                  onChange={e => setCommissionBaht(e.target.value)}
                  placeholder="ใช้ค่ามือที่ตั้งไว้"
                  className="flex-1 text-sm outline-none bg-transparent text-[#3B2A24]" />
              </div>
              <p className="text-[11px] mt-1 text-[#A08070]">
                เว้นว่างเพื่อใช้ค่ามือของบริการและบริการเสริมอัตโนมัติ
              </p>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-[#A08070] block mb-1.5">หมายเหตุเริ่มต้น (คัดลอกไปภายนอกและภายใน)</label>
              <input value={notesVal} onChange={e => setNotesVal(e.target.value)}
                placeholder="ข้อมูลพิเศษเกี่ยวกับลูกค้าหรือนัด"
                className="w-full border border-[#E8D8CC] rounded-xl px-3 py-2.5 text-sm outline-none text-[#3B2A24]" />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            {/* Create + checkout in one go — for recording a visit that already happened. */}
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none" style={{ color: "#3B2A24" }}>
              <input type="checkbox" checked={checkoutNow} onChange={e => setCheckoutNow(e.target.checked)}
                className="w-4 h-4" style={{ accentColor: "#8B1D24" }} />
              เช็คเอาท์เลย — บันทึกเป็น &quot;เสร็จสิ้น&quot; (สำหรับบันทึกย้อนหลัง)
            </label>
            <button type="submit"
              disabled={saving || memberLoading || !serviceId || !time || (!isWalkin && !customer.name)}
              className="w-full py-3 rounded-xl bg-[#8B1D24] text-white font-semibold text-sm disabled:opacity-50">
              {saving ? "กำลังบันทึก..."
                : memberLoading ? "กำลังตรวจสอบสมาชิก..."
                : checkoutNow
                  ? `✓ บันทึก + เช็คเอาท์${selectedSvc ? ` · ${formatPrice(finalPrice)}` : ""}`
                  : `✓ บันทึกการจอง${selectedSvc ? ` · ${formatPrice(finalPrice)}` : ""}`}
            </button>
          </div>
        </form>
      </div>
    </div>
    </Modal>
  );
}
