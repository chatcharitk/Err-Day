"use client";

import { Ticket } from "lucide-react";
import { PREPAID_EXPIRY_OPTIONS } from "@/lib/voucher-skus";

export type PrepaidChoice = { days: number | null };

/**
 * Cart-row switch for "ซื้อไว้ใช้ภายหลัง": the customer pays now and the service
 * becomes a prepaid ticket (any branch, this customer only) instead of a visit.
 */
export default function PrepaidToggle({ value, onChange, blockedReason }: {
  value: PrepaidChoice | undefined;
  onChange: (v: PrepaidChoice | undefined) => void;
  /** Shown instead of the switch when it can't be used (e.g. no customer yet). */
  blockedReason?: string;
}) {
  if (!value) {
    return (
      <button type="button" disabled={!!blockedReason} onClick={() => onChange({ days: null })}
        title={blockedReason}
        className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg disabled:opacity-50"
        style={{ border: "1px dashed #C4A99A", color: "#6B5245", background: "white" }}>
        <Ticket className="w-3 h-3" /> ซื้อไว้ใช้ภายหลัง
        {blockedReason && <span className="font-normal"> · {blockedReason}</span>}
      </button>
    );
  }
  return (
    <div className="mt-1.5 rounded-lg px-2 py-1.5" style={{ background: "#FEF3C7", border: "1px solid #FCD34D" }}>
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 text-[11px] font-bold" style={{ color: "#92400E" }}>
          <Ticket className="w-3 h-3" /> ซื้อไว้ใช้ภายหลัง — ยังไม่ใช้วันนี้
        </span>
        <button type="button" onClick={() => onChange(undefined)} className="text-[11px] underline" style={{ color: "#92400E" }}>
          ยกเลิก
        </button>
      </div>
      <div className="flex flex-wrap gap-1 mt-1">
        {PREPAID_EXPIRY_OPTIONS.map(o => {
          const on = value.days === o.days;
          return (
            <button key={String(o.days)} type="button" onClick={() => onChange({ days: o.days })}
              className="text-[11px] px-2 py-0.5 rounded-full font-semibold whitespace-nowrap"
              style={on ? { background: "#92400E", color: "white" } : { background: "white", color: "#92400E", border: "1px solid #FCD34D" }}>
              {o.label}
            </button>
          );
        })}
      </div>
      <p className="text-[10px] mt-1" style={{ color: "#92400E" }}>ใช้ได้ทุกสาขา · เฉพาะลูกค้าคนนี้ · จำนวน = จำนวนครั้ง</p>
    </div>
  );
}
