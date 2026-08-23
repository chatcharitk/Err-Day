"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";
import {
  Modal, ServiceTimeFields,
  STATUS_COLOR, STATUS_LABEL, DAYS_TH, MONTHS_TH,
  parseLocal, dayIndex, addMinutes, formatPrice,
  type BookingItem, type StaffItem, type ServiceOption,
} from "./_shared";
import CustomerSearch, { type CustomerValue } from "@/components/CustomerSearch";

/** List price, or the member price when isMember — mirrors the same formula
 * used by the kiosk walk-in routes and the mobile booking-detail page. */
function priceForService(svc: ServiceOption, isMember: boolean): number {
  if (!isMember) return svc.price;
  if (svc.service.memberPrice != null) return Math.min(svc.price, svc.service.memberPrice);
  if (svc.service.memberDiscountPercent > 0) {
    return Math.min(svc.price, Math.round(svc.price * (1 - svc.service.memberDiscountPercent / 100)));
  }
  return svc.price;
}

export default function EditModal({
  booking, branchId, branches, staff, onClose, onSaved,
}: {
  booking: BookingItem;
  branchId: string;
  branches: { id: string; name: string }[];
  staff: StaffItem[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const router = useRouter();
  const [services,        setServices]        = useState<ServiceOption[]>([]);
  const [bsId,            setBsId]            = useState("");
  const [startTime,       setStartTime]       = useState(booking.startTime);
  const [endTime,         setEndTime]         = useState(booking.endTime);
  const [price,           setPrice]           = useState(booking.totalPrice);
  const [commissionBaht,  setCommissionBaht]  = useState(
    booking.commissionSatang == null ? "" : String(booking.commissionSatang / 100),
  );
  const [selectedStaff,   setSelectedStaff]   = useState(booking.staff?.id ?? "");
  const [extraStaffIds,   setExtraStaffIds]   = useState<string[]>(booking.extraStaff.map(s => s.id));
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerValue>({
    id: booking.customer.id, name: booking.customer.name, phone: booking.customer.phone,
  });
  const [selectedBranch,  setSelectedBranch]  = useState(branchId);
  const [notes,           setNotes]           = useState(booking.notes ?? "");
  const [saving,          setSaving]          = useState(false);
  const [checkedOut,      setCheckedOut]      = useState(booking.status === "COMPLETED");
  const [currentStatus,   setCurrentStatus]   = useState(booking.status);
  const [statusError,     setStatusError]     = useState("");
  const [paidAt,          setPaidAt]          = useState(booking.paidAt);

  function toggleExtraStaff(id: string) {
    setExtraStaffIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  const c = STATUS_COLOR[currentStatus] ?? STATUS_COLOR.PENDING;

  useEffect(() => {
    fetch(`/api/services?branchId=${selectedBranch}`)
      .then(r => r.json())
      .then((data: ServiceOption[]) => {
        setServices(data);
        const match = data.find(s => s.service.id === booking.serviceId);
        if (match) {
          setBsId(match.id);
          // Only re-price when the admin has actually moved the booking to a
          // different branch (a genuinely different price list) — loading
          // the booking's own branch/service must never touch `price`, since
          // booking.totalPrice may already reflect a member discount,
          // package redemption, or manual adjustment that the plain list
          // price would silently clobber.
          if (selectedBranch !== branchId) {
            setPrice(priceForService(match, !!selectedCustomer.isMember));
          }
        } else if (data.length > 0) {
          setBsId(data[0].id);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranch, booking.serviceId]);

  function handleServiceChange(id: string) {
    setBsId(id);
    const svc = services.find(s => s.id === id);
    if (svc) {
      setEndTime(addMinutes(startTime, svc.duration));
      setPrice(priceForService(svc, !!selectedCustomer.isMember));
    }
  }

  /** Reassigning the booking to a different customer should re-price it for
   * their membership status — otherwise a walk-in created before the
   * customer was linked keeps charging the non-member rate. */
  function handleCustomerChange(v: CustomerValue) {
    setSelectedCustomer(v);
    if (v.id === booking.customer.id) return; // no actual reassignment — leave price alone
    const svc = services.find(s => s.id === bsId);
    if (svc) setPrice(priceForService(svc, !!v.isMember));
  }

  function handleStartChange(t: string) {
    setStartTime(t);
    const svc = services.find(s => s.id === bsId);
    if (svc) setEndTime(addMinutes(t, svc.duration));
  }

  async function patchStatus(status: string) {
    // Optimistic: flip the status in the UI immediately so the admin sees
    // instant feedback. The network round-trip happens in the background;
    // on failure we roll back and surface the error.
    const prevStatus     = currentStatus;
    const prevCheckedOut = checkedOut;
    setStatusError("");
    setCurrentStatus(status);
    if (status === "COMPLETED") setCheckedOut(true);
    setSaving(true);
    try {
      const res = await fetch(`/api/bookings/${booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("update failed");
      onSaved();
    } catch {
      // Roll back the optimistic update
      setCurrentStatus(prevStatus);
      setCheckedOut(prevCheckedOut);
      setStatusError("ไม่สามารถอัปเดตสถานะได้ — ลองอีกครั้ง");
    } finally {
      setSaving(false);
    }
  }

  /** Mark paid — admin action, separate from "finished" (desk เสร็จแล้ว ≠ paid). */
  async function markPaid() {
    const iso = new Date().toISOString();
    setSaving(true);
    setStatusError("");
    try {
      const res = await fetch(`/api/bookings/${booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paidAt: iso }),
      });
      if (!res.ok) throw new Error("update failed");
      setPaidAt(iso);
      onSaved();
    } catch {
      setStatusError("ไม่สามารถบันทึกการชำระได้ — ลองอีกครั้ง");
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    if (commissionBaht !== "" && (!Number.isFinite(Number(commissionBaht)) || Number(commissionBaht) < 0)) {
      setStatusError("กรุณากรอกค่าตอบแทนเป็นจำนวนตั้งแต่ 0 ขึ้นไป");
      return;
    }
    setSaving(true);
    const selectedSvc = services.find(s => s.id === bsId);
    await fetch(`/api/bookings/${booking.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(selectedSvc ? { serviceId: selectedSvc.service.id } : {}),
        startTime,
        endTime,
        totalPrice: price,
        commissionSatang: commissionBaht === "" ? null : Math.round(Number(commissionBaht) * 100),
        staffId: selectedStaff || null,
        extraStaffIds,
        notes: notes || null,
        customerId: (selectedCustomer.id && selectedCustomer.id !== booking.customer.id) ? selectedCustomer.id : undefined,
        branchId: selectedBranch !== branchId ? selectedBranch : undefined,
      }),
    });
    setSaving(false);
    onSaved();
    onClose();
  }

  return (
    <Modal>
    <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      style={{ zIndex: 99999 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}>
        <div className={`px-5 py-4 ${c.bg} border-b ${c.border} flex-shrink-0`}>
          <div className="flex items-start justify-between">
            <div>
              <div className="font-bold text-sm text-gray-800 flex items-center gap-2 flex-wrap">
                <Link href={`/admin/customers?id=${booking.customer.id}`} className="hover:underline"
                  style={{ color: "#8B1D24" }} title="ดูข้อมูลลูกค้า">
                  {booking.customer.name}
                </Link>
                <span className="text-gray-400 font-normal">·</span>
                <span className="font-normal text-xs text-gray-600">{booking.customer.phone}</span>
                <Link href={`/admin/customers?id=${booking.customer.id}`}
                  className="text-xs px-2 py-0.5 rounded-full font-medium hover:bg-blue-100 transition-colors"
                  style={{ color: "#2563EB", border: "1px solid #BFDBFE", background: "#EFF6FF" }}>
                  ดูข้อมูลลูกค้า →
                </Link>
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {(() => {
                  const d = parseLocal(booking.date.slice(0, 10));
                  const di = dayIndex(booking.date.slice(0, 10));
                  return `${DAYS_TH[di]} ${d.getDate()} ${MONTHS_TH[d.getMonth()]}`;
                })()}
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none ml-4">×</button>
          </div>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 border border-gray-200 rounded-lg px-2 py-1.5 flex-1">
              <span className="text-sm text-gray-400">฿</span>
              <input type="number" min={0} value={price / 100}
                onChange={e => setPrice(Math.max(0, Math.round(Number(e.target.value) * 100)))}
                className="flex-1 text-lg font-bold text-[#3B2A24] outline-none bg-transparent w-0 min-w-0" />
            </div>
            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border flex-shrink-0 ${c.bg} ${c.text} ${c.border}`}>
              <span className={`w-2 h-2 rounded-full ${c.dot}`} />
              {STATUS_LABEL[currentStatus] ?? currentStatus}
            </span>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">ค่าตอบแทนช่าง (บาท)</label>
            <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2">
              <span className="text-sm text-gray-400">฿</span>
              <input type="number" min={0} step="0.01" value={commissionBaht}
                onChange={e => setCommissionBaht(e.target.value)}
                placeholder="ใช้ค่ามือที่ตั้งไว้"
                className="flex-1 text-sm outline-none bg-transparent min-w-0" />
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              จำนวนนี้จะใช้คำนวณค่าตอบแทนเมื่อคิวเสร็จสิ้น
            </p>
          </div>
          {booking.addons.length > 0 && (
            <div className="rounded-xl p-3 space-y-1" style={{ background: "#FFF8F4", border: "1px solid #E8D8CC" }}>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#8B1D24" }}>
                บริการเสริม / Add-Ons
              </p>
              {booking.addons.map((a) => (
                <div key={a.id} className="flex justify-between text-xs" style={{ color: "#5C4A42" }}>
                  <span>{a.nameTh || a.name}</span>
                  <span className="font-medium">+฿{formatPrice(a.price)}</span>
                </div>
              ))}
            </div>
          )}
          {checkedOut && (
            <div>
              {paidAt ? (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center text-green-700 font-medium text-sm">
                  ✓ เสร็จสิ้น — ชำระเงินแล้ว
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between gap-3">
                  <span className="text-amber-700 font-medium text-sm">เสร็จสิ้น — ยังไม่ชำระ</span>
                  <button onClick={markPaid} disabled={saving}
                    className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50">
                    ✓ รับชำระแล้ว
                  </button>
                </div>
              )}
              {statusError && (
                <p className="text-xs text-red-600 mt-2">{statusError}</p>
              )}
            </div>
          )}
          {!checkedOut && (
            <div>
              <p className="text-xs text-gray-400 mb-2">เปลี่ยนสถานะ</p>
              <div className="flex flex-wrap gap-2">
                {currentStatus !== "CONFIRMED" && (
                  <button onClick={() => patchStatus("CONFIRMED")} disabled={saving}
                    className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-sm font-medium hover:bg-blue-100 disabled:opacity-50">
                    ✓ ยืนยัน
                  </button>
                )}
                {currentStatus !== "NO_SHOW" && (
                  <button onClick={() => patchStatus("NO_SHOW")} disabled={saving}
                    className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 border border-gray-200 text-sm font-medium hover:bg-gray-200 disabled:opacity-50">
                    ไม่มา
                  </button>
                )}
                {currentStatus !== "CANCELLED" && (
                  <button onClick={() => patchStatus("CANCELLED")} disabled={saving}
                    className="px-3 py-1.5 rounded-lg bg-red-50 text-red-700 border border-red-200 text-sm font-medium hover:bg-red-100 disabled:opacity-50">
                    ยกเลิก
                  </button>
                )}
              </div>
              {statusError && (
                <p className="text-xs text-red-600 mt-2">{statusError}</p>
              )}
            </div>
          )}
          <ServiceTimeFields services={services} serviceId={bsId} startTime={startTime} endTime={endTime}
            onServiceChange={handleServiceChange} onStartChange={handleStartChange} onEndChange={setEndTime} />
          {/* Customer — reassign the booking to a different customer */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">ลูกค้า (เปลี่ยนได้หากจองผิดคน)</label>
            <CustomerSearch value={selectedCustomer} onChange={handleCustomerChange} showManualPhone={false} />
            {selectedCustomer.id && selectedCustomer.id !== booking.customer.id && (
              <p className="text-[11px] mt-1.5 px-2 py-1 rounded-lg" style={{ background: "#FFF7ED", color: "#9A3412" }}>
                จะย้ายการจองนี้ไปยัง <b>{selectedCustomer.name}</b>
              </p>
            )}
          </div>

          {/* Branch */}
          {branches.length > 1 && (
            <div>
              <label className="text-xs text-gray-500 block mb-1">สาขา</label>
              <select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1D24]/30">
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          )}

          {/* Primary staff */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">ช่างหลัก</label>
            <select value={selectedStaff} onChange={e => setSelectedStaff(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1D24]/30">
              <option value="">ไม่ระบุ</option>
              {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {/* Extra staff */}
          {staff.length > 1 && (
            <div>
              <label className="text-xs text-gray-500 block mb-1.5">ช่างเพิ่มเติม (หลายคน)</label>
              <div className="flex flex-wrap gap-1.5">
                {staff.filter(s => s.id !== selectedStaff).map(s => {
                  const active = extraStaffIds.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleExtraStaff(s.id)}
                      className="px-2.5 py-1 rounded-full text-xs font-medium border transition-colors"
                      style={{
                        background:   active ? "#8B1D24" : "white",
                        color:        active ? "white"   : "#3B2A24",
                        borderColor:  active ? "#8B1D24" : "#E8D8CC",
                      }}
                    >
                      {s.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div>
            <label className="text-xs text-gray-500 block mb-1">หมายเหตุ</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#8B1D24]/30"
              placeholder="หมายเหตุ..." />
          </div>
        </div>
        <div className="flex gap-2 px-5 pb-5 flex-shrink-0">
          {!checkedOut && (
            <button onClick={() => router.push(`/admin/pos?bookingId=${booking.id}&branchId=${branchId}`)}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-green-600 text-white font-semibold text-sm hover:bg-green-700 disabled:opacity-50">
              💳 เช็คเอาท์
            </button>
          )}
          <button onClick={save} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-[#8B1D24] text-white font-semibold text-sm hover:bg-[#7a1820] disabled:opacity-50">
            {saving ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>
      </div>
    </div>
    </Modal>
  );
}
