"use client";

import { useEffect, useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus, Search, MoreVertical, LogOut, RefreshCw,
  Phone, Clock, User, Check, X, Sparkles, ShoppingBag, Users, CreditCard, UserCog, BarChart2, Receipt, Gauge, CalendarDays, Wallet, Banknote,
} from "lucide-react";
import BrandLogo from "@/components/BrandLogo";

const PRIMARY = "#8B1D24";
const TEXT    = "#3B2A24";
const MUTED   = "#A08070";
const BORDER  = "#E8D8CC";

type Status = "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED" | "NO_SHOW";

interface Branch { id: string; name: string; }

interface PackageBadge {
  id:         string;
  sku:        string;
  expiresAt:  string;
  usagesLeft: number | null;
  isPending:  boolean;
}

interface BookingRow {
  id:                string;
  startTime:         string;
  endTime:           string;
  status:            Status;
  totalPrice:        number;
  /** Member-adjusted price for display in the overview list. Equals totalPrice for non-members. */
  displayPrice:      number;
  /** True when displayPrice < totalPrice (member rate is cheaper than saved). */
  hasMemberDiscount: boolean;
  serviceName:       string;
  customerName:      string;
  customerPhone:     string;
  staffName:         string | null;
  addonCount:        number;
  memberStatus:      "active" | "pending" | "expired" | null;
  memberExpiresAt:   string | null;
  packages:          PackageBadge[];
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
  const [showMenu, setShowMenu] = useState(false);
  const [isRefreshing, startRefresh] = useTransition();
  const [isNavigating, startNavigate] = useTransition();

  const handleRefresh = () => {
    // Server component re-fetches; useTransition gives us a pending flag
    startRefresh(() => router.refresh());
  };

