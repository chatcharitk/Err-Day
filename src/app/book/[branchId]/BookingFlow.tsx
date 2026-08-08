"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Clock, AlertCircle, Star, Ban, LogOut, Sparkles } from "lucide-react";
import { useLiff } from "@/hooks/useLiff";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { useLang } from "@/components/LanguageProvider";
import { DAVINES_SPA_PROMOTION, getPromotionServicePrice, isDavinesSpaPromotionDay } from "@/lib/promotions";
import type { Branch, Service, BranchService, ServiceAddon } from "@/generated/prisma/client";

type BranchServiceWithService = BranchService & { service: Service };

interface Props {
  branch: Branch;
  branchServices: BranchServiceWithService[];
  addons: ServiceAddon[];
}

const LINE_SVG = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
    <path d="M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
  </svg>
);

// Hair colour is a long service — restrict to a sensible window regardless of branch hours
const HAIR_COLOR_SLOTS = ["11:00","11:30","12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00"];

/**
 * Generate 30-minute slots from openTime up to (closeTime - 30 min).
 * Both params are "HH:mm" strings.  Example: "08:00","21:00" → 08:00 … 20:30
 */
function generateTimeSlots(openTime: string, closeTime: string): string[] {
  const [oh, om] = openTime.split(":").map(Number);
  const [ch, cm] = closeTime.split(":").map(Number);
  const openMin  = oh * 60 + om;
  const closeMin = ch * 60 + cm;
  const slots: string[] = [];
  for (let t = openMin; t <= closeMin - 30; t += 30) {
    slots.push(
      `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`
    );
  }
  return slots;
}

function formatPrice(satang: number) {
  return `฿${(satang / 100).toLocaleString()}`;
}

/** Effective member price for a service (null = no member discount configured). */
function computeMemberPrice(
  svc: { memberPrice: number | null; memberDiscountPercent: number },
  branchPrice: number,
): number | null {
  if (svc.memberPrice != null && svc.memberPrice > 0) return svc.memberPrice;
  if (svc.memberDiscountPercent) return Math.round(branchPrice * (1 - svc.memberDiscountPercent / 100));
  return null;
}

/** Whether a phone belongs to an active (non-expired, non-pending, not-used-up) member. */
async function fetchIsMember(phone: string): Promise<boolean> {
  const p = phone.trim();
  if (p.length < 8) return false;
  try {
    const r = await fetch(`/api/membership?phone=${encodeURIComponent(p)}`);
    if (!r.ok) return false;
    const data = await r.json();
    const m = data?.membership;
    if (!m) return false;
    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    const expired = m.expiresAt && new Date(m.expiresAt) < today;
    const usedUp  = m.usagesAllowed > 0 && m.usagesUsed >= m.usagesAllowed;
    return !expired && !usedUp && !m.pendingActivation;
  } catch {
    return false;
  }
}

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * Bookable categories, in customer-facing display order. This is an ALLOWLIST,
 * not just a sort: line ~254 filters the service list to these, which is what
 * keeps the sale-only SKUs (Membership, แพ็กเกจ — sold at the counter, not chair
 * time) out of the booking flow.
 *
 * Consequence to remember: a new service group created in the admin UI shows up
 * on the admin services page automatically (that page derives its headings from
 * distinct Service.category) but stays INVISIBLE to customers until it is added
 * here. Adding a group is therefore not yet a pure data change.
 */
const CATEGORY_ORDER = ["บริการทั่วไป", "Davines Spa", "Keratin Treatment", "ย้อมผม NIGAO"];

const CAT_EN: Record<string, string> = {
  "บริการทั่วไป":  "General Services",
  "Davines Spa":   "Davines Spa",
  "Keratin Treatment": "Keratin Treatment",
  "ย้อมผม NIGAO": "NIGAO Color",
};

