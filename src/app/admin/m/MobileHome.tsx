"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown, Plus, Search, MoreVertical, LogOut,
  Phone, Clock, User, Check, X, Sparkles,
} from "lucide-react";
import BrandLogo from "@/components/BrandLogo";

const PRIMARY = "#8B1D24";
const TEXT    = "#3B2A24";
const MUTED   = "#A08070";
const BORDER  = "#E8D8CC";

type Status = "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED" | "NO_SHOW";

interface Branch { id: string; name: string; }

interface BookingRow {
  id:            string;
  startTime:     string;
  endTime:       string;
  status:        Status;
  totalPrice:    number;
  notes:         string | null;
  serviceName:   string;
  customerName:  string;
  customerPhone: string;
  staffName:     string | null;
  addonCount:    number;
}

interface Props {
  branches:       Branch[];
  activeBranchId: string;
  selectedDate:   string;  // "YYYY-MM-DD"
  bookings:       BookingRow[];
  todayDate:      string;
}

const STATUS_META: Record<Status, { label: string; bg: string; fg: string }> = {
  PENDING:   { label: "รอยืนยัน",  bg: "#FFF7ED", fg: "#9A3412" },
  CONFIRMED: { label: "ยืนยันแล้ว", bg: "#EFF6FF", fg: "#1D4ED8" },
  COMPLETED: { label: "เสร็จสิ้น",  bg: "#F0FDF4", fg: "#166534" },
  CANCELLED: { label: "ยกเลิก",     bg: "#F3F4F6", fg: "#6B7280" },
  NO_SHOW:   { label: "ไม่มา",       bg: "#FEF2F2", fg: "#991B1B" },
};

const LS_KEY = "admin_m_branch";

/** Generate a 7-day window centered around today, with prev/next arrows for navigation. */
function dateStripDays(selected: string, today: string): { date: string; isToday: boolean; isSelected: boolean }[] {
  const [y, m, d] = selected.split("-").map(Number);
  const sel = new Date(y, m - 1, d);
  const out: { date: string; isToday: boolean; isSelected: boolean }[] = [];
  for (let offset = -2; offset <= 4; offset++) {
    const dd = new Date(sel);
    dd.setDate(sel.getDate() + offset);
    const dateStr = `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, "0")}-${String(dd.getDate()).padStart(2, "0")}`;
    out.push({
      date:       dateStr,
      isToday:    dateStr === today,
      isSelected: dateStr === selected,
    });
  }
  return out;
}

const DOW_TH = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

