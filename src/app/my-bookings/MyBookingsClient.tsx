"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Calendar as CalendarIcon, Clock, MapPin, X, Edit3, Trash2, Check, AlertCircle, LogOut } from "lucide-react";
import { useLiff } from "@/hooks/useLiff";
import { Calendar } from "@/components/ui/calendar";
import { UserCheck, CreditCard as CardIcon, Package as PackageIcon } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import { LangSwitcher } from "@/components/LangSwitcher";
import { useLang, type Lang } from "@/components/LanguageProvider";

// Full slot range matching branch hours (Mon–Sat 08:00–20:30)
// The availability API will still mark taken slots correctly for Sunday (10:00–20:30).
const ALL_SLOTS: string[] = (() => {
  const slots: string[] = [];
  for (let t = 8 * 60; t <= 20 * 60 + 30; t += 30) {
    slots.push(`${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`);
  }
  return slots;
})();

const NON_APPOINTMENT_SERVICE_IDS = new Set([
  "svc-membership-30d", "svc-member-monthly", "svc-member-pkg", "svc-buffet", "svc-pkg5",
]);

type BookingStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED" | "NO_SHOW";

interface MembershipStatus {
  label:             string;
  activatedAt:       string;
  expiresAt:         string | null;
  usagesUsed:        number;
  usagesAllowed:     number;
  isExpired:         boolean;
  isUsagesExhausted: boolean;
}

interface ActivePackage {
  id:         string;
  sku:        string;
  nameTh:     string;
  startedAt:  string;
  expiresAt:  string;
  usagesUsed: number;
  usageLimit: number;
  usagesLeft: number | null; // null = unlimited
}

interface EntitlementsPayload {
  membership: MembershipStatus | null;
  packages:   ActivePackage[];
}

export interface ReschedulableBooking {
  id:         string;
  branchId:   string;
  serviceId:  string;
  date:       string;       // ISO
  startTime:  string;
  endTime:    string;
  notes?:      string | null;
  service: { id: string; name: string; nameTh: string };
  addons?: { addon: { id: string; name: string; nameTh: string } }[];
}

interface Booking extends ReschedulableBooking {
  status:     BookingStatus;
  branch:  { id: string; name: string; address: string; phone: string };
  service: { id: string; name: string; nameTh: string; category: string };
  addons:  { addon: { id: string; name: string; nameTh: string } }[];
}

export interface CustomerBranch { id: string; name: string; address: string; phone: string }
type Branch = CustomerBranch;

const STATUS_TH: Record<BookingStatus, string> = {
  PENDING:   "รอยืนยัน",
  CONFIRMED: "ยืนยันแล้ว",
  CANCELLED: "ยกเลิกแล้ว",
  COMPLETED: "เสร็จสิ้น",
  NO_SHOW:   "ไม่มาตามนัด",
};
const STATUS_EN: Record<BookingStatus, string> = {
  PENDING: "Pending", CONFIRMED: "Confirmed", CANCELLED: "Cancelled", COMPLETED: "Completed", NO_SHOW: "No-show",
};

const STATUS_STYLE: Record<BookingStatus, { bg: string; fg: string }> = {
  PENDING:   { bg: "#FEF3C7", fg: "#92400E" },
  CONFIRMED: { bg: "#D1FAE5", fg: "#065F46" },
  CANCELLED: { bg: "#FEE2E2", fg: "#991B1B" },
  COMPLETED: { bg: "#E0E7FF", fg: "#3730A3" },
  NO_SHOW:   { bg: "#FEE2E2", fg: "#991B1B" },
};

const LIFF_ID      = process.env.NEXT_PUBLIC_LIFF_ID ?? "";
const LINE_APP_URL = `https://liff.line.me/${LIFF_ID}`;

