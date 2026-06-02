"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/* ─── Types shared with modal components ──────────────────── */
export interface ShiftInfo   { startTime: string; endTime: string }
export type StaffShiftMap = Record<string, ShiftInfo | null>;

export interface BookingAddon {
  id: string;
  nameTh: string;
  name: string;
  price: number;
}
export interface BookingItem {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  totalPrice: number;
  notes: string | null;
  serviceId: string;
  service: { name: string; nameTh: string; category: string };
  customer: { id: string; name: string; nickname: string | null; phone: string };
  staff: { id: string; name: string } | null;
  extraStaff: { id: string; name: string }[];
  addons: BookingAddon[];
}
export interface StaffItem    { id: string; name: string }
export interface BranchItem   { id: string; name: string }
export interface ServiceOption {
  id: string;
  duration: number;
  price: number;
  service: { id: string; name: string; nameTh: string };
}
export interface BranchServiceItem {
  id:                    string;
  nameTh:                string;
  category:              string;
  price:                 number;
  duration:              number;
  memberPrice:           number | null;
  memberDiscountPercent: number;
}
export interface AddonItem { id: string; nameTh: string; price: number; }
export interface BlockedSlotItem {
  id:        string;
  date:      string;
  startTime: string;
  endTime:   string;
  reason:    string | null;
  staffId:   string | null;
  staff:     { id: string; name: string } | null;
}

/* ─── Constants ───────────────────────────────────────────── */
export const DAYS_TH   = ["จันทร์","อังคาร","พุธ","พฤหัส","ศุกร์","เสาร์","อาทิตย์"];
export const DAYS_EN   = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
export const MONTHS_TH = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];

export const STATUS_COLOR: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  PENDING:   { bg:"bg-amber-50",  text:"text-amber-800",  border:"border-amber-300",  dot:"bg-amber-400"  },
  CONFIRMED: { bg:"bg-blue-50",   text:"text-blue-800",   border:"border-blue-300",   dot:"bg-blue-500"   },
  COMPLETED: { bg:"bg-green-50",  text:"text-green-800",  border:"border-green-300",  dot:"bg-green-500"  },
  CANCELLED: { bg:"bg-red-50",    text:"text-red-800",    border:"border-red-200",    dot:"bg-red-400"    },
  NO_SHOW:   { bg:"bg-gray-100",  text:"text-gray-500",   border:"border-gray-200",   dot:"bg-gray-400"   },
};
export const STATUS_LABEL: Record<string,string> = {
  PENDING:"รอยืนยัน", CONFIRMED:"ยืนยันแล้ว", COMPLETED:"เสร็จแล้ว", CANCELLED:"ยกเลิก", NO_SHOW:"ไม่มา",
};

/* ─── Date / time helpers ─────────────────────────────────── */
export function parseLocal(dateStr: string): Date {
  return new Date(dateStr + "T12:00:00");
}
export function dayIndex(dateStr: string): number {
  const dow = parseLocal(dateStr).getDay();
  return (dow + 6) % 7;
}
export function timeToMins(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
export function addMinutes(time: string, mins: number): string {
  const total = timeToMins(time) + mins;
  return `${String(Math.floor(total / 60)).padStart(2,"0")}:${String(total % 60).padStart(2,"0")}`;
}
export function formatPrice(satang: number) {
  return (satang / 100).toLocaleString("th-TH", { minimumFractionDigits: 0 });
}
export function makeTimeSlots(step = 30, dayStart = 8, dayEnd = 21): string[] {
  const slots: string[] = [];
  for (let h = dayStart; h < dayEnd; h++)
    for (let m = 0; m < 60; m += step)
      slots.push(`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`);
  return slots;
}

/* ─── Modal — portal that escapes <main overflow-auto> ────── */
export function Modal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}

/* ─── Shared ServiceTimeFields (used by EditModal) ───────── */
export function ServiceTimeFields({
  services, serviceId, startTime, endTime,
  onServiceChange, onStartChange, onEndChange,
}: {
  services: ServiceOption[];
  serviceId: string;
  startTime: string;
  endTime: string;
  onServiceChange: (id: string) => void;
  onStartChange: (t: string) => void;
  onEndChange: (t: string) => void;
}) {
  const timeSlots = makeTimeSlots(15);
  const endSlots  = timeSlots.filter(t => timeToMins(t) > timeToMins(startTime));

  return (
    <>
      <div>
        <label className="text-xs text-gray-500 block mb-1">บริการ</label>
        <select value={serviceId} onChange={e => onServiceChange(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1D24]/30">
          {services.length === 0 && <option value="">กำลังโหลด...</option>}
          {services.map(s => (
            <option key={s.id} value={s.id}>
              {s.service.nameTh || s.service.name} — ฿{formatPrice(s.price)} ({s.duration} นาที)
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-500 block mb-1">เวลาเริ่ม</label>
          <select value={startTime} onChange={e => onStartChange(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1D24]/30">
            {timeSlots.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">เวลาสิ้นสุด</label>
          <select value={endTime} onChange={e => onEndChange(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1D24]/30">
            {endSlots.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>
    </>
  );
}