const UI = {
  th: {
    steps: ["บริการ", "บริการเสริม", "วันเวลา", "ข้อมูล", "ยืนยัน"],
    lineStatus:    "เชื่อมต่อ LINE แล้ว",
    lineLogin:     "เข้าสู่ระบบ LINE",
    lineLogout:    "ออกจากระบบ",
    bookLabel: "จองคิว",
    chooseService: "เลือกบริการ", chooseServiceSub: "Choose a Service",
    chooseServiceHint: "เลือกบริการที่ต้องการ",
    addons: "บริการเสริม", addonsSub: "Add-Ons",
    addonsHint: "เลือกบริการเสริมเพิ่มเติม (ไม่บังคับ)",
    noAddons: "ไม่ต้องการบริการเสริม",
    noAddonsSub: "No add-ons",
    addonsTotal: "เพิ่มบริการเสริม",
    chooseStaff: "เลือกช่างผม", chooseStaffSub: "Choose a Stylist",
    chooseStaffHint: "ไม่บังคับ — หรือให้เราเลือกช่างที่เหมาะสมให้คุณ",
    anyStaff: "ช่างที่ว่างในขณะนั้น",
    anyStaffSub: "ระบบจะจับคู่ช่างที่เหมาะสมที่สุดให้คุณ",
    dateTime: "เลือกวันและเวลา", dateTimeSub: "Date & Time",
    hairColorNotice: "ย้อมผมให้บริการเฉพาะ 11:00–16:00 น.",
    availableSlots: "เวลาที่ว่าง",
    slotTaken: "จอง",
    loadingSlots: "กำลังโหลด...",
    details: "ข้อมูลของคุณ", detailsSub: "Your Details",
    name: "ชื่อ-นามสกุล", namePh: "ชื่อของคุณ",
    phone: "เบอร์โทรศัพท์",
    email: "อีเมล", optional: "(ไม่บังคับ)",
    notes: "หมายเหตุ", notesPh: "แจ้งความต้องการพิเศษหรือข้อมูลเพิ่มเติม...",
    confirm: "ยืนยันการจอง", confirmSub: "Confirm Booking",
    branch: "สาขา", service: "บริการ", stylist: "ช่างผม",
    date: "วันที่", time: "เวลา", duration: "ระยะเวลา",
    minutes: "นาที", total: "ยอดรวม",
    submitBtn: "ยืนยันการจอง",
    submitting: "กำลังจอง...",
    terms: "การจองถือว่าคุณยอมรับนโยบายการยกเลิกของเรา",
    back: "ย้อนกลับ", next: "ถัดไป", review: "ตรวจสอบการจอง",
    memberPrice: "ราคาสมาชิก",
    nigaoTitle: "ราคาบริการทำสีผมอาจมีการเปลี่ยนแปลง โดยช่างจะประเมินจากความยาวและสภาพเส้นผมจริงที่หน้าร้านก่อนให้บริการ",
    errorConflict: "เวลาที่เลือกถูกจองแล้ว กรุณาเลือกเวลาอื่น",
    errorGeneral: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง",
  },
  en: {
    steps: ["Service", "Add-Ons", "Date & Time", "Details", "Confirm"],
    lineStatus:    "Connected with LINE",
    lineLogin:     "Sign in with LINE",
    lineLogout:    "Sign out",
    bookLabel: "Book",
    chooseService: "Select a Service", chooseServiceSub: "เลือกบริการ",
    chooseServiceHint: "Choose the service you want",
    addons: "Add-Ons", addonsSub: "บริการเสริม",
    addonsHint: "Optional extras for your appointment",
    noAddons: "No add-ons",
    noAddonsSub: "ไม่ต้องการ",
    addonsTotal: "Add-ons",
    chooseStaff: "Choose a Stylist", chooseStaffSub: "เลือกช่างผม",
    chooseStaffHint: "Optional — or let us pick the best stylist for you",
    anyStaff: "Any Available Stylist",
    anyStaffSub: "We'll match you with the best available stylist",
    dateTime: "Date & Time", dateTimeSub: "เลือกวันและเวลา",
    hairColorNotice: "Hair color services available 11:00–16:00 only",
    availableSlots: "Available Times",
    slotTaken: "Taken",
    loadingSlots: "Loading...",
    details: "Your Details", detailsSub: "ข้อมูลของคุณ",
    name: "Full Name", namePh: "Your name",
    phone: "Phone Number",
    email: "Email", optional: "(optional)",
    notes: "Notes", notesPh: "Any special requests or additional info...",
    confirm: "Confirm Booking", confirmSub: "ยืนยันการจอง",
    branch: "Branch", service: "Service", stylist: "Stylist",
    date: "Date", time: "Time", duration: "Duration",
    minutes: "min", total: "Total",
    submitBtn: "Confirm Booking",
    submitting: "Booking...",
    terms: "By booking you agree to our cancellation policy",
    back: "Back", next: "Next", review: "Review Booking",
    memberPrice: "Member price",
    nigaoTitle: "Hair color pricing may change — your stylist will assess your actual hair length and condition in-store before service.",
    errorConflict: "That time slot is already taken. Please choose another.",
    errorGeneral: "Something went wrong. Please try again.",
  },
};

