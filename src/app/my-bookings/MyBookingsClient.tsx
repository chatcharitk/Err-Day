"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Calendar as CalendarIcon, Clock, MapPin, X, Edit3, Trash2, Check, AlertCircle, LogOut } from "lucide-react";
import { useLiff } from "@/hooks/useLiff";
import { Calendar } from "@/components/ui/calendar";
import { UserCheck, CreditCard as CardIcon, Package as PackageIcon } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";

const ALL_SLOTS = [
  "10:00","10:30","11:00","11:30","12:00","12:30",
  "13:00","13:30","14:00","14:30","15:00","15:30",
  "16:00","16:30","17:00","17:30","18:00","18:30",
];

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

interface Booking {
  id:         string;
  branchId:   string;
  serviceId:  string;
  date:       string;       // ISO
  startTime:  string;
  endTime:    string;
  status:     BookingStatus;
  branch:  { id: string; name: string; address: string; phone: string };
  service: { id: string; name: string; nameTh: string; category: string };
  addons:  { addon: { id: string; name: string; nameTh: string } }[];
}

interface Branch { id: string; name: string; address: string; phone: string }

const STATUS_TH: Record<BookingStatus, string> = {
  PENDING:   "รอยืนยัน",
  CONFIRMED: "ยืนยันแล้ว",
  CANCELLED: "ยกเลิกแล้ว",
  COMPLETED: "เสร็จสิ้น",
  NO_SHOW:   "ไม่มาตามนัด",
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("th-TH", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}


function isUpcoming(b: Booking): boolean {
  if (b.status === "CANCELLED" || b.status === "COMPLETED" || b.status === "NO_SHOW") return false;
  const bookingDate = new Date(b.date);
  bookingDate.setHours(23, 59, 59, 999);
  return bookingDate.getTime() >= Date.now();
}

export default function MyBookingsClient() {
  const liff = useLiff();
  const [bookings,    setBookings]    = useState<Booking[] | null>(null);
  const [entitlements, setEntitlements] = useState<EntitlementsPayload | "none" | null>(null);
  const [branches,    setBranches]    = useState<Branch[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [editing,     setEditing]     = useState<Booking | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<Booking | null>(null);

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
      setBookings(data.bookings ?? []);
      setBranches(branchData);
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
    if (isMobileDevice()) {
      window.location.href = LINE_APP_URL;
    } else {
      liff.login();
    }
  };

  const handleCancel = async () => {
    if (!confirmCancel || !liff.profile?.userId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/customer/bookings/${confirmCancel.id}?lineUserId=${encodeURIComponent(liff.profile.userId)}`,
        { method: "DELETE" },
      );
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
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#FDF8F3" }}>
        <div className="w-10 h-10 border-4 rounded-full animate-spin"
          style={{ borderColor: "#E8D8CC", borderTopColor: "#8B1D24" }} />
      </div>
    );
  }

  if (!liff.isLoggedIn) {
    return (
      <main className="min-h-screen" style={{ background: "#FDF8F3" }}>
        <Header />
        <div className="max-w-md mx-auto px-6 py-16 text-center">
          <CalendarIcon className="w-12 h-12 mx-auto mb-4" style={{ color: "#D6BCAE" }} />
          <h1 className="text-2xl font-medium mb-2" style={{ color: "#3B2A24" }}>การจองของฉัน</h1>
          <p className="text-sm mb-8" style={{ color: "#A08070" }}>
            เข้าสู่ระบบด้วย LINE เพื่อดูและจัดการการจองของคุณ
          </p>
          <button
            onClick={handleLineLogin}
            className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-semibold text-white text-sm"
            style={{ background: "#06C755" }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
              <path d="M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
            </svg>
            เข้าสู่ระบบด้วย LINE
          </button>
        </div>
      </main>
    );
  }

  const upcoming = (bookings ?? []).filter(isUpcoming);
  const past     = (bookings ?? []).filter((b) => !isUpcoming(b));

  return (
    <main className="min-h-screen" style={{ background: "#FDF8F3" }}>
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
              <p className="text-xs uppercase tracking-widest" style={{ color: "#A08070" }}>การจองของฉัน</p>
              <h1 className="text-lg font-medium" style={{ color: "#3B2A24" }}>
                สวัสดี {liff.profile.displayName}
              </h1>
            </div>
          </div>
        )}

        {/* Entitlements: membership + packages */}
        {entitlements !== null && <EntitlementCards data={entitlements} />}

        {bookings === null || loading ? (
          <div className="text-center py-16">
            <div className="w-8 h-8 border-4 rounded-full animate-spin mx-auto mb-3"
              style={{ borderColor: "#E8D8CC", borderTopColor: "#8B1D24" }} />
            <p className="text-sm" style={{ color: "#A08070" }}>กำลังโหลด...</p>
          </div>
        ) : bookings.length === 0 ? (
          <div className="text-center py-16 rounded-2xl bg-white" style={{ border: "1.5px solid #E8D8CC" }}>
            <CalendarIcon className="w-10 h-10 mx-auto mb-3" style={{ color: "#D6BCAE" }} />
            <p className="text-sm mb-4" style={{ color: "#A08070" }}>ยังไม่มีการจอง</p>
            <Link
              href="/"
              className="inline-block px-5 py-2.5 rounded-xl text-white text-sm font-medium"
              style={{ background: "#8B1D24" }}
            >
              จองคิวเลย
            </Link>
          </div>
        ) : (
          <>
            <Section title="การจองที่กำลังจะมาถึง" subtitle="Upcoming" empty="ไม่มีการจองที่กำลังจะมาถึง">
              {upcoming.map((b) => (
                <BookingCard
                  key={b.id}
                  booking={b}
                  onEdit={() => setEditing(b)}
                  onCancel={() => setConfirmCancel(b)}
                  showActions
                />
              ))}
            </Section>

            {past.length > 0 && (
              <Section title="การจองที่ผ่านมา" subtitle="History" empty="">
                {past.map((b) => (
                  <BookingCard key={b.id} booking={b} showActions={false} />
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
              <h3 className="text-base font-semibold" style={{ color: "#3B2A24" }}>ยกเลิกการจอง?</h3>
            </div>
            <p className="text-sm mb-5" style={{ color: "#6B5245" }}>
              คุณกำลังจะยกเลิกการจองที่ {confirmCancel.branch.name} วันที่ {formatDate(confirmCancel.date)} เวลา {confirmCancel.startTime} น.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmCancel(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border-2"
                style={{ borderColor: "#D6BCAE", color: "#6B5245" }}
                disabled={loading}
              >
                เก็บไว้
              </button>
              <button
                onClick={handleCancel}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50"
                style={{ background: "#DC2626" }}
                disabled={loading}
              >
                {loading ? "กำลังยกเลิก..." : "ยืนยันยกเลิก"}
              </button>
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
        style={{ background: "#FFF8F4", border: "1.5px dashed #E8D8CC" }}
      >
        <CardIcon className="w-8 h-8 flex-shrink-0" style={{ color: "#D6BCAE" }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium" style={{ color: "#3B2A24" }}>ยังไม่มีสมาชิกหรือแพ็กเกจ</p>
          <p className="text-xs mt-0.5" style={{ color: "#A08070" }}>สมัครเพื่อรับสิทธิประโยชน์ — เริ่มต้น ฿990</p>
        </div>
        <a
          href="/liff/membership/signup"
          className="flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold text-white"
          style={{ background: "#8B1D24" }}
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

function MembershipCard({ m }: { m: MembershipStatus }) {
  const isActive = !m.isExpired && !m.isUsagesExhausted;
  const expiresDate = m.expiresAt
    ? new Date(m.expiresAt).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })
    : null;
  const usagesLeft = m.usagesAllowed > 0
    ? Math.max(0, m.usagesAllowed - m.usagesUsed)
    : null;

  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: isActive ? "#ECFDF5" : "#FEF2F2",
        border: `1.5px solid ${isActive ? "#BBF7D0" : "#FECACA"}`,
      }}
    >
      <div className="flex items-center gap-3">
        <UserCheck className="w-8 h-8 flex-shrink-0" style={{ color: isActive ? "#059669" : "#DC2626" }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold" style={{ color: isActive ? "#065F46" : "#991B1B" }}>
              {m.label}
            </p>
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={isActive
                ? { background: "#D1FAE5", color: "#065F46" }
                : { background: "#FEE2E2", color: "#991B1B" }
              }
            >
              {m.isExpired ? "หมดอายุ" : m.isUsagesExhausted ? "ใช้ครบแล้ว" : "ใช้งานได้"}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs flex-wrap" style={{ color: isActive ? "#059669" : "#DC2626" }}>
            {expiresDate && <span>หมดอายุ {expiresDate}</span>}
            {!expiresDate && <span>ไม่หมดอายุ</span>}
            {usagesLeft !== null && (
              <span>· เหลือ {usagesLeft}/{m.usagesAllowed} ครั้ง</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PackageCard({ pkg }: { pkg: ActivePackage }) {
  const expiresDate = new Date(pkg.expiresAt).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
  const daysLeft = Math.max(0, Math.ceil((new Date(pkg.expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: "#EFF6FF", border: "1.5px solid #BFDBFE" }}
    >
      <div className="flex items-center gap-3">
        <PackageIcon className="w-8 h-8 flex-shrink-0" style={{ color: "#2563EB" }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold" style={{ color: "#1E3A8A" }}>{pkg.nameTh}</p>
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: "#DBEAFE", color: "#1E40AF" }}
            >
              ใช้งานได้
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs flex-wrap" style={{ color: "#2563EB" }}>
            <span>เหลือ {daysLeft} วัน · หมดอายุ {expiresDate}</span>
            {pkg.usagesLeft !== null ? (
              <span>· เหลือ {pkg.usagesLeft}/{pkg.usageLimit} ครั้ง</span>
            ) : (
              <span>· ใช้แล้ว {pkg.usagesUsed} ครั้ง (ไม่จำกัด)</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Header ────────────────────────────────────────────────────────────────────
function Header({ rightSlot }: { rightSlot?: React.ReactNode }) {
  return (
    <nav className="px-6 py-3 flex items-center justify-between" style={{ backgroundColor: "#8B1D24" }}>
      <div className="flex items-center gap-3">
        <Link href="/" className="text-white/80 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <BrandLogo light size="md" />
      </div>
      {rightSlot}
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
        <h2 className="text-base font-semibold" style={{ color: "#3B2A24" }}>{title}</h2>
        <p className="text-xs" style={{ color: "#A08070" }}>{subtitle}</p>
      </div>
      {hasChildren ? (
        <div className="space-y-3">{children}</div>
      ) : empty ? (
        <p className="text-sm py-4 text-center rounded-xl bg-white"
          style={{ color: "#A08070", border: "1px dashed #E8D8CC" }}>
          {empty}
        </p>
      ) : null}
    </section>
  );
}

// ── Booking card ──────────────────────────────────────────────────────────────
function BookingCard({
  booking, onEdit, onCancel, showActions,
}: { booking: Booking; onEdit?: () => void; onCancel?: () => void; showActions: boolean }) {
  const style = STATUS_STYLE[booking.status];
  return (
    <div className="rounded-2xl bg-white p-5" style={{ border: "1.5px solid #E8D8CC" }}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold mb-0.5" style={{ color: "#3B2A24" }}>
            {booking.service.nameTh || booking.service.name}
          </h3>
          <p className="text-xs" style={{ color: "#A08070" }}>{booking.service.category}</p>
        </div>
        <span className="text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap"
          style={{ background: style.bg, color: style.fg }}>
          {STATUS_TH[booking.status]}
        </span>
      </div>

      <div className="space-y-1.5 text-sm" style={{ color: "#5C4A42" }}>
        <p className="flex items-center gap-2">
          <MapPin className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#D6BCAE" }} />
          {booking.branch.name}
        </p>
        <p className="flex items-center gap-2">
          <CalendarIcon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#D6BCAE" }} />
          {formatDate(booking.date)}
        </p>
        <p className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#D6BCAE" }} />
          {booking.startTime} — {booking.endTime} น.
        </p>
      </div>

      {showActions && (
        <div className="flex gap-2 mt-4">
          <button
            onClick={onEdit}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium border-2 transition-colors"
            style={{ borderColor: "#8B1D24", color: "#8B1D24", background: "white" }}
          >
            <Edit3 className="w-3.5 h-3.5" />
            เปลี่ยนแปลง
          </button>
          <button
            onClick={onCancel}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium border-2 transition-colors"
            style={{ borderColor: "#FECACA", color: "#DC2626", background: "white" }}
          >
            <Trash2 className="w-3.5 h-3.5" />
            ยกเลิก
          </button>
        </div>
      )}
    </div>
  );
}

// ── Reschedule modal ──────────────────────────────────────────────────────────
function RescheduleModal({
  booking, branches, lineUserId, onClose, onSaved,
}: {
  booking: Booking;
  branches: Branch[];
  lineUserId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [branchId,   setBranchId]   = useState(booking.branchId);
  const [date,       setDate]       = useState<Date>(new Date(booking.date));
  const [startTime,  setStartTime]  = useState(booking.startTime);
  const [duration,   setDuration]   = useState<number | null>(null);
  const [takenSlots, setTakenSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState("");

  // Look up duration from BranchService for the chosen branch + this service
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/services?branchId=${encodeURIComponent(branchId)}`);
        if (!res.ok) throw new Error();
        const services: { serviceId: string; duration: number }[] = await res.json();
        if (cancelled) return;
        const match = services.find((s) => s.serviceId === booking.serviceId);
        setDuration(match ? match.duration : null);
        if (!match) setError("สาขานี้ไม่มีบริการนี้");
        else setError("");
      } catch {
        if (!cancelled) setDuration(null);
      }
    })();
    return () => { cancelled = true; };
  }, [branchId, booking.serviceId]);

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
        body: JSON.stringify({ lineUserId, branchId, date: localDate, startTime }),
      });
      if (res.status === 409) {
        setError("เวลาที่เลือกถูกจองแล้ว กรุณาเลือกเวลาอื่น");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "เกิดข้อผิดพลาด กรุณาลองใหม่");
        return;
      }
      onSaved();
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
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
        <div className="sticky top-0 bg-white px-6 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid #F0E4D8" }}>
          <div>
            <h3 className="text-base font-semibold" style={{ color: "#3B2A24" }}>เปลี่ยนแปลงการจอง</h3>
            <p className="text-xs" style={{ color: "#A08070" }}>{booking.service.nameTh || booking.service.name}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-stone-100">
            <X className="w-5 h-5" style={{ color: "#6B5245" }} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Branch */}
          <div>
            <label className="text-sm font-medium mb-2 block" style={{ color: "#5C4A42" }}>สาขา</label>
            <div className="space-y-2">
              {branches.map((b) => {
                const selected = branchId === b.id;
                return (
                  <button
                    key={b.id}
                    onClick={() => setBranchId(b.id)}
                    className="w-full text-left p-3 rounded-xl border-2 transition-colors"
                    style={{
                      borderColor: selected ? "#8B1D24" : "#E8D8CC",
                      background:  selected ? "#FFF8F4" : "white",
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium" style={{ color: "#3B2A24" }}>{b.name}</p>
                        <p className="text-xs truncate" style={{ color: "#A08070" }}>{b.address}</p>
                      </div>
                      {selected && <Check className="w-4 h-4 flex-shrink-0" style={{ color: "#8B1D24" }} />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="text-sm font-medium mb-2 block" style={{ color: "#5C4A42" }}>วันที่</label>
            <div className="rounded-xl border" style={{ borderColor: "#E8D8CC" }}>
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
            <label className="text-sm font-medium mb-2 block" style={{ color: "#5C4A42" }}>เวลา</label>
            {loadingSlots ? (
              <p className="text-sm text-center py-4" style={{ color: "#A08070" }}>กำลังโหลด...</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {ALL_SLOTS.map((t) => {
                  const isTaken = takenSlots.includes(t) && t !== booking.startTime; // own current slot is fine
                  const isSelected = startTime === t;
                  return (
                    <button
                      key={t}
                      onClick={() => !isTaken && setStartTime(t)}
                      disabled={isTaken}
                      className="py-2 rounded-lg text-sm border-2 transition-all"
                      style={
                        isTaken
                          ? { background: "#F5F0EC", borderColor: "#E8D8CC", color: "#C4B0A4", cursor: "not-allowed" }
                          : isSelected
                          ? { background: "#8B1D24", borderColor: "#8B1D24", color: "white", fontWeight: 500 }
                          : { background: "white", borderColor: "#E8D8CC", color: "#5C4A42" }
                      }
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {error && (
            <p className="text-sm flex items-center gap-2 p-3 rounded-xl" style={{ color: "#991B1B", background: "#FEE2E2" }}>
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </p>
          )}
        </div>

        <div className="sticky bottom-0 bg-white px-6 py-4 flex gap-2" style={{ borderTop: "1px solid #F0E4D8" }}>
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl text-sm font-medium border-2"
            style={{ borderColor: "#D6BCAE", color: "#6B5245" }}
            disabled={saving}
          >
            ยกเลิก
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !duration}
            className="flex-1 py-3 rounded-xl text-sm font-medium text-white disabled:opacity-50"
            style={{ background: "#8B1D24" }}
          >
            {saving ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}
          </button>
        </div>
      </div>
    </div>
  );
}