export default function MobileHome({ branches, activeBranchId, selectedDate, bookings, todayDate }: Props) {
  const router = useRouter();
  const [showBranchPicker, setShowBranchPicker] = useState(false);
  const [showMenu,         setShowMenu]         = useState(false);

  const activeBranch = branches.find((b) => b.id === activeBranchId);

  // First-load: redirect to last-used branch from localStorage if URL has none
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved && saved !== activeBranchId && branches.some((b) => b.id === saved)) {
        const url = new URL(window.location.href);
        if (!url.searchParams.get("branchId")) {
          url.searchParams.set("branchId", saved);
          window.location.replace(url.toString());
        }
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchBranch = (id: string) => {
    try { localStorage.setItem(LS_KEY, id); } catch {}
    const url = new URL(window.location.href);
    url.searchParams.set("branchId", id);
    router.replace(url.pathname + url.search);
    setShowBranchPicker(false);
  };

  const switchDate = (dateStr: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("date", dateStr);
    router.replace(url.pathname + url.search);
  };

  const handleLogout = async () => {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    router.replace("/admin/login");
  };

  const days = useMemo(() => dateStripDays(selectedDate, todayDate), [selectedDate, todayDate]);

  const visibleBookings = bookings.filter((b) => b.status !== "CANCELLED");
  const cancelledCount  = bookings.length - visibleBookings.length;

  // Format date headline
  const [yr, mo, dy] = selectedDate.split("-").map(Number);
  const selDate = new Date(yr, mo - 1, dy);
  const headline = selDate.toLocaleDateString("th-TH", {
    weekday: "long", day: "numeric", month: "long",
  });

  return (
    <main className="pb-32">
      {/* ── Top bar ── */}
      <header
        className="sticky top-0 z-20 bg-white"
        style={{ borderBottom: `1px solid ${BORDER}` }}
      >
        <div className="px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <BrandLogo size="sm" />
            <span className="text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>Admin</span>
          </div>
          <div className="flex items-center gap-1">
            <Link
              href="/admin/m/search"
              aria-label="ค้นหา"
              className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ color: TEXT }}
            >
              <Search size={18} />
            </Link>
            <button
              onClick={() => setShowMenu(true)}
              aria-label="เมนู"
              className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ color: TEXT }}
            >
              <MoreVertical size={18} />
            </button>
          </div>
        </div>

        {/* Branch picker pill */}
        <div className="px-4 pb-3">
          <button
            onClick={() => setShowBranchPicker(true)}
            className="w-full flex items-center justify-between rounded-xl px-4 py-2.5 text-sm font-medium"
            style={{ background: "#FFF8F4", border: `1px solid ${BORDER}`, color: TEXT }}
          >
            <span className="truncate">{activeBranch?.name ?? "เลือกสาขา"}</span>
            <ChevronDown size={16} style={{ color: MUTED }} />
          </button>
        </div>

        {/* Date strip */}
        <div className="px-2 pb-3 flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {days.map(({ date, isSelected, isToday }) => {
            const [y, m, d] = date.split("-").map(Number);
            const dt = new Date(y, m - 1, d);
            return (
              <button
                key={date}
                onClick={() => switchDate(date)}
                className="flex-shrink-0 flex flex-col items-center justify-center px-3 py-2 rounded-xl min-w-[52px]"
                style={{
                  background: isSelected ? PRIMARY : (isToday ? "#FFF8F4" : "transparent"),
                  color:      isSelected ? "white"  : TEXT,
                  border:     isSelected ? "none"   : `1px solid ${isToday ? PRIMARY : BORDER}`,
                }}
              >
                <span className="text-[10px] opacity-70 leading-tight">{DOW_TH[dt.getDay()]}</span>
                <span className="text-base font-semibold leading-tight">{dt.getDate()}</span>
                {isToday && (
                  <span className="text-[8px] uppercase tracking-widest mt-0.5 leading-tight" style={{ opacity: isSelected ? 0.9 : 0.6 }}>
                    วันนี้
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* ── Date headline ── */}
      <section className="px-5 pt-5 pb-2">
        <h1 className="text-lg font-medium" style={{ color: TEXT }}>{headline}</h1>
        <p className="text-xs mt-0.5" style={{ color: MUTED }}>
          {visibleBookings.length === 0 ? "ไม่มีนัด" : `${visibleBookings.length} นัด`}
          {cancelledCount > 0 && ` · ยกเลิก ${cancelledCount}`}
        </p>
      </section>

      {/* ── Bookings list ── */}
      <section className="px-4 pb-6">
        {visibleBookings.length === 0 ? (
          <div className="rounded-2xl bg-white text-center py-12 px-5"
               style={{ border: `1.5px dashed ${BORDER}` }}>
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3"
                 style={{ background: "#FFF8F4" }}>
              <Sparkles size={22} style={{ color: PRIMARY }} />
            </div>
            <p className="text-sm font-medium mb-1" style={{ color: TEXT }}>ยังไม่มีนัดในวันนี้</p>
            <p className="text-xs" style={{ color: MUTED }}>
              แตะปุ่ม + เพื่อเพิ่มการจอง
            </p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {visibleBookings.map((b) => {
              const meta = STATUS_META[b.status];
              return (
                <li key={b.id}>
                  <Link
                    href={`/admin/m/${b.id}`}
                    className="block rounded-2xl bg-white p-4 transition-shadow active:scale-[0.99]"
                    style={{ border: `1px solid ${BORDER}` }}
                  >
                    <div className="flex items-start gap-3">
                      {/* Time block */}
                      <div className="flex flex-col items-center justify-center px-2.5 py-2 rounded-xl flex-shrink-0"
                           style={{ background: "#FFF8F4", minWidth: 60 }}>
                        <span className="text-base font-bold leading-none" style={{ color: PRIMARY }}>
                          {b.startTime}
                        </span>
                        <span className="text-[10px] mt-1 leading-none" style={{ color: MUTED }}>
                          {b.endTime}
                        </span>
                      </div>

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-sm font-semibold" style={{ color: TEXT }}>
                            {b.customerName}
                          </span>
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                            style={{ background: meta.bg, color: meta.fg }}
                          >
                            {meta.label}
                          </span>
                        </div>
                        <p className="text-xs truncate" style={{ color: TEXT }}>
                          {b.serviceName}
                          {b.addonCount > 0 && (
                            <span style={{ color: MUTED }}> · +{b.addonCount} เสริม</span>
                          )}
                        </p>
                        <p className="text-[11px] mt-0.5 flex items-center gap-2" style={{ color: MUTED }}>
                          <span className="inline-flex items-center gap-1"><User size={10} />{b.staffName ?? "ไม่ระบุช่าง"}</span>
                          <span className="inline-flex items-center gap-1"><Phone size={10} />{b.customerPhone}</span>
                        </p>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── FAB ── */}
      <Link
        href={`/admin/m/new?branchId=${activeBranchId}&date=${selectedDate}`}
        aria-label="เพิ่มการจอง"
        className="fixed bottom-6 z-30 rounded-full shadow-lg flex items-center justify-center text-white"
        style={{
          background: PRIMARY,
          width: 56, height: 56,
          right: "max(1.5rem, calc((100vw - 28rem)/2 + 1.5rem))",
        }}
      >
        <Plus size={26} />
      </Link>

      {/* ── Branch picker bottom sheet ── */}
      {showBranchPicker && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: "rgba(0,0,0,0.4)" }}
          onClick={() => setShowBranchPicker(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-t-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${BORDER}` }}>
              <p className="font-medium" style={{ color: TEXT }}>เลือกสาขา</p>
              <button onClick={() => setShowBranchPicker(false)} className="p-1" style={{ color: MUTED }}>
                <X size={18} />
              </button>
            </div>
            <ul className="p-3 max-h-80 overflow-y-auto">
              {branches.map((b) => (
                <li key={b.id}>
                  <button
                    onClick={() => switchBranch(b.id)}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl"
                    style={{
                      background: b.id === activeBranchId ? "#FFF8F4" : "transparent",
                      color: TEXT,
                    }}
                  >
                    <span className="text-sm">{b.name}</span>
                    {b.id === activeBranchId && <Check size={16} style={{ color: PRIMARY }} />}
                  </button>
                </li>
              ))}
            </ul>
            <div className="h-4" />
          </div>
        </div>
      )}

      {/* ── Menu sheet ── */}
      {showMenu && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: "rgba(0,0,0,0.4)" }}
          onClick={() => setShowMenu(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-t-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${BORDER}` }}>
              <p className="font-medium" style={{ color: TEXT }}>เมนู</p>
              <button onClick={() => setShowMenu(false)} className="p-1" style={{ color: MUTED }}>
                <X size={18} />
              </button>
            </div>
            <div className="p-2">
              <Link
                href="/admin"
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm"
                style={{ color: TEXT }}
              >
                <Clock size={16} style={{ color: MUTED }} />
                ไปหน้าแอดมินแบบเต็ม
              </Link>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-left"
                style={{ color: "#991B1B" }}
              >
                <LogOut size={16} />
                ออกจากระบบ
              </button>
            </div>
            <div className="h-4" />
          </div>
        </div>
      )}
    </main>
  );
}