export default function BookingFlow({ branch, branchServices, addons }: Props) {
  const router = useRouter();
  const { lang, toggle } = useLang();
  const u = UI[lang];
  const liff = useLiff();

  const STORAGE_KEY = `booking_state_${branch.id}`;

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [selectedService, setSelectedService] = useState<BranchServiceWithService | null>(null);
  const [selectedAddons, setSelectedAddons] = useState<Set<string>>(new Set());
  const [noAddons, setNoAddons] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState("");
  const [takenSlots, setTakenSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [form, setForm] = useState<{ name: string; phone: string; email: string; notes: string; nickname: string }>(
    { name: "", phone: "", email: "", notes: "", nickname: "" }
  );
  const [lineName, setLineName] = useState("");

  // Restore booking state after Line LIFF login redirect (runs client-side only)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      sessionStorage.removeItem(STORAGE_KEY);
      const s = JSON.parse(raw);
      if (s.step      !== undefined) setStep(s.step);
      if (s.serviceId) setSelectedService(branchServices.find(bs => bs.id === s.serviceId) ?? null);
      if (s.date)      setSelectedDate(new Date(s.date));
      if (s.time)      setSelectedTime(s.time);
      if (s.addonIds)  setSelectedAddons(new Set(s.addonIds));
      if (s.noAddons)  setNoAddons(s.noAddons);
      if (s.form)      setForm(s.form);
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Store LINE display name separately; look up returning customer for pre-fill
  useEffect(() => {
    if (!liff.profile) return;

    // Store LINE name for reference — do NOT auto-fill the booking name field
    setLineName(liff.profile.displayName || "");
    setForm(f => ({
      ...f,
      email: f.email || liff.profile!.email || "",
    }));

    // Look up by LINE user ID — if they've booked before, pre-fill phone + nickname
    const uid = liff.profile.userId;
    if (!uid) return;
    fetch(`/api/customer/me?lineUserId=${encodeURIComponent(uid)}`)
      .then(r => r.json())
      .then((customer: { name: string; nickname: string | null; phone: string; email: string | null } | null) => {
        if (!customer) return;
        setForm(f => ({
          ...f,
          name:     f.name     || customer.name,
          nickname: f.nickname || customer.nickname || "",
          phone:    f.phone    || customer.phone,
          email:    f.email    || customer.email || "",
        }));
      })
      .catch(() => {});
  }, [liff.profile]);

  const promoService = branchServices.find((bs) => bs.serviceId === DAVINES_SPA_PROMOTION.serviceId);
  const todayKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}`;
  const showPromotion = !!promoService && todayKey <= DAVINES_SPA_PROMOTION.endsOn;
  // While the campaign is shown, its own campaign card is the single place to
  // select this service. Keeping the catalogue row as well makes it look like
  // two separate services and is confusing on a phone.
  const visibleBranchServices = showPromotion
    ? branchServices.filter((bs) => bs.serviceId !== DAVINES_SPA_PROMOTION.serviceId)
    : branchServices;
  const categories = CATEGORY_ORDER.filter((c) => visibleBranchServices.some((bs) => bs.service.category === c));

  // Collapsible categories — all open by default
  const [openCats, setOpenCats] = useState<Set<string>>(() => new Set(CATEGORY_ORDER));
  const toggleCat = useCallback((cat: string) => {
    setOpenCats(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  }, []);
  const choosePromotion = () => {
    if (!promoService) return;
    setSelectedService(promoService);
    setOpenCats((prev) => new Set(prev).add(promoService.service.category));
  };
  const isHairColor = selectedService?.service.advanceBookingRequired ?? false;

  // Build the slot list for the selected day.
  // Sunday (0) opens at 10:00; Mon–Sat open at branch.openTime (default 08:00).
  // branch-bangna is open 07:00–21:00 every day, Sunday included — no 10:00 floor there.
  // We stop offering new bookings 30 min before branch.closeTime so the last
  // appointment finishes with some buffer. For a 21:00-close branch, that
  // means the last bookable slot is 20:00 (not 20:30).
  const timeSlots = useMemo(() => {
    if (isHairColor) return HAIR_COLOR_SLOTS;
    const isSunday   = selectedDate ? selectedDate.getDay() === 0 : false;
    const openTime   = isSunday && branch.id !== "branch-bangna" ? "10:00" : (branch.openTime  ?? "08:00");
    const closeTime  = branch.closeTime ?? "21:00";
    const lastClose  = addMinutes(closeTime, -30);
    return generateTimeSlots(openTime, lastClose);
  }, [isHairColor, selectedDate, branch.id, branch.openTime, branch.closeTime]);

  // Fetch availability when date, staff, or service changes
  useEffect(() => {
    if (!selectedDate || !selectedService) return;
    setLoadingSlots(true);
    setTakenSlots([]);
    const localDate = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth()+1).padStart(2,"0")}-${String(selectedDate.getDate()).padStart(2,"0")}`;
    const params = new URLSearchParams({
      branchId: branch.id,
      date: localDate,
      duration: String(selectedService.duration),
    });
    fetch(`/api/availability?${params}`)
      .then((r) => r.json())
      .then((data) => setTakenSlots(data.taken ?? []))
      .catch(() => {})
      .finally(() => setLoadingSlots(false));
  }, [selectedDate, selectedService?.duration, branch.id]);

  const toggleAddon = (id: string) => {
    setNoAddons(false);
    setSelectedAddons((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleNoAddons = () => {
    setNoAddons(true);
    setSelectedAddons(new Set());
  };

  const selectedAddonItems = addons.filter((a) => selectedAddons.has(a.id));
  const addonsTotal = selectedAddonItems.reduce((sum, a) => sum + a.price, 0);

  const canProceed = () => {
    if (step === 0) return !!selectedService;
    if (step === 2) return !!selectedDate && !!selectedTime;
    if (step === 3) return form.name.trim() !== "" && form.phone.trim() !== "";
    return true;
  };

  const handleSubmit = async () => {
    if (!selectedService || !selectedDate || !selectedTime) return;
    setLoading(true);
    setError("");

    try {
      // Resolve member pricing authoritatively before storing. A member must be
      // charged the member price from the start — otherwise the booking is saved at
      // full price and the LINE group notification (which fires on create and reads
      // the stored totalPrice) reports the wrong amount. Checked at submit so it's
      // race-free regardless of when the phone was entered.
      const memberPrice = computeMemberPrice(selectedService.service, selectedService.price);
      const isMember = await fetchIsMember(form.phone);
      const promotionalPrice = getPromotionServicePrice(
        selectedService.serviceId,
        selectedDate,
        isMember,
      );
      const servicePrice = promotionalPrice ?? (
        memberPrice != null && memberPrice < selectedService.price && isMember
          ? memberPrice
          : selectedService.price
      );
      const totalPrice = servicePrice + addonsTotal;

      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: branch.id,
          serviceId: selectedService.serviceId,
          staffId: null,
          date: `${selectedDate.getFullYear()}-${String(selectedDate.getMonth()+1).padStart(2,"0")}-${String(selectedDate.getDate()).padStart(2,"0")}`,
          startTime: selectedTime,
          endTime: addMinutes(selectedTime, selectedService.duration),
          totalPrice,
          addonIds: [...selectedAddons],
          name: form.name,
          nickname: form.nickname || null,
          phone: form.phone,
          email: form.email || null,
          notes: form.notes || null,
          lineUserId:       liff.profile?.userId      || null,
          linePictureUrl:   liff.profile?.pictureUrl  || null,
          lineDisplayName:  lineName || null,
        }),
      });

      if (res.status === 409) {
        setError(u.errorConflict);
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error();
      const booking = await res.json();
      router.push(`/confirm/${booking.id}`);
    } catch {
      setError(u.errorGeneral);
      setLoading(false);
    }
  };

  const LIFF_URL = `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID ?? ""}`;

  const handleLineLogin = () => {
    const isMobile = typeof navigator !== "undefined"
      && /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile) {
      window.location.href = LIFF_URL;
    } else {
      liff.login();
    }
  };

  const handleLineLogout = () => {
    liff.logout();
    // Send user back to /book so the login prompt there can re-appear
    router.replace("/book");
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#FFF8FA" }}>
      {/* Top bar */}
      <div className="bg-white border-b px-6 py-4" style={{ borderColor: "#DBA8B8" }}>
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link href="/book" className="transition-colors" style={{ color: "#70545F" }}>
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <p className="text-xs uppercase tracking-widest" style={{ color: "#DBA8B8" }}>{u.bookLabel}</p>
            <h1 className="text-base font-medium" style={{ color: "#49333B" }}>{branch.name}</h1>
          </div>
          {/* Language toggle */}
          <button
            onClick={toggle}
            className="text-xs font-medium px-3 py-1 rounded-full border-2 transition-colors"
            style={{ borderColor: "#DBA8B8", color: "#70545F" }}
          >
            {lang === "th" ? "EN" : "TH"}
          </button>
        </div>
      </div>

      {/* Persistent LINE status bar */}
      {liff.ready && (
        <div className="border-b" style={{
          background:  liff.isLoggedIn ? "#F0FFF4" : "#FFFAFB",
          borderColor: liff.isLoggedIn ? "#BBF7D0" : "#F3E2E8",
        }}>
          <div className="max-w-2xl mx-auto px-6 py-2 flex items-center gap-3">
            {liff.isLoggedIn && liff.profile ? (
              <>
                {liff.profile.pictureUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={liff.profile.pictureUrl} alt="" className="w-7 h-7 rounded-full flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" style={{ color: "#166534" }}>
                    {liff.profile.displayName}
                  </p>
                  <p className="text-[10px] leading-tight" style={{ color: "#15803D" }}>
                    {u.lineStatus} ✓
                  </p>
                </div>
                {!liff.isInClient && (
                  <button
                    onClick={handleLineLogout}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full transition-colors hover:bg-white"
                    style={{ color: "#166534", border: "1px solid #BBF7D0" }}
                  >
                    <LogOut className="w-3 h-3" />
                    {u.lineLogout}
                  </button>
                )}
              </>
            ) : (
              <>
                <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#06C755" }}>
                  {LINE_SVG}
                </div>
                <p className="flex-1 text-xs" style={{ color: "#70545F" }}>
                  {lang === "th" ? "ยังไม่ได้เข้าสู่ระบบ LINE" : "Not signed in with LINE"}
                </p>
                <button
                  onClick={handleLineLogin}
                  className="text-xs font-medium px-3 py-1.5 rounded-full text-white transition-opacity hover:opacity-90"
                  style={{ background: "#06C755" }}
                >
                  {u.lineLogin}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Step indicator */}
      <div className="bg-white border-b" style={{ borderColor: "#F3E2E8" }}>
        <div className="max-w-2xl mx-auto px-6 py-3 flex gap-1">
          {u.steps.map((label, i) => (
            <div key={label} className="flex items-center gap-1 flex-1 min-w-0">
              <div
                className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-medium"
                style={
                  i < step
                    ? { backgroundColor: "#B7355A", color: "white" }
                    : i === step
                    ? { backgroundColor: "#B7355A", color: "white", outline: "2px solid #DBA8B8", outlineOffset: "2px" }
                    : { backgroundColor: "#F3E2E8", color: "#987783" }
                }
              >
                {i < step ? <Check className="w-3 h-3" /> : i + 1}
              </div>
              <span
                className="text-xs truncate hidden sm:block"
                style={{ color: i === step ? "#49333B" : "#987783", fontWeight: i === step ? 500 : 400 }}
              >
                {label}
              </span>
              {i < u.steps.length - 1 && <div className="flex-1 h-px mx-1" style={{ backgroundColor: "#EFD9E1" }} />}
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8">

        {/* ── Step 0: Service selection ── */}
        {step === 0 && (
          <div>
            <h2 className="text-xl font-medium mb-1" style={{ color: "#49333B" }}>
              {u.chooseService} <span className="text-base font-light" style={{ color: "#987783" }}>/ {u.chooseServiceSub}</span>
            </h2>
            <p className="text-sm mb-6" style={{ color: "#987783" }}>{u.chooseServiceHint}</p>

            {showPromotion && promoService && (
              <section
                className="relative overflow-hidden rounded-2xl p-5 mb-7 text-white shadow-lg border-2"
                style={{
                  background: "linear-gradient(135deg, #70151C 0%, #B4232A 52%, #E15345 100%)",
                  borderColor: selectedService?.id === promoService.id ? "#FFD66B" : "transparent",
                }}
              >
                <div className="absolute -right-8 -top-12 w-44 h-44 rounded-full opacity-20 border-[28px] border-white" />
                <div className="relative">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wide" style={{ backgroundColor: "rgba(255,255,255,0.18)" }}>
                    <Sparkles className="w-3.5 h-3.5" /> 3 วันเท่านั้น · 7–9 สิงหาคม 2569
                  </div>
                  <p className="mt-3 text-xl font-semibold leading-tight">Premium Davines Spa<br />Full Course</p>
                  <p className="mt-1 text-sm" style={{ color: "#FFE4DB" }}>สครับหนังศีรษะ · ทรีทเมนต์ · อบไอน้ำ · นวดผ่อนคลาย · ไดร์ Dyson</p>

                  <div className="flex items-end gap-5 mt-5">
                    <div>
                      <p className="text-xs" style={{ color: "#FFE4DB" }}>ลูกค้าทั่วไป <span className="line-through opacity-75">฿890</span></p>
                      <p className="text-4xl font-bold leading-none">฿788</p>
                    </div>
                    <div className="pb-0.5 border-l pl-5" style={{ borderColor: "rgba(255,255,255,0.35)" }}>
                      <p className="text-xs" style={{ color: "#FFE4DB" }}>พิเศษสำหรับสมาชิก</p>
                      <p className="text-2xl font-bold leading-none">฿688</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={choosePromotion}
                    className="mt-5 w-full rounded-xl py-3 text-sm font-semibold transition-transform active:scale-[0.98]"
                    style={selectedService?.id === promoService.id
                      ? { backgroundColor: "#FFE08A", color: "#5A1519" }
                      : { backgroundColor: "white", color: "#B7355A" }}
                  >
                    {selectedService?.id === promoService.id ? "✓ เลือกโปรโมชั่นนี้แล้ว" : "เลือกโปรโมชั่นนี้"}
                  </button>
                  <p className="mt-2 text-center text-[11px]" style={{ color: "#FFE4DB" }}>ใช้สิทธิ์ได้เฉพาะคิววันที่ 7, 8 และ 9 สิงหาคม · ไม่ร่วมกับส่วนลดอื่น</p>
                </div>
              </section>
            )}

            {categories.map((cat) => {
              const isOpen = openCats.has(cat);
              const catLabel = lang === "th" ? cat : (CAT_EN[cat] ?? cat);
              const hasSelectedInCat = visibleBranchServices
                .filter(bs => bs.service.category === cat)
                .some(bs => selectedService?.id === bs.id);
              return (
                <div key={cat} className="mb-4">
                  {/* Collapsible header */}
                  <button
                    type="button"
                    onClick={() => toggleCat(cat)}
                    className="w-full flex items-center gap-2 mb-2 py-1"
                  >
                    <div className="h-px flex-1" style={{ backgroundColor: "#DBA8B8" }} />
                    <p className="text-xs font-semibold uppercase tracking-widest px-2 flex items-center gap-1.5" style={{ color: "#B7355A" }}>
                      {catLabel}
                      {hasSelectedInCat && !isOpen && (
                        <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: "#B7355A" }} />
                      )}
                    </p>
                    <div className="h-px flex-1" style={{ backgroundColor: "#DBA8B8" }} />
                    <span className="text-xs flex-shrink-0 ml-1" style={{ color: "#987783" }}>
                      {isOpen ? "▲" : "▼"}
                    </span>
                  </button>

                  {isOpen && (
                    <>
                      {cat === "ย้อมผม NIGAO" && (
                        <div className="flex items-start gap-2 p-3 rounded-lg mb-3 text-sm" style={{ backgroundColor: "#FFF0F4", borderLeft: "3px solid #B7355A" }}>
                          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#B7355A" }} />
                          <div style={{ color: "#5C4A42" }}>
                            <p className="text-xs">{u.nigaoTitle}</p>
                          </div>
                        </div>
                      )}

                      <div className="grid gap-3 mb-4">
                        {visibleBranchServices
                          .filter((bs) => bs.service.category === cat)
                          .map((bs) => {
                            const isSelected = selectedService?.id === bs.id;
                            const svcName = lang === "th" ? bs.service.nameTh : (bs.service.name || bs.service.nameTh);
                            const svcDesc = lang === "th"
                              ? bs.service.descriptionTh
                              : (bs.service.description || bs.service.descriptionTh);
                            return (
                              <button
                                key={bs.id}
                                onClick={() => setSelectedService(bs)}
                                className="w-full text-left p-4 rounded-xl border-2 transition-all"
                                style={isSelected
                                  ? { borderColor: "#B7355A", backgroundColor: "#B7355A", color: "white" }
                                  : { borderColor: "#EFD9E1", backgroundColor: "white", color: "#49333B" }}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1">
                                    <p className="font-medium">{svcName}</p>
                                    {svcDesc && (
                                      <p className="text-sm mt-1" style={{ color: isSelected ? "rgba(255,255,255,0.75)" : "#987783" }}>
                                        {svcDesc}
                                      </p>
                                    )}
                                    {bs.serviceId === DAVINES_SPA_PROMOTION.serviceId && (
                                      <p className="text-xs mt-1 font-medium" style={{ color: isSelected ? "#fff4d8" : "#B42318" }}>
                                        {DAVINES_SPA_PROMOTION.labelTh}: ฿788 · สมาชิก ฿688
                                      </p>
                                    )}
                                    {/*
                                      Via computeMemberPrice, not service.memberPrice directly: a
                                      service can express its member rate as a percentage instead of
                                      a fixed price, and reading the raw field silently hid the badge
                                      for those (the discount still applied at confirm — see the
                                      computeMemberPrice call in the submit path — so it was
                                      under-advertised rather than mischarged).
                                    */}
                                    {(() => {
                                      const memberPrice = computeMemberPrice(bs.service, bs.price);
                                      if (memberPrice == null || memberPrice >= bs.price) return null;
                                      return (
                                        <p className="text-xs mt-1 flex items-center gap-1" style={{ color: isSelected ? "rgba(255,255,255,0.7)" : "#B7355A" }}>
                                          <Star className="w-3 h-3" />
                                          {u.memberPrice} {formatPrice(memberPrice)}
                                        </p>
                                      );
                                    })()}
                                  </div>
                                  <div className="flex-shrink-0 text-right">
                                    {bs.serviceId === DAVINES_SPA_PROMOTION.serviceId && showPromotion ? (
                                      <>
                                        <p className="text-xs line-through" style={{ color: isSelected ? "rgba(255,255,255,0.65)" : "#987783" }}>{formatPrice(bs.price)}</p>
                                        <p className="font-semibold text-lg">฿788</p>
                                      </>
                                    ) : (
                                      <p className="font-semibold text-lg">{formatPrice(bs.price)}</p>
                                    )}
                                    <p className="text-xs flex items-center gap-1 justify-end mt-0.5" style={{ color: isSelected ? "rgba(255,255,255,0.6)" : "#987783" }}>
                                      <Clock className="w-3 h-3" /> {bs.duration} {u.minutes}
                                    </p>
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Step 1: Add-ons ── */}
        {step === 1 && (
          <div>
            <h2 className="text-xl font-medium mb-1" style={{ color: "#49333B" }}>
              {u.addons} <span className="text-base font-light" style={{ color: "#987783" }}>/ {u.addonsSub}</span>
            </h2>
            <p className="text-sm mb-6" style={{ color: "#987783" }}>{u.addonsHint}</p>
            <div className="grid gap-3">
              {/* None option */}
              <button
                onClick={handleNoAddons}
                className="w-full text-left p-4 rounded-xl border-2 transition-all flex items-center gap-3"
                style={noAddons
                  ? { borderColor: "#B7355A", backgroundColor: "#B7355A", color: "white" }
                  : { borderColor: "#EFD9E1", backgroundColor: "white" }}
              >
                <Ban className="w-4 h-4 flex-shrink-0" style={{ color: noAddons ? "white" : "#987783" }} />
                <div>
                  <p className="font-medium" style={{ color: noAddons ? "white" : "#49333B" }}>{u.noAddons}</p>
                  <p className="text-xs" style={{ color: noAddons ? "rgba(255,255,255,0.7)" : "#987783" }}>{u.noAddonsSub}</p>
                </div>
              </button>

              {addons.map((a) => {
                const isChecked = selectedAddons.has(a.id);
                return (
                  <button
                    key={a.id}
                    onClick={() => toggleAddon(a.id)}
                    className="w-full text-left p-4 rounded-xl border-2 transition-all flex items-center justify-between"
                    style={isChecked
                      ? { borderColor: "#B7355A", backgroundColor: "#FFF0F4" }
                      : { borderColor: "#EFD9E1", backgroundColor: "white" }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2"
                        style={isChecked
                          ? { backgroundColor: "#B7355A", borderColor: "#B7355A" }
                          : { borderColor: "#DBA8B8" }}
                      >
                        {isChecked && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <p className="font-medium" style={{ color: "#49333B" }}>
                        {lang === "th" ? a.nameTh : (a.name || a.nameTh)}
                      </p>
                    </div>
                    <p className="font-semibold" style={{ color: "#B7355A" }}>+{formatPrice(a.price)}</p>
                  </button>
                );
              })}
            </div>
            {selectedAddons.size > 0 && (
              <div className="mt-4 p-3 rounded-lg text-sm" style={{ backgroundColor: "#FFF0F4" }}>
                <p style={{ color: "#5C4A42" }}>{u.addonsTotal}: <span className="font-semibold">+{formatPrice(addonsTotal)}</span></p>
              </div>
            )}
          </div>
        )}

        {/* ── Step 2: Date & Time ── */}
        {step === 2 && (
          <div>
            <h2 className="text-xl font-medium mb-1" style={{ color: "#49333B" }}>
              {u.dateTime} <span className="text-base font-light" style={{ color: "#987783" }}>/ {u.dateTimeSub}</span>
            </h2>

            {/* Opening hours hint */}
            <p className="text-xs mb-3 flex items-center gap-1.5" style={{ color: "#987783" }}>
              <Clock className="w-3.5 h-3.5 flex-shrink-0" />
              {lang === "th"
                ? "จ–ส 08:00–21:00 · อา 10:00–21:00 (รับจองถึง 20:30)"
                : "Mon–Sat 08:00–21:00 · Sun 10:00–21:00 (last slot 20:30)"}
            </p>

            {isHairColor && (
              <p className="text-sm mb-4 flex items-center gap-1" style={{ color: "#B7355A" }}>
                <AlertCircle className="w-4 h-4" /> {u.hairColorNotice}
              </p>
            )}
            <div className="bg-white rounded-xl border p-4 mb-6 flex justify-center" style={{ borderColor: "#EFD9E1" }}>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => { setSelectedDate(d); setSelectedTime(""); }}
                disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                className="rounded-md"
              />
            </div>
            {selectedDate && (
              <div>
                <p className="text-sm font-medium mb-3" style={{ color: "#70545F" }}>
                  {loadingSlots ? u.loadingSlots : u.availableSlots}
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {timeSlots.map((t) => {
                    const isTaken = takenSlots.includes(t);
                    return (
                      <button
                        key={t}
                        onClick={() => !isTaken && setSelectedTime(t)}
                        disabled={isTaken || loadingSlots}
                        className="py-2 rounded-lg text-sm border-2 transition-all"
                        style={
                          isTaken
                            ? { backgroundColor: "#F5F0EC", borderColor: "#EFD9E1", color: "#C4B0A4", cursor: "not-allowed" }
                            : selectedTime === t
                            ? { backgroundColor: "#B7355A", borderColor: "#B7355A", color: "white", fontWeight: 500 }
                            : { backgroundColor: "white", borderColor: "#EFD9E1", color: "#5C4A42" }
                        }
                      >
                        {t}
                        {isTaken && <span className="block text-xs" style={{ color: "#C4B0A4" }}>{u.slotTaken}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Step 3: Customer details ── */}
        {step === 3 && (
          <div>
            <h2 className="text-xl font-medium mb-6" style={{ color: "#49333B" }}>
              {u.details} <span className="text-base font-light" style={{ color: "#987783" }}>/ {u.detailsSub}</span>
            </h2>

            {/* Logged-in profile card (only shown if user came in via Line) */}
            {liff.ready && liff.isLoggedIn && liff.profile && (
              <div className="mb-4 rounded-xl border p-4 flex items-center gap-3" style={{ borderColor: "#BBF7D0", background: "#F0FFF4" }}>
                {liff.profile.pictureUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={liff.profile.pictureUrl} alt="" className="w-9 h-9 rounded-full" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: "#49333B" }}>{liff.profile.displayName}</p>
                  <p className="text-xs" style={{ color: "#166534" }}>
                    {form.phone
                      ? (lang === "th" ? "ยินดีต้อนรับกลับ — กรอกข้อมูลให้แล้ว ✓" : "Welcome back — details pre-filled ✓")
                      : (lang === "th" ? "เข้าสู่ระบบด้วย LINE แล้ว" : "Signed in with LINE")}
                  </p>
                </div>
              </div>
            )}

            {lineName && (
              <div className="mb-3 rounded-xl border px-4 py-2.5 flex items-center gap-3" style={{ borderColor: "#BBF7D0", background: "#F0FFF4" }}>
                <span className="text-xs" style={{ color: "#166534" }}>
                  {lang === "th" ? "ชื่อ LINE:" : "LINE name:"}
                </span>
                <span className="text-sm font-medium" style={{ color: "#49333B" }}>{lineName}</span>
                <span className="text-xs ml-auto" style={{ color: "#A0A0A0" }}>
                  {lang === "th" ? "(เพื่อความถูกต้อง กรุณากรอกชื่อจริงด้านล่าง)" : "(please enter your real name below)"}
                </span>
              </div>
            )}
            <div className="bg-white rounded-xl border p-6 space-y-4" style={{ borderColor: "#EFD9E1" }}>
              <div className="space-y-1.5">
                <Label htmlFor="name" style={{ color: "#5C4A42" }}>{u.name} <span className="text-red-500">*</span></Label>
                <Input id="name" placeholder={u.namePh} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nickname" style={{ color: "#5C4A42" }}>
                  {lang === "th" ? "ชื่อเล่น" : "Nickname"}
                  <span className="text-sm font-normal ml-1" style={{ color: "#987783" }}>{u.optional}</span>
                </Label>
                <Input id="nickname" placeholder={lang === "th" ? "เช่น แอม, บิ๊ก" : "e.g. Aim, Big"} value={form.nickname} onChange={(e) => setForm((f) => ({ ...f, nickname: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone" style={{ color: "#5C4A42" }}>{u.phone} <span className="text-red-500">*</span></Label>
                <Input id="phone" type="tel" placeholder="08X-XXX-XXXX" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email" style={{ color: "#5C4A42" }}>{u.email} <span className="text-sm font-normal" style={{ color: "#987783" }}>{u.optional}</span></Label>
                <Input id="email" type="email" placeholder="you@email.com" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="notes" style={{ color: "#5C4A42" }}>{u.notes} <span className="text-sm font-normal" style={{ color: "#987783" }}>{u.optional}</span></Label>
                <Textarea id="notes" placeholder={u.notesPh} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={3} />
              </div>
            </div>
          </div>
        )}

        {/* ── Step 4: Confirm ── */}
        {step === 4 && selectedService && selectedDate && (
          <div>
            <h2 className="text-xl font-medium mb-6" style={{ color: "#49333B" }}>
              {u.confirm} <span className="text-base font-light" style={{ color: "#987783" }}>/ {u.confirmSub}</span>
            </h2>
            <Card className="mb-4" style={{ borderColor: "#EFD9E1" }}>
              <CardContent className="pt-6 space-y-3">
                {[
                  [u.branch, branch.name],
                  [u.service, lang === "th" ? selectedService.service.nameTh : (selectedService.service.name || selectedService.service.nameTh)],
                  [u.date, selectedDate.toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" })],
                  [u.time, `${selectedTime} — ${addMinutes(selectedTime, selectedService.duration)} น.`],
                  [u.duration, `${selectedService.duration} ${u.minutes}`],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between items-start">
                    <span className="text-sm" style={{ color: "#987783" }}>{label}</span>
                    <span className="text-sm font-medium text-right max-w-[60%]" style={{ color: "#49333B" }}>{value}</span>
                  </div>
                ))}

                {isDavinesSpaPromotionDay(selectedDate) && selectedService.serviceId === DAVINES_SPA_PROMOTION.serviceId && (
                  <div className="flex justify-between items-start">
                    <span className="text-sm" style={{ color: "#987783" }}>ราคาโปรโมชัน</span>
                    <span className="text-sm font-medium text-right" style={{ color: "#B7355A" }}>฿788 · สมาชิก ฿688</span>
                  </div>
                )}

                {selectedAddonItems.length > 0 && (
                  <>
                    <hr style={{ borderColor: "#F3E2E8" }} />
                    <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#B7355A" }}>{u.addons}</p>
                    {selectedAddonItems.map((a) => (
                      <div key={a.id} className="flex justify-between">
                        <span className="text-sm" style={{ color: "#5C4A42" }}>{lang === "th" ? a.nameTh : (a.name || a.nameTh)}</span>
                        <span className="text-sm" style={{ color: "#5C4A42" }}>+{formatPrice(a.price)}</span>
                      </div>
                    ))}
                  </>
                )}

                <hr style={{ borderColor: "#F3E2E8" }} />
                {[
                  [u.name, form.name],
                  [u.phone, form.phone],
                  ...(form.email ? [[u.email, form.email]] : []),
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-sm" style={{ color: "#987783" }}>{label}</span>
                    <span className="text-sm font-medium" style={{ color: "#49333B" }}>{value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full h-12 rounded-xl text-base font-medium text-white transition-opacity disabled:opacity-50"
              style={{ backgroundColor: "#B7355A" }}
            >
              {loading ? u.submitting : u.submitBtn}
            </button>
            <p className="text-center text-xs mt-3" style={{ color: "#987783" }}>
              {u.terms}
            </p>
          </div>
        )}

        {/* Navigation buttons */}
        {step < 4 && (
          <div className="flex gap-3 mt-8">
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep((s) => s - 1)} className="flex-1" style={{ borderColor: "#DBA8B8", color: "#70545F" }}>
                <ArrowLeft className="w-4 h-4 mr-2" /> {u.back}
              </Button>
            )}
            <button
              onClick={() => setStep((s) => s + 1)}
              disabled={!canProceed()}
              className="flex-1 h-8 rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-40 flex items-center justify-center gap-1"
              style={{ backgroundColor: "#B7355A" }}
            >
              {step === 3 ? u.review : u.next} <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Sticky summary strip */}
        {selectedService && step > 0 && step < 4 && (
          <div className="mt-6 p-4 rounded-xl flex items-center justify-between text-sm" style={{ backgroundColor: "#FFF0F4" }}>
            <div>
              <p className="font-medium" style={{ color: "#49333B" }}>{lang === "th" ? selectedService.service.nameTh : (selectedService.service.name || selectedService.service.nameTh)}</p>
              <p style={{ color: "#987783" }}>{selectedService.duration} {u.minutes}</p>
            </div>
            {selectedDate && selectedTime && (
              <Badge style={{ backgroundColor: "#B7355A", color: "white", border: "none" }}>
                {selectedDate.toLocaleDateString("th-TH", { day: "numeric", month: "short" })} {selectedTime}
              </Badge>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
