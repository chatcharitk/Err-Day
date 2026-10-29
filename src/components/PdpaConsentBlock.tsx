"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import type { Lang } from "@/components/LanguageProvider";

const PRIMARY = "#8B1D24";
const BORDER  = "#E8D8CC";
const TEXT    = "#3B2A24";
const MUTED   = "#A08070";
const BG      = "#FDF7F2";

interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** "signup" | "booking" | "staff" | "liff" — affects copy */
  context?: "signup" | "booking" | "staff" | "liff";
  /** Customer-facing pages pass the visitor's language; defaults to Thai. */
  lang?: Lang;
}

const SUMMARY_BY_CONTEXT: Record<NonNullable<Props["context"]>, string> = {
  signup:  "ข้อมูลของท่านจะถูกใช้เพื่อจัดการสมาชิก ส่งโปรโมชั่น และยืนยันการชำระเงิน",
  booking: "ข้อมูลของท่านจะถูกใช้เพื่อยืนยันการจองและติดต่อกลับ",
  staff:   "ลูกค้าได้ให้ความยินยอมด้วยวาจาที่หน้าร้าน — เก็บข้อมูลตามนโยบาย PDPA",
  liff:    "บัญชี LINE ของท่านจะเชื่อมโยงกับข้อมูลสมาชิก เพื่อจัดการสิทธิ์และส่งโปรโมชั่น",
};

const SUMMARY_BY_CONTEXT_EN: Record<NonNullable<Props["context"]>, string> = {
  signup:  "Your data is used to manage your membership, send promotions and confirm payments.",
  booking: "Your data is used to confirm your booking and contact you.",
  staff:   "The customer gave verbal consent at the salon — data kept under the PDPA policy.",
  liff:    "Your LINE account will be linked to your membership to manage your benefits and send promotions.",
};

const COPY = {
  th: {
    consent: "ฉันยินยอมให้ err.day เก็บและใช้ข้อมูลส่วนบุคคลของฉัน",
    hide: "ซ่อนรายละเอียด", show: "ดูรายละเอียดการใช้ข้อมูล",
    rows: [
      ["ข้อมูลที่เราเก็บ:", "ชื่อ, เบอร์โทร, อีเมล, เพศ, วันเกิด, ประวัติการใช้บริการ"],
      ["วัตถุประสงค์:", "จัดการการจอง / สมาชิก / ส่งโปรโมชั่น / วิเคราะห์การให้บริการ"],
      ["ระยะเวลา:", "เก็บไว้ 5 ปี หรือจนกว่าท่านจะขอให้ลบ"],
      ["สิทธิของท่าน:", "ขอดู / แก้ไข / ลบข้อมูล หรือเพิกถอนความยินยอมได้ทุกเมื่อ"],
      ["ติดต่อเรา:", "privacy@err-daysalon.com หรือที่หน้าร้าน"],
    ],
    full: "อ่านนโยบายความเป็นส่วนตัวฉบับเต็ม",
  },
  en: {
    consent: "I consent to err.day collecting and using my personal data",
    hide: "Hide details", show: "See how we use your data",
    rows: [
      ["Data we collect:", "name, phone, email, gender, date of birth, service history"],
      ["Purpose:", "managing bookings / membership, sending promotions, improving our service"],
      ["Retention:", "5 years, or until you ask us to delete it"],
      ["Your rights:", "view, correct or delete your data, or withdraw consent at any time"],
      ["Contact us:", "privacy@err-daysalon.com or at the salon"],
    ],
    full: "Read the full privacy policy",
  },
} as const;

export default function PdpaConsentBlock({ checked, onChange, context = "signup", lang = "th" }: Props) {
  const [expanded, setExpanded] = useState(false);
  const c = COPY[lang];

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
            {c.consent}
          </p>
          <p className="text-xs mt-0.5" style={{ color: MUTED }}>
            {(lang === "en" ? SUMMARY_BY_CONTEXT_EN : SUMMARY_BY_CONTEXT)[context]}
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
        {expanded ? c.hide : c.show}
      </button>

      {expanded && (
        <div
          className="ml-6 text-xs space-y-1.5 pt-1 border-t"
          style={{ borderColor: BORDER, color: TEXT }}
        >
          {c.rows.map(([k, v]) => <p key={k}><strong>{k}</strong> {v}</p>)}
          <Link
            href="/privacy"
            target="_blank"
            className="inline-flex items-center gap-1 mt-1 underline"
            style={{ color: PRIMARY }}
          >
            {c.full} <ExternalLink size={10} />
          </Link>
        </div>
      )}
    </div>
  );
}
