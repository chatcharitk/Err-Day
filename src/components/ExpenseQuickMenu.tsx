"use client";

import Link from "next/link";
import {
  Building2,
  Droplets,
  FlaskConical,
  Megaphone,
  Paintbrush,
  Sparkles,
  UsersRound,
  Zap,
} from "lucide-react";
import { EXPENSE_CATEGORIES, EXPENSE_QUICK_CATEGORIES } from "@/lib/expenses";

const PRIMARY = "#8B1D24";
const TEXT = "#3B2A24";
const MUTED = "#A08070";
const BORDER = "#E8D8CC";

const CATEGORY_LABEL = Object.fromEntries(
  EXPENSE_CATEGORIES.map(category => [category.value, category.label]),
);

const ICONS = {
  rent: Building2,
  electricity: Zap,
  water: Droplets,
  shampoo: FlaskConical,
  colour: Paintbrush,
  treatment: Sparkles,
  salary: UsersRound,
  marketing: Megaphone,
} as const;

const TINTS: Record<(typeof EXPENSE_QUICK_CATEGORIES)[number], string> = {
  rent: "#F7EEE7",
  electricity: "#FFF7D6",
  water: "#EAF6FF",
  shampoo: "#EEF8F2",
  colour: "#FCEEF3",
  treatment: "#F5EEFC",
  salary: "#EEF1F8",
  marketing: "#FFF0E8",
};

function fmt(satang: number) {
  return `฿${(satang / 100).toLocaleString("th-TH")}`;
}

interface Props {
  basePath: "/admin/expenses/new" | "/admin/m/expenses/new";
  totals?: Record<string, number>;
  compact?: boolean;
}

export default function ExpenseQuickMenu({ basePath, totals = {}, compact = false }: Props) {
  return (
    <section>
      <div className="flex items-end justify-between gap-3 mb-3">
        <div>
          <h2 className="text-sm font-semibold" style={{ color: TEXT }}>บันทึกรายจ่ายด่วน</h2>
          <p className="text-[11px]" style={{ color: MUTED }}>เลือกหมวด แล้วกรอกจำนวนเงินได้ทันที</p>
        </div>
        {!compact && (
          <Link
            href={basePath}
            className="text-xs font-semibold whitespace-nowrap"
            style={{ color: PRIMARY }}
          >
            รายการอื่นๆ
          </Link>
        )}
      </div>

      <div className={`grid ${compact ? "grid-cols-2" : "grid-cols-2 md:grid-cols-4"} gap-2.5`}>
        {EXPENSE_QUICK_CATEGORIES.map(value => {
          const Icon = ICONS[value];
          const total = totals[value] ?? 0;
          return (
            <Link
              key={value}
              href={`${basePath}?category=${value}`}
              prefetch={false}
              className="rounded-xl p-3 transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
              style={{ border: `1px solid ${BORDER}`, background: "white" }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center mb-2"
                style={{ background: TINTS[value], color: PRIMARY }}
              >
                <Icon size={16} />
              </div>
              <p className="text-xs font-semibold leading-tight" style={{ color: TEXT }}>
                {CATEGORY_LABEL[value]}
              </p>
              {total > 0 && (
                <p className="text-[10px] mt-1" style={{ color: MUTED }}>
                  ช่วงนี้ {fmt(total)}
                </p>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
