"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";

const PRIMARY = "#8B1D24";
const BORDER  = "#E8D8CC";
const TEXT    = "#3B2A24";
const MUTED   = "#A08070";
const BG      = "#FDF7F2";

interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** "signup" | "booking" | "staff" — affects copy */
  context?: "signup" | "booking" | "staff";
}

const SUMMARY_BY_CONTEXT: Record<NonNullable<Props["context"]>, string> = {
  signup:  "ข้อมูลของท่านจะถูกใช้เพื่อจัดการสมาชิก ส่งโปรโมชั่น และยืนยันการชำระเงิน",
  booking: "ข้อมูลของท่านจะถูกใช้เพื่อยืนยันการจองและติดต่อกลับ",
  staff:   "ลูกค้าได้ให้ความยินยอมด้วยวาจาที่หน้าร้าน — เก็บข้อมูลตามนโยบาย PDPA",
};

export default function PdpaConsentBlock({ checked, onChange, context = "signup" }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="rounded-xl border p-3 space-y-2"
      style={{ borderColor: checked ? PRIMARY : BORDER, background: checked ? "#FFF8F4" : BG }}
    >
      {/* Checkbox row */}
      <label className="flex items-start gap-2.5 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={checked}
          onChange={e => onChange(e.target.checked)}
          className="mt-0.5 w-4 h-4 accent-red-800 flex-shrink-0"
        />
        <div className="flex-1">
          <p className="text-sm font-medium" style={{ color: TEXT }}>
            ฉันยินยอมให้ err.day เก็บและใช้ข้อมูลส่วนบุคคลของฉัน
          </p>
          <p className="text-xs mt-0.5" style={{ color: MUTED }}>
            {SUMMARY_BY_CONTEXT[context]}
          </p>
        </div>
      </label>

      {/* Expand/collapse short policy */}
      <button
        type="button"
        onClick={() => setExpanded(x => !x)}
        className="flex items-center gap-1 text-xs font-medium ml-6"
        style={{ color: PRIMARY }}
      >
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        {expanded ? "ซ่อนรายละเอียด" : "ดูรายละเอียดการใช้ข้อมูล"}
      </button>

      {expanded && (
        <div
          className="ml-6 text-xs space-y-1.5 pt-1 border-t"
          style={{ borderColor: BORDER, color: TEXT }}
        >
          <p><strong>ข้อมูลที่เราเก็บ:</strong> ชื่อ, เบอร์โทร, อีเมล, เพศ, ประวัติการใช้บริการ</p>
          <p><strong>วัตถุประสงค์:</strong> จัดการการจอง / สมาชิก / ส่งโปรโมชั่น / วิเคราะห์การให้บริการ</p>
          <p><strong>ระยะเวลา:</strong> เก็บไว้ 5 ปี หรือจนกว่าท่านจะขอให้ลบ</p>
          <p><strong>สิทธิของท่าน:</strong> ขอดู / แก้ไข / ลบข้อมูล หรือเพิกถอนความยินยอมได้ทุกเมื่อ</p>
          <p><strong>ติดต่อเรา:</strong> privacy@err-daysalon.com หรือที่หน้าร้าน</p>
          <Link
            href="/privacy"
            target="_blank"
            className="inline-flex items-center gap-1 mt-1 underline"
            style={{ color: PRIMARY }}
          >
            อ่านนโยบายความเป็นส่วนตัวฉบับเต็ม <ExternalLink size={10} />
          </Link>
        </div>
      )}
    </div>
  );
}