function isMobileDevice() {
  if (typeof navigator === "undefined") return false;
  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function formatDate(iso: string, lang: Lang = "th"): string {
  return new Date(iso).toLocaleDateString(lang === "th" ? "th-TH" : "en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function bookingStartsAt(booking: Pick<Booking, "date" | "startTime">) {
  const localDate = booking.date.slice(0, 10);
  const localTime = booking.startTime.length === 5 ? `${booking.startTime}:00` : booking.startTime;
  return Date.parse(`${localDate}T${localTime}+07:00`);
}

function cancellationRequiresAdmin(booking: Pick<Booking, "date" | "startTime">) {
  return bookingStartsAt(booking) - Date.now() <= 30 * 60 * 1000;
}


function isUpcoming(b: Booking): boolean {
  if (b.status === "CANCELLED" || b.status === "COMPLETED" || b.status === "NO_SHOW") return false;
  const bookingDate = new Date(b.date);
  bookingDate.setHours(23, 59, 59, 999);
  return bookingDate.getTime() >= Date.now();
}

export default function MyBookingsClient() {
  const liff = useLiff();
  const { lang } = useLang();
  const [bookings,    setBookings]    = useState<Booking[] | null>(null);
  const [entitlements, setEntitlements] = useState<EntitlementsPayload | "none" | null>(null);
  const [branches,    setBranches]    = useState<Branch[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [editing,     setEditing]     = useState<Booking | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<Booking | null>(null);
  const [contactAdmin, setContactAdmin] = useState<Booking | null>(null);
  const directEditHandled = useRef(false);

  const fetchBookings = useCallback(async (uid: string) => {
    setLoading(true);
    try {
      const [bookingsRes, branchesRes, membershipRes] = await Promise.all([
        fetch(`/api/customer/bookings?lineUserId=${encodeURIComponent(uid)}`),
        fetch("/api/branches"),
        fetch(`/api/liff/membership?lineUserId=${encodeURIComponent(uid)}`),
      ]);
      const data = await bookingsRes.json();
      const branchData = await branchesRes.json();
      const nextBookings: Booking[] = data.bookings ?? [];
      setBookings(nextBookings);
      setBranches(branchData);
      if (!directEditHandled.current && typeof window !== "undefined") {
        directEditHandled.current = true;
        const requestedId = new URLSearchParams(window.location.search).get("edit");
        const requestedBooking = requestedId
          ? nextBookings.find(booking => booking.id === requestedId && isUpcoming(booking))
          : null;
        if (requestedBooking) setEditing(requestedBooking);
      }
      if (membershipRes.ok) {
        const payload = await membershipRes.json();
        setEntitlements({
          membership: payload.membership ?? null,
          packages:   payload.packages   ?? [],
        });
      } else {
        // 404 may still carry packages array; try parsing
        try {
          const payload = await membershipRes.json();
          if (Array.isArray(payload.packages) && payload.packages.length > 0) {
            setEntitlements({ membership: null, packages: payload.packages });
          } else {
            setEntitlements("none");
          }
        } catch {
          setEntitlements("none");
        }
      }
    } catch (e) {
      console.error(e);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (liff.ready && liff.profile?.userId) {
      fetchBookings(liff.profile.userId);
    }
  }, [liff.ready, liff.profile?.userId, fetchBookings]);

  const handleLineLogin = () => {
    liff.login();
  };

  const handleCancel = async () => {
    if (!confirmCancel || !liff.profile?.userId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/customer/bookings/${confirmCancel.id}?lineUserId=${encodeURIComponent(liff.profile.userId)}`,
        { method: "DELETE" },
      );
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && data.error === "cancellation_cutoff") {
        setContactAdmin(confirmCancel);
        setConfirmCancel(null);
        return;
      }
      if (!res.ok) throw new Error();
      setConfirmCancel(null);
      await fetchBookings(liff.profile.userId);
    } catch {
      alert("ไม่สามารถยกเลิกการจองได้ กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  };

  // ── Loading / not signed in screens ──────────────────────────────────────────
  if (!liff.ready) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#FFFAF7" }}>
        <div className="w-10 h-10 border-4 rounded-full animate-spin"
          style={{ borderColor: "#EADDD4", borderTopColor: "#B52F3A" }} />
      </div>
    );
  }

  if (!liff.isLoggedIn) {
    return (
      <main className="min-h-screen" style={{ background: "#FFFAF7" }}>
        <Header />
        <div className="max-w-md mx-auto px-6 py-16 text-center">
          <CalendarIcon className="w-12 h-12 mx-auto mb-4" style={{ color: "#D8B4A3" }} />
          <h1 className="text-2xl font-medium mb-2" style={{ color: "#45352F" }}>{lang === "th" ? "การจองของฉัน" : "My bookings"}</h1>
          <p className="text-sm mb-8" style={{ color: "#977A6F" }}>
            {lang === "th" ? "เข้าสู่ระบบด้วย LINE เพื่อดูและจัดการการจองของคุณ" : "Sign in with LINE to view and manage your bookings."}
          </p>
          <button
            onClick={handleLineLogin}
            className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-semibold text-white text-sm"
            style={{ background: "#06C755" }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
              <path d="M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
            </svg>
            {lang === "th" ? "เข้าสู่ระบบด้วย LINE" : "Sign in with LINE"}
          </button>
        </div>
      </main>
    );
  }

  const upcoming = (bookings ?? []).filter(isUpcoming);
  const past     = (bookings ?? []).filter((b) => !isUpcoming(b));

  return (
    <main className="min-h-screen" style={{ background: "#FFFAF7" }}>
      <Header
        rightSlot={
          !liff.isInClient && (
            <button
              onClick={liff.logout}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full transition-colors hover:bg-white/10"
              style={{ color: "white", border: "1px solid rgba(255,255,255,0.4)" }}
            >
              <LogOut className="w-3 h-3" />
              ออกจากระบบ
            </button>
          )
        }
      />

      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Profile strip */}
        {liff.profile && (
          <div className="mb-6 flex items-center gap-3">
            {liff.profile.pictureUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={liff.profile.pictureUrl} alt="" className="w-12 h-12 rounded-full" />
            )}
            <div>
              <p className="text-xs uppercase tracking-widest" style={{ color: "#977A6F" }}>{lang === "th" ? "การจองของฉัน" : "MY BOOKINGS"}</p>
              <h1 className="text-lg font-medium" style={{ color: "#45352F" }}>
                {lang === "th" ? "สวัสดี" : "Hello"} {liff.profile.displayName}
              </h1>
            </div>
          </div>
        )}

        {/* Entitlements: membership + packages */}
        {entitlements !== null && <EntitlementCards data={entitlements} />}

        {bookings === null || loading ? (
          <div className="text-center py-16">
            <div className="w-8 h-8 border-4 rounded-full animate-spin mx-auto mb-3"
              style={{ borderColor: "#EADDD4", borderTopColor: "#B52F3A" }} />
            <p className="text-sm" style={{ color: "#977A6F" }}>{lang === "th" ? "กำลังโหลด..." : "Loading..."}</p>
          </div>
        ) : bookings.length === 0 ? (
          <div className="text-center py-16 rounded-2xl bg-white" style={{ border: "1.5px solid #EADDD4" }}>
            <CalendarIcon className="w-10 h-10 mx-auto mb-3" style={{ color: "#D8B4A3" }} />
            <p className="text-sm mb-4" style={{ color: "#977A6F" }}>{lang === "th" ? "ยังไม่มีการจอง" : "No bookings yet"}</p>
            <Link
              href="/"
              className="inline-block px-5 py-2.5 rounded-xl text-white text-sm font-medium"
              style={{ background: "#B52F3A" }}
            >
              {lang === "th" ? "จองคิวเลย" : "Book now"}
            </Link>
          </div>
        ) : (
          <>
            <Section title={lang === "th" ? "การจองที่กำลังจะมาถึง" : "Upcoming appointments"} subtitle="Upcoming" empty={lang === "th" ? "ไม่มีการจองที่กำลังจะมาถึง" : "No upcoming appointments"}>
              {upcoming.map((b) => (
                <BookingCard
                  key={b.id}
                  booking={b}
                  onEdit={() => setEditing(b)}
                  onCancel={() => cancellationRequiresAdmin(b) ? setContactAdmin(b) : setConfirmCancel(b)}
                  showActions
                  lang={lang}
                />
              ))}
            </Section>

            {past.length > 0 && (
              <Section title={lang === "th" ? "การจองที่ผ่านมา" : "Past appointments"} subtitle="History" empty="">
                {past.map((b) => (
                  <BookingCard key={b.id} booking={b} showActions={false} lang={lang} />
                ))}
              </Section>
            )}
          </>
        )}
      </div>

      {/* Reschedule modal */}
      {editing && liff.profile && (
        <RescheduleModal
          booking={editing}
          branches={branches}
          lineUserId={liff.profile.userId}
          lang={lang}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            if (liff.profile) fetchBookings(liff.profile.userId);
          }}
        />
      )}

      {/* Cancel confirm modal */}
      {confirmCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setConfirmCancel(null)}>
          <div className="bg-white rounded-2xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "#FEE2E2" }}>
                <AlertCircle className="w-5 h-5" style={{ color: "#991B1B" }} />
              </div>
              <h3 className="text-base font-semibold" style={{ color: "#45352F" }}>{lang === "th" ? "ยกเลิกการจอง?" : "Cancel this appointment?"}</h3>
            </div>
            <p className="text-sm mb-5" style={{ color: "#6F574D" }}>
              {lang === "th" ? `คุณกำลังจะยกเลิกการจองที่ ${confirmCancel.branch.name} วันที่ ${formatDate(confirmCancel.date, lang)} เวลา ${confirmCancel.startTime} น.` : `You’re cancelling your appointment at ${confirmCancel.branch.name} on ${formatDate(confirmCancel.date, lang)} at ${confirmCancel.startTime}.`}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmCancel(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border-2"
                style={{ borderColor: "#D8B4A3", color: "#6F574D" }}
                disabled={loading}
              >
                {lang === "th" ? "เก็บไว้" : "Keep appointment"}
              </button>
              <button
                onClick={handleCancel}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50"
                style={{ background: "#DC2626" }}
                disabled={loading}
              >
                {loading ? (lang === "th" ? "กำลังยกเลิก..." : "Cancelling...") : (lang === "th" ? "ยืนยันยกเลิก" : "Confirm cancellation")}
              </button>
            </div>
          </div>
        </div>
      )}

      {contactAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setContactAdmin(null)}>
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: "#FFF0BD" }}>
              <AlertCircle className="w-6 h-6" style={{ color: "#7A4B12" }} />
            </div>
            <h3 className="text-lg font-semibold mb-2" style={{ color: "#45352F" }}>{lang === "th" ? "กรุณาติดต่อแอดมิน" : "Please contact the salon"}</h3>
            <p className="text-sm mb-5" style={{ color: "#6F574D" }}>{lang === "th" ? "ไม่สามารถยกเลิกออนไลน์ภายใน 30 นาทีก่อนเวลานัด กรุณาติดต่อร้านเพื่อขอความช่วยเหลือ" : "Online cancellation is unavailable within 30 minutes of your appointment. Please contact the salon for assistance."}</p>
            <div className="flex flex-col gap-2">
              {contactAdmin.branch.phone && <a href={`tel:${contactAdmin.branch.phone}`} className="w-full py-2.5 rounded-xl text-sm font-medium text-white" style={{ background: "#B52F3A" }}>{lang === "th" ? "โทรหาร้าน" : "Call salon"} · {contactAdmin.branch.phone}</a>}
              <button onClick={() => setContactAdmin(null)} className="w-full py-2.5 rounded-xl text-sm font-medium border-2" style={{ borderColor: "#D8B4A3", color: "#6F574D" }}>{lang === "th" ? "ปิด" : "Close"}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// ── Entitlement cards (membership + packages) ────────────────────────────────
function EntitlementCards({ data }: { data: EntitlementsPayload | "none" }) {
  if (data === "none") {
    return (
      <div
        className="rounded-2xl mb-6 p-4 flex items-center gap-3"
        style={{ background: "#FFFBF8", border: "1.5px dashed #EADDD4" }}
      >
        <CardIcon className="w-8 h-8 flex-shrink-0" style={{ color: "#D8B4A3" }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium" style={{ color: "#45352F" }}>ยังไม่มีสมาชิกหรือแพ็กเกจ</p>
          <p className="text-xs mt-0.5" style={{ color: "#977A6F" }}>สมัครเพื่อรับสิทธิประโยชน์ — เริ่มต้น ฿990</p>
        </div>
        <a
          href="/liff/membership/signup"
          className="flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold text-white"
          style={{ background: "#B52F3A" }}
        >
          สมัคร
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-2.5 mb-6">
      {data.membership && <MembershipCard m={data.membership} />}
      {data.packages.map(p => <PackageCard key={p.id} pkg={p} />)}
    </div>
  );
}

// Promo artwork (served from public/membership/). Same images used on the
// LINE Flex cards — buffet has none yet, so it falls back to the plain layout.
const MEMBERSHIP_IMG = "/membership/membership.jpg";
const PACKAGE_IMG: Record<string, string> = {
  "svc-pkg5": "/membership/pack5.jpg",
  // "svc-buffet": "/membership/buffet.jpg",  // add when the artwork is ready
};

function MembershipCard({ m }: { m: MembershipStatus }) {
  const isActive = !m.isExpired && !m.isUsagesExhausted;
  const expiresDate = m.expiresAt
    ? new Date(m.expiresAt).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })
    : null;
  const usagesLeft = m.usagesAllowed > 0
    ? Math.max(0, m.usagesAllowed - m.usagesUsed)
    : null;
  const statusText = m.isExpired ? "หมดอายุ" : m.isUsagesExhausted ? "ใช้ครบแล้ว" : "ใช้งานได้";

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: `1.5px solid ${isActive ? "#BBF7D0" : "#FECACA"}`, background: "white" }}>
      {/* Promo artwork */}
      <div style={{ position: "relative" }}>
        <Image
          src={MEMBERSHIP_IMG}
          alt="err.day membership"
          width={1024}
          height={768}
          sizes="(max-width: 768px) 100vw, 480px"
          className="w-full h-auto block"
          style={{ opacity: isActive ? 1 : 0.5 }}
        />
        <span
          className="absolute top-2.5 right-2.5 text-xs px-2 py-0.5 rounded-full font-semibold"
          style={isActive ? { background: "#D1FAE5", color: "#065F46" } : { background: "#FEE2E2", color: "#991B1B" }}
        >
          {statusText}
        </span>
      </div>
      {/* Live details */}
      <div className="px-4 py-3 flex items-center gap-3" style={{ background: isActive ? "#ECFDF5" : "#FEF2F2" }}>
        <UserCheck className="w-7 h-7 flex-shrink-0" style={{ color: isActive ? "#059669" : "#DC2626" }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold" style={{ color: isActive ? "#065F46" : "#991B1B" }}>{m.label}</p>
          <div className="flex items-center gap-3 mt-0.5 text-xs flex-wrap" style={{ color: isActive ? "#059669" : "#DC2626" }}>
            <span>{expiresDate ? `หมดอายุ ${expiresDate}` : "ไม่หมดอายุ"}</span>
            {usagesLeft !== null && <span>· ยังใช้ได้อีก {usagesLeft} ครั้ง จากทั้งหมด {m.usagesAllowed} ครั้ง (ใช้ไปแล้ว {m.usagesUsed})</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

function PackageCard({ pkg }: { pkg: ActivePackage }) {
  const img = PACKAGE_IMG[pkg.sku];
  const expiresDate = new Date(pkg.expiresAt).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
  const daysLeft = Math.max(0, Math.ceil((new Date(pkg.expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)));

  const details = (
    <div className="flex items-center gap-3 mt-0.5 text-xs flex-wrap" style={{ color: "#2563EB" }}>
      <span>เหลือ {daysLeft} วัน · หมดอายุ {expiresDate}</span>
      {pkg.usagesLeft !== null ? (
        <span>· ยังใช้ได้อีก {pkg.usagesLeft} ครั้ง จากทั้งหมด {pkg.usageLimit} ครั้ง (ใช้ไปแล้ว {pkg.usagesUsed}) · ได้ราคาสมาชิก</span>
      ) : (
        <span>· ใช้แล้ว {pkg.usagesUsed} ครั้ง (ไม่จำกัด) · ได้ราคาสมาชิก</span>
      )}
    </div>
  );

  // No artwork (e.g. buffet) → compact icon layout.
  if (!img) {
    return (
      <div className="rounded-2xl p-4" style={{ background: "#EFF6FF", border: "1.5px solid #BFDBFE" }}>
        <div className="flex items-center gap-3">
          <PackageIcon className="w-8 h-8 flex-shrink-0" style={{ color: "#2563EB" }} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-bold" style={{ color: "#1E3A8A" }}>{pkg.nameTh}</p>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "#DBEAFE", color: "#1E40AF" }}>ใช้งานได้</span>
            </div>
            {details}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "1.5px solid #BFDBFE", background: "white" }}>
      <div style={{ position: "relative" }}>
        <Image
          src={img}
          alt={pkg.nameTh}
          width={1024}
          height={768}
          sizes="(max-width: 768px) 100vw, 480px"
          className="w-full h-auto block"
        />
        <span className="absolute top-2.5 right-2.5 text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: "#DBEAFE", color: "#1E40AF" }}>ใช้งานได้</span>
      </div>
      <div className="px-4 py-3 flex items-center gap-3" style={{ background: "#EFF6FF" }}>
        <PackageIcon className="w-7 h-7 flex-shrink-0" style={{ color: "#2563EB" }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold" style={{ color: "#1E3A8A" }}>{pkg.nameTh}</p>
          {details}
        </div>
      </div>
    </div>
  );
}

// ── Header ────────────────────────────────────────────────────────────────────
function Header({ rightSlot }: { rightSlot?: React.ReactNode }) {
  return (
    <nav className="px-6 py-3 flex items-center justify-between" style={{ backgroundColor: "#B52F3A" }}>
      <div className="flex items-center gap-3">
        <Link href="/" className="text-white/80 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <BrandLogo light size="md" />
      </div>
      <div className="flex items-center gap-2"><LangSwitcher />{rightSlot}</div>
    </nav>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({
  title, subtitle, empty, children,
}: { title: string; subtitle: string; empty: string; children: React.ReactNode }) {
  const childArr = Array.isArray(children) ? children : [children];
  const hasChildren = childArr.filter(Boolean).length > 0;
  return (
    <section className="mb-8">
      <div className="mb-3">
        <h2 className="text-base font-semibold" style={{ color: "#45352F" }}>{title}</h2>
        <p className="text-xs" style={{ color: "#977A6F" }}>{subtitle}</p>
      </div>
      {hasChildren ? (
        <div className="space-y-3">{children}</div>
      ) : empty ? (
        <p className="text-sm py-4 text-center rounded-xl bg-white"
          style={{ color: "#977A6F", border: "1px dashed #EADDD4" }}>
          {empty}
        </p>
      ) : null}
    </section>
  );
}

// ── Booking card ──────────────────────────────────────────────────────────────
function BookingCard({
  booking, onEdit, onCancel, showActions, lang,
}: { booking: Booking; onEdit?: () => void; onCancel?: () => void; showActions: boolean; lang: Lang }) {
  const style = STATUS_STYLE[booking.status];
  return (
    <div className="rounded-2xl bg-white p-5" style={{ border: "1.5px solid #EADDD4" }}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold mb-0.5" style={{ color: "#45352F" }}>
            {lang === "th" ? booking.service.nameTh || booking.service.name : booking.service.name}
          </h3>
          <p className="text-xs" style={{ color: "#977A6F" }}>{booking.service.category}</p>
        </div>
        <span className="text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap"
          style={{ background: style.bg, color: style.fg }}>
          {lang === "th" ? STATUS_TH[booking.status] : STATUS_EN[booking.status]}
        </span>
      </div>

      <div className="space-y-1.5 text-sm" style={{ color: "#5C4A42" }}>
        <p className="flex items-center gap-2">
          <MapPin className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#D8B4A3" }} />
          {booking.branch.name}
        </p>
        <p className="flex items-center gap-2">
          <CalendarIcon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#D8B4A3" }} />
          {formatDate(booking.date, lang)}
        </p>
        <p className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#D8B4A3" }} />
          {booking.startTime} — {booking.endTime} น.
        </p>
        {booking.addons && booking.addons.length > 0 && (
          <p className="text-xs pl-5" style={{ color: "#977A6F" }}>
            {lang === "th" ? "ตัวเลือกเสริม" : "Add-ons"}: {booking.addons.map(item => lang === "th" ? item.addon.nameTh : (item.addon.name || item.addon.nameTh)).join(", ")}
          </p>
        )}
        {booking.notes && (
          <p className="text-xs pl-5 whitespace-pre-wrap" style={{ color: "#977A6F" }}>
            {lang === "th" ? "หมายเหตุ" : "Notes"}: {booking.notes}
          </p>
        )}
      </div>

      {showActions && (
        <div className="flex gap-2 mt-4">
          <button
            onClick={onEdit}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium border-2 transition-colors"
            style={{ borderColor: "#B52F3A", color: "#B52F3A", background: "white" }}
          >
            <Edit3 className="w-3.5 h-3.5" />
            {lang === "th" ? "แก้ไขการจอง" : "Edit booking"}
          </button>
          <button
            onClick={onCancel}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium border-2 transition-colors"
            style={{ borderColor: "#FECACA", color: "#DC2626", background: "white" }}
          >
            <Trash2 className="w-3.5 h-3.5" />
            {lang === "th" ? "ยกเลิก" : "Cancel"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Reschedule modal ──────────────────────────────────────────────────────────
export function RescheduleModal({
  booking, branches, lineUserId, onClose, onSaved, lang,
}: {
  booking: ReschedulableBooking;
  branches: CustomerBranch[];
  lineUserId: string;
  onClose: () => void;
  onSaved: () => void;
  lang: Lang;
}) {
  const [branchId,   setBranchId]   = useState(booking.branchId);
  const [serviceId,  setServiceId]  = useState(booking.serviceId);
  const [date,       setDate]       = useState<Date>(new Date(booking.date));
  const [startTime,  setStartTime]  = useState(booking.startTime);
  const [duration,   setDuration]   = useState<number | null>(null);
  const [services,   setServices]   = useState<{ duration: number; price: number; service: { id: string; name: string; nameTh: string; category: string } }[]>([]);
  const [addons,     setAddons]     = useState<{ id: string; name: string; nameTh: string; price: number }[]>([]);
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>(() => booking.addons?.map(item => item.addon.id) ?? []);
  const [notes,      setNotes]      = useState(booking.notes ?? "");
  const [takenSlots, setTakenSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState("");

  // Load services for the selected branch and resolve the selected duration.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/services?branchId=${encodeURIComponent(branchId)}`);
        if (!res.ok) throw new Error();
        const responseServices: { duration: number; price: number; service: { id: string; name: string; nameTh: string; category: string } }[] = await res.json();
        const nextServices = responseServices.filter(item => !NON_APPOINTMENT_SERVICE_IDS.has(item.service.id));
        if (cancelled) return;
        setServices(nextServices);
        const match = nextServices.find((s) => s.service.id === serviceId);
        setDuration(match ? match.duration : null);
        if (!match) setError(lang === "th" ? "สาขานี้ไม่มีบริการนี้" : "This service is unavailable at this branch.");
        else setError("");
      } catch {
        if (!cancelled) setDuration(null);
      }
    })();
    return () => { cancelled = true; };
  }, [branchId, serviceId, lang]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/addons")
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => { if (!cancelled) setAddons(data); })
      .catch(() => { if (!cancelled) setAddons([]); });
    return () => { cancelled = true; };
  }, []);

  // Fetch taken slots for the selected date+branch+duration
  useEffect(() => {
    if (!duration) { setTakenSlots([]); return; }
    setLoadingSlots(true);
    setTakenSlots([]);
    const localDate = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
    const params = new URLSearchParams({ branchId, date: localDate, duration: String(duration) });
    fetch(`/api/availability?${params}`)
      .then((r) => r.json())
      .then((data) => setTakenSlots(data.taken ?? []))
      .catch(() => {})
      .finally(() => setLoadingSlots(false));
  }, [branchId, date, duration]);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const localDate = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
      const res = await fetch(`/api/customer/bookings/${booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineUserId, branchId, serviceId, date: localDate, startTime, addonIds: selectedAddonIds, notes }),
      });
      if (res.status === 409) {
        setError(lang === "th" ? "เวลาที่เลือกถูกจองแล้ว กรุณาเลือกเวลาอื่น" : "That time is no longer available. Please choose another.");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || (lang === "th" ? "เกิดข้อผิดพลาด กรุณาลองใหม่" : "Something went wrong. Please try again."));
        return;
      }
      onSaved();
    } catch {
      setError(lang === "th" ? "เกิดข้อผิดพลาด กรุณาลองใหม่" : "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Note: we treat "today" booking as still allowed (within reason). Disable past dates only.
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 sm:px-4" onClick={onClose}>
      <div
        className="bg-white sm:rounded-2xl rounded-t-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white px-6 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid #F1E4DC" }}>
          <div>
            <h3 className="text-base font-semibold" style={{ color: "#45352F" }}>{lang === "th" ? "เปลี่ยนแปลงการจอง" : "Reschedule appointment"}</h3>
            <p className="text-xs" style={{ color: "#977A6F" }}>{lang === "th" ? "บริการ วันเวลา ตัวเลือกเสริม และหมายเหตุ" : "Service, schedule, add-ons and notes"}</p>
          </div>

          <button onClick={onClose} className="p-1 rounded-full hover:bg-stone-100">
            <X className="w-5 h-5" style={{ color: "#6F574D" }} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Branch */}
          <div>
            <label className="text-sm font-medium mb-2 block" style={{ color: "#5C4A42" }}>{lang === "th" ? "สาขา" : "Branch"}</label>
            <div className="space-y-2">
              {branches.map((b) => {
                const selected = branchId === b.id;
                return (
                  <button
                    key={b.id}
                    onClick={() => setBranchId(b.id)}
                    className="w-full text-left p-3 rounded-xl border-2 transition-colors"
                    style={{
                      borderColor: selected ? "#B52F3A" : "#EADDD4",
                      background:  selected ? "#FFFBF8" : "white",
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium" style={{ color: "#45352F" }}>{b.name}</p>
                        <p className="text-xs truncate" style={{ color: "#977A6F" }}>{b.address}</p>
                      </div>
                      {selected && <Check className="w-4 h-4 flex-shrink-0" style={{ color: "#B52F3A" }} />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Service */}
          <div>
            <label className="text-sm font-medium mb-2 block" style={{ color: "#5C4A42" }}>{lang === "th" ? "บริการ" : "Service"}</label>
            <select
              value={serviceId}
              onChange={(event) => setServiceId(event.target.value)}
              className="w-full p-3 rounded-xl border-2 bg-white text-sm"
              style={{ borderColor: "#EADDD4", color: "#45352F" }}
            >
              {services.map(item => (
                <option key={item.service.id} value={item.service.id}>
                  {lang === "th" ? item.service.nameTh : (item.service.name || item.service.nameTh)} · ฿{(item.price / 100).toLocaleString()}
                </option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <label className="text-sm font-medium mb-2 block" style={{ color: "#5C4A42" }}>{lang === "th" ? "วันที่" : "Date"}</label>
            <div className="rounded-xl border" style={{ borderColor: "#EADDD4" }}>
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d) => d && setDate(d)}
                disabled={(d) => d < today}
                className="rounded-xl"
              />
            </div>
          </div>

          {/* Time slots */}
          <div>
            <label className="text-sm font-medium mb-2 block" style={{ color: "#5C4A42" }}>{lang === "th" ? "เวลา" : "Time"}</label>
            {loadingSlots ? (
              <p className="text-sm text-center py-4" style={{ color: "#977A6F" }}>{lang === "th" ? "กำลังโหลด..." : "Loading..."}</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {ALL_SLOTS.map((t) => {
                  const currentDate = booking.date.slice(0, 10);
                  const selectedDate = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
                  const isOwnCurrentSlot = branchId === booking.branchId && serviceId === booking.serviceId && selectedDate === currentDate && t === booking.startTime;
                  const isTaken = takenSlots.includes(t) && !isOwnCurrentSlot;
                  const isSelected = startTime === t;
                  return (
                    <button
                      key={t}
                      onClick={() => !isTaken && setStartTime(t)}
                      disabled={isTaken}
                      className="py-2 rounded-lg text-sm border-2 transition-all"
                      style={
                        isTaken
                          ? { background: "#F5F0EC", borderColor: "#EADDD4", color: "#C4B0A4", cursor: "not-allowed" }
                          : isSelected
                          ? { background: "#B52F3A", borderColor: "#B52F3A", color: "white", fontWeight: 500 }
                          : { background: "white", borderColor: "#EADDD4", color: "#5C4A42" }
                      }
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Add-ons */}
          <div>
            <label className="text-sm font-medium mb-2 block" style={{ color: "#5C4A42" }}>{lang === "th" ? "ตัวเลือกเสริม" : "Add-ons"}</label>
            {addons.length === 0 ? (
              <p className="text-xs" style={{ color: "#977A6F" }}>{lang === "th" ? "ไม่มีตัวเลือกเสริม" : "No add-ons available"}</p>
            ) : (
              <div className="space-y-2">
                {addons.map(addon => {
                  const selected = selectedAddonIds.includes(addon.id);
                  return (
                    <button
                      type="button"
                      key={addon.id}
                      onClick={() => setSelectedAddonIds(current => selected ? current.filter(id => id !== addon.id) : [...current, addon.id])}
                      className="w-full p-3 rounded-xl border-2 flex items-center gap-3 text-left"
                      style={{ borderColor: selected ? "#B52F3A" : "#EADDD4", background: selected ? "#FFFBF8" : "white" }}
                    >
                      <span className="w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0" style={{ borderColor: selected ? "#B52F3A" : "#D8B4A3", background: selected ? "#B52F3A" : "white", color: "white" }}>{selected && <Check className="w-3.5 h-3.5" />}</span>
                      <span className="flex-1 text-sm" style={{ color: "#45352F" }}>{lang === "th" ? addon.nameTh : (addon.name || addon.nameTh)}</span>
                      <span className="text-sm" style={{ color: "#977A6F" }}>+฿{(addon.price / 100).toLocaleString()}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="text-sm font-medium mb-2 block" style={{ color: "#5C4A42" }}>
              {lang === "th" ? "หมายเหตุถึงร้าน (แก้ไขได้)" : "Note to the salon (editable)"}
            </label>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={1000}
              rows={3}
              placeholder={lang === "th" ? "แจ้งรายละเอียดเพิ่มเติมให้ร้านทราบ" : "Add a note for the salon"}
              className="w-full p-3 rounded-xl border-2 text-sm resize-none"
              style={{ borderColor: "#EADDD4", color: "#45352F" }}
            />
            <p className="text-xs mt-1.5" style={{ color: "#977A6F" }}>
              {lang === "th"
                ? "แก้ไขข้อความนี้ได้จากหน้าจัดการการจอง โดยไม่กระทบหมายเหตุภายในของร้าน"
                : "You can update this from Manage Booking without changing the salon's internal note."}
            </p>
          </div>

          {error && (
            <p className="text-sm flex items-center gap-2 p-3 rounded-xl" style={{ color: "#991B1B", background: "#FEE2E2" }}>
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </p>
          )}
        </div>

        <div className="sticky bottom-0 bg-white px-6 py-4 flex gap-2" style={{ borderTop: "1px solid #F1E4DC" }}>
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl text-sm font-medium border-2"
            style={{ borderColor: "#D8B4A3", color: "#6F574D" }}
            disabled={saving}
          >
            {lang === "th" ? "ปิด" : "Close"}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !duration}
            className="flex-1 py-3 rounded-xl text-sm font-medium text-white disabled:opacity-50"
            style={{ background: "#B52F3A" }}
          >
            {saving ? (lang === "th" ? "กำลังบันทึก..." : "Saving...") : (lang === "th" ? "บันทึกการเปลี่ยนแปลง" : "Save changes")}
          </button>
        </div>
      </div>
    </div>
  );
}