  const buildDateUrl = (dateStr: string) => `?branchId=${activeBranchId}&date=${dateStr}`;

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
  };

  const switchDate = (dateStr: string) => {
    startNavigate(() => {
      const url = new URL(window.location.href);
      url.searchParams.set("date", dateStr);
      router.replace(url.pathname + url.search);
    });
  };

  const handleLogout = async () => {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    router.replace("/admin/login");
  };

  const days = useMemo(() => dateStripDays(selectedDate, todayDate), [selectedDate, todayDate]);

  const visibleBookings = bookings.filter((b) => b.status !== "CANCELLED");
  const cancelledCount  = bookings.length - visibleBookings.length;
  const paidRevenue     = visibleBookings
    .filter((b) => b.status === "COMPLETED")
    .reduce((sum, b) => sum + b.displayPrice, 0);
  const pendingRevenue  = visibleBookings
    .filter((b) => b.status === "CONFIRMED" || b.status === "PENDING")
    .reduce((sum, b) => sum + b.displayPrice, 0);


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
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              aria-label="รีเฟรช"
              className="w-9 h-9 rounded-full flex items-center justify-center disabled:opacity-60"
              style={{ color: TEXT }}
            >
              <RefreshCw size={17} className={isRefreshing ? "animate-spin" : ""} />
            </button>
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

        {/* Branch buttons — one tap to switch */}
        {branches.length > 1 && (
          <div className="px-4 pb-3 flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {branches.map((b) => (
              <button
                key={b.id}
                onClick={() => switchBranch(b.id)}
                className="flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all"
                style={{
                  background:  b.id === activeBranchId ? PRIMARY : "#FFF8F4",
                  color:       b.id === activeBranchId ? "white"  : TEXT,
                  border:      `1px solid ${b.id === activeBranchId ? PRIMARY : BORDER}`,
                }}
              >
                {b.name}
              </button>
            ))}
          </div>
        )}
        {branches.length === 1 && (
          <div className="px-4 pb-3">
            <div className="rounded-xl px-4 py-2.5 text-sm font-medium" style={{ background: "#FFF8F4", border: `1px solid ${BORDER}`, color: TEXT }}>
              {activeBranch?.name}
            </div>
          </div>
        )}

        {/* Date strip */}
        <div className="px-2 pb-3 flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none", opacity: isNavigating ? 0.6 : 1, transition: "opacity 100ms" }}>
          {days.map(({ date, isSelected, isToday }) => {
            const [y, m, d] = date.split("-").map(Number);
            const dt = new Date(y, m - 1, d);
            return (
              <Link
                key={date}
                href={buildDateUrl(date)}
                replace
                prefetch
                onClick={(e) => { e.preventDefault(); switchDate(date); }}
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
              </Link>
            );
          })}
        </div>
      </header>

      {/* ── Date headline ── */}
      <section className="px-5 pt-5 pb-2">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-lg font-medium" style={{ color: TEXT }}>{headline}</h1>
          {(paidRevenue > 0 || pendingRevenue > 0) && (
            <div className="text-right">
              {paidRevenue > 0 && (
                <p className="text-sm font-semibold leading-tight" style={{ color: "#166534" }}>
                  จ่ายแล้ว ฿{(paidRevenue / 100).toLocaleString()}
                </p>
              )}
              {pendingRevenue > 0 && (
                <p className="text-xs leading-tight mt-0.5" style={{ color: MUTED }}>
                  รอยืนยัน ฿{(pendingRevenue / 100).toLocaleString()}
                </p>
              )}
            </div>
          )}
        </div>
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
          <ul className="space-y-1.5">
            {visibleBookings.map((b) => {
              const meta = STATUS_META[b.status];
              return (
                <li key={b.id}>
                  <Link
                    href={`/admin/m/${b.id}`}
                    prefetch
                    className="block rounded-xl bg-white px-3 py-2.5 active:scale-[0.99]"
                    style={{ border: `1px solid ${BORDER}` }}
                  >
                    <div className="flex items-center gap-2.5">
                      {/* Time block */}
                      <div className="flex flex-col items-center justify-center flex-shrink-0" style={{ minWidth: 46 }}>
                        <span className="text-sm font-bold leading-none" style={{ color: PRIMARY }}>{b.startTime}</span>
                        <span className="text-[10px] mt-0.5 leading-none" style={{ color: MUTED }}>{b.endTime}</span>
                      </div>

                      {/* Divider */}
                      <div className="w-px self-stretch" style={{ background: BORDER }} />

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        {/* Row 1: name + status */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-semibold leading-tight truncate" style={{ color: TEXT }}>{b.customerName}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0" style={{ background: meta.bg, color: meta.fg }}>{meta.label}</span>
                          {b.memberStatus === "active" && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0 inline-flex items-center gap-0.5" style={{ background: "#F0FDF4", color: "#166534" }}>
                              <Sparkles size={8} />
                              {b.memberExpiresAt ? new Date(b.memberExpiresAt).toLocaleDateString("th-TH", { day: "numeric", month: "short" }) : "สมาชิก"}
                            </span>
                          )}
                          {b.memberStatus === "pending" && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0" style={{ background: "#FFF7ED", color: "#9A3412" }}>รอเปิด</span>
                          )}
                          {b.packages.filter(p => !p.isPending).map(p => (
                            <span key={p.id} className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0" style={{ background: "#EFF6FF", color: "#1D4ED8" }}>
                              {p.sku === "svc-buffet" ? "Buffet" : p.sku === "svc-pkg5" ? "5 ครั้ง" : p.sku}
                              {p.usagesLeft != null && ` ·${p.usagesLeft}`}
                            </span>
                          ))}
                        </div>
                        {/* Row 2: service + staff + phone */}
                        <p className="text-[11px] mt-0.5 truncate" style={{ color: MUTED }}>
                          {b.serviceName}
                          {b.addonCount > 0 && ` +${b.addonCount}`}
                          <span className="mx-1">·</span>
                          <User size={9} className="inline mb-0.5" /> {b.staffName ?? "ไม่ระบุ"}
                          <span className="mx-1">·</span>
                          {b.customerPhone}
                        </p>
                      </div>

                      {/* Price — right-aligned, hidden for cancelled/no-show */}
                      {b.status !== "CANCELLED" && b.status !== "NO_SHOW" && (
                        <div className="flex-shrink-0 text-right pl-1 leading-tight">
                          {b.hasMemberDiscount && (
                            <span
                              className="text-[10px] line-through block"
                              style={{ color: MUTED }}
                            >
                              ฿{(b.totalPrice / 100).toLocaleString()}
                            </span>
                          )}
                          <span
                            className="text-xs font-semibold"
                            style={{ color: b.status === "COMPLETED" ? "#166534" : MUTED }}
                          >
                            ฿{(b.displayPrice / 100).toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── FABs ── */}
      {/* Secondary: block schedule */}
      <Link
        href={`/admin/m/block?branchId=${activeBranchId}&date=${selectedDate}`}
        prefetch
        aria-label="ปิดช่วงเวลา"
        className="fixed z-30 rounded-full shadow-md flex items-center justify-center text-white"
        style={{
          background: "#374151",
          width: 44, height: 44,
          bottom: "calc(1.5rem + 56px + 12px)",
          right: "max(1.5rem, calc((100vw - 28rem)/2 + 1.5rem + 6px))",
        }}
      >
        <span className="text-sm font-bold">🚫</span>
      </Link>
      {/* Primary: new booking */}
      <Link
        href={`/admin/m/new?branchId=${activeBranchId}&date=${selectedDate}`}
        prefetch
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
                href="/admin/m/dashboard"
                prefetch
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm"
                style={{ color: TEXT }}
              >
                <BarChart2 size={16} style={{ color: MUTED }} />
                BI — ภาพรวมธุรกิจ
              </Link>
              <Link
                href="/admin/m/history"
                prefetch
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm"
                style={{ color: TEXT }}
              >
                <Receipt size={16} style={{ color: MUTED }} />
                ประวัติการขาย
              </Link>
              <Link
                href="/admin/m/expenses"
                prefetch
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm"
                style={{ color: TEXT }}
              >
                <Wallet size={16} style={{ color: MUTED }} />
                รายจ่าย
              </Link>
              <Link
                href="/admin/m/payroll"
                prefetch
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm"
                style={{ color: TEXT }}
              >
                <Banknote size={16} style={{ color: MUTED }} />
                ค่าตอบแทนพนักงาน
              </Link>
              <Link
                href="/admin/m/pos"
                prefetch
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm"
                style={{ color: TEXT }}
              >
                <ShoppingBag size={16} style={{ color: MUTED }} />
                POS — ขายหน้าร้าน
              </Link>
              <Link
                href="/admin/m/customers"
                prefetch
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm"
                style={{ color: TEXT }}
              >
                <Users size={16} style={{ color: MUTED }} />
                ลูกค้า
              </Link>
              <Link
                href="/admin/m/membership"
                prefetch
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm"
                style={{ color: TEXT }}
              >
                <CreditCard size={16} style={{ color: MUTED }} />
                สมาชิก
              </Link>
              <Link
                href="/admin/m/staff"
                prefetch
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm"
                style={{ color: TEXT }}
              >
                <UserCog size={16} style={{ color: MUTED }} />
                ช่าง
              </Link>
              <Link
                href="/admin/m/shifts"
                prefetch
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm"
                style={{ color: TEXT }}
              >
                <CalendarDays size={16} style={{ color: MUTED }} />
                ตารางงาน
              </Link>
              <Link
                href="/admin/m/capacity"
                prefetch
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm"
                style={{ color: TEXT }}
              >
                <Gauge size={16} style={{ color: MUTED }} />
                ความจุการจอง
              </Link>
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

