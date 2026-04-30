"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Clock, AlertCircle, Star, Ban, LogOut } from "lucide-react";
import { useLiff } from "@/hooks/useLiff";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { useLang } from "@/components/LanguageProvider";
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

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

const CATEGORY_ORDER = ["บริการทั่วไป", "Davines Spa", "ย้อมผม NIGAO"];

const CAT_EN: Record<string, string> = {
  "บริการทั่วไป":  "General Services",
  "Davines Spa":   "Davines Spa",
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
    nigaoTitle: "จองล่วงหน้าเท่านั้น — Advance booking required",
    nigaoLine2: "ให้บริการ 11:00–16:00 น. เฉพาะโทนธรรมชาติ ไม่รวมฟอก/ไฮไลท์ สูตรไม่มีแอมโมเนีย 100%",
    nigaoLine3: "สมาชิกลด 10% · ผมหนาพิเศษอาจมีค่าบริการเพิ่มเติม",
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
    nigaoTitle: "Advance booking required",
    nigaoLine2: "Available 11:00–16:00 only. Natural tones only — no bleach/highlights. 100% ammonia-free.",
    nigaoLine3: "Members save 10% · Extra charge may apply for thick/long hair",
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
  const [form, setForm] = useState<{ name: string; phone: string; email: string; notes: string }>(
    { name: "", phone: "", email: "", notes: "" }
  );

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

  // Auto-fill name & email from Line profile, then look up returning customer for phone
  useEffect(() => {
    if (!liff.profile) return;

    // Always fill name/email from LINE profile
    setForm(f => ({
      ...f,
      name:  f.name  || liff.profile!.displayName,
      email: f.email || liff.profile!.email || "",
    }));

    // Look up by LINE user ID — if they've booked before, pre-fill their phone too
    const uid = liff.profile.userId;
    if (!uid) return;
    fetch(`/api/customer/me?lineUserId=${encodeURIComponent(uid)}`)
      .then(r => r.json())
      .then((customer: { name: string; phone: string; email: string | null } | null) => {
        if (!customer) return;
        setForm(f => ({
          ...f,
          // Only overwrite if the field is still empty (don't stomp restored session state)
          name:  f.name  || customer.name,
          phone: f.phone || customer.phone,
          email: f.email || customer.email || "",
        }));
      })
      .catch(() => {});
  }, [liff.profile]);

  const categories = CATEGORY_ORDER.filter((c) => branchServices.some((bs) => bs.service.category === c));

  // Collapsible categories — all open by default
  const [openCats, setOpenCats] = useState<Set<string>>(() => new Set(CATEGORY_ORDER));
  const toggleCat = useCallback((cat: string) => {
    setOpenCats(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  }, []);
  const isHairColor = selectedService?.service.advanceBookingRequired ?? false;

  // Build the slot list for the selected day.
  // Sunday (0) opens at 10:00; Mon–Sat open at branch.openTime (default 08:00).
  // Last slot is always 30 min before branch.closeTime (default 21:00) → 20:30.
  const timeSlots = useMemo(() => {
    if (isHairColor) return HAIR_COLOR_SLOTS;
    const isSunday  = selectedDate ? selectedDate.getDay() === 0 : false;
    const openTime  = isSunday ? "10:00" : (branch.openTime  ?? "08:00");
    const closeTime = branch.closeTime ?? "21:00";
    return generateTimeSlots(openTime, closeTime);
  }, [isHairColor, selectedDate, branch.openTime, branch.closeTime]);

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
  const servicePrice = selectedService?.price ?? 0;
  const grandTotal = servicePrice + addonsTotal;

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
          totalPrice: grandTotal,
          addonIds: [...selectedAddons],
          name: form.name,
          phone: form.phone,
          email: form.email || null,
          notes: form.notes || null,
          lineUserId:     liff.profile?.userId     || null,
          linePictureUrl: liff.profile?.pictureUrl || null,
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
    <div className="min-h-screen" style={{ backgroundColor: "#FDF8F3" }}>
      {/* Top bar */}
      <div className="bg-white border-b px-6 py-4" style={{ borderColor: "#D6BCAE" }}>
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link href="/book" className="transition-colors" style={{ color: "#6B5245" }}>
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <p className="text-xs uppercase tracking-widest" style={{ color: "#D6BCAE" }}>{u.bookLabel}</p>
            <h1 className="text-base font-medium" style={{ color: "#3B2A24" }}>{branch.name}</h1>
          </div>
          {/* Language toggle */}
          <button
            onClick={toggle}
            className="text-xs font-medium px-3 py-1 rounded-full border-2 transition-colors"
            style={{ borderColor: "#D6BCAE", color: "#6B5245" }}
          >
            {lang === "th" ? "EN" : "TH"}
          </button>
        </div>
      </div>

      {/* Persistent LINE status bar */}
      {liff.ready && (
        <div className="border-b" style={{
          background:  liff.isLoggedIn ? "#F0FFF4" : "#FFF8F4",
          borderColor: liff.isLoggedIn ? "#BBF7D0" : "#F0E4D8",
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
                <p className="flex-1 text-xs" style={{ color: "#6B5245" }}>
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
      <div className="bg-white border-b" style={{ borderColor: "#F0E4D8" }}>
        <div className="max-w-2xl mx-auto px-6 py-3 flex gap-1">
          {u.steps.map((label, i) => (
            <div key={label} className="flex items-center gap-1 flex-1 min-w-0">
              <div
                className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-medium"
                style={
                  i < step
                    ? { backgroundColor: "#8B1D24", color: "white" }
                    : i === step
                    ? { backgroundColor: "#8B1D24", color: "white", outline: "2px solid #D6BCAE", outlineOffset: "2px" }
                    : { backgroundColor: "#F0E4D8", color: "#A08070" }
                }
              >
                {i < step ? <Check className="w-3 h-3" /> : i + 1}
              </div>
              <span
                className="text-xs truncate hidden sm:block"
                style={{ color: i === step ? "#3B2A24" : "#A08070", fontWeight: i === step ? 500 : 400 }}
              >
                {label}
              </span>
              {i < u.steps.length - 1 && <div className="flex-1 h-px mx-1" style={{ backgroundColor: "#E8D8CC" }} />}
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8">

        {/* ── Step 0: Service selection ── */}
        {step === 0 && (
          <div>
            <h2 className="text-xl font-medium mb-1" style={{ color: "#3B2A24" }}>
              {u.chooseService} <span className="text-base font-light" style={{ color: "#A08070" }}>/ {u.chooseServiceSub}</span>
            </h2>
            <p className="text-sm mb-6" style={{ color: "#A08070" }}>{u.chooseServiceHint}</p>

            {categories.map((cat) => {
              const isOpen = openCats.has(cat);
              const catLabel = lang === "th" ? cat : (CAT_EN[cat] ?? cat);
              const hasSelectedInCat = branchServices
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
                    <div className="h-px flex-1" style={{ backgroundColor: "#D6BCAE" }} />
                    <p className="text-xs font-semibold uppercase tracking-widest px-2 flex items-center gap-1.5" style={{ color: "#8B1D24" }}>
                      {catLabel}
                      {hasSelectedInCat && !isOpen && (
                        <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: "#8B1D24" }} />
                      )}
                    </p>
                    <div className="h-px flex-1" style={{ backgroundColor: "#D6BCAE" }} />
                    <span className="text-xs flex-shrink-0 ml-1" style={{ color: "#A08070" }}>
                      {isOpen ? "▲" : "▼"}
                    </span>
                  </button>

                  {isOpen && (
                    <>
                      {cat === "ย้อมผม NIGAO" && (
                        <div className="flex items-start gap-2 p-3 rounded-lg mb-3 text-sm" style={{ backgroundColor: "#FFF0E8", borderLeft: "3px solid #8B1D24" }}>
                          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#8B1D24" }} />
                          <div style={{ color: "#5C4A42" }}>
                            <p className="font-medium">{u.nigaoTitle}</p>
                            <p className="text-xs mt-0.5">{u.nigaoLine2}</p>
                            <p className="text-xs mt-0.5 opacity-70">{u.nigaoLine3}</p>
                          </div>
                        </div>
                      )}

                      <div className="grid gap-3 mb-4">
                        {branchServices
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
                                  ? { borderColor: "#8B1D24", backgroundColor: "#8B1D24", color: "white" }
                                  : { borderColor: "#E8D8CC", backgroundColor: "white", color: "#3B2A24" }}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1">
                                    <p className="font-medium">{svcName}</p>
                                    {svcDesc && (
                                      <p className="text-sm mt-1" style={{ color: isSelected ? "rgba(255,255,255,0.75)" : "#A08070" }}>
                                        {svcDesc}
                                      </p>
                                    )}
                                    {bs.service.memberPrice && (
                                      <p className="text-xs mt-1 flex items-center gap-1" style={{ color: isSelected ? "rgba(255,255,255,0.7)" : "#8B1D24" }}>
                                        <Star className="w-3 h-3" />
                                        {u.memberPrice} {formatPrice(bs.service.memberPrice)}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex-shrink-0 text-right">
                                    <p className="font-semibold text-lg">{formatPrice(bs.price)}</p>
                                    <p className="text-xs flex items-center gap-1 justify-end mt-0.5" style={{ color: isSelected ? "rgba(255,255,255,0.6)" : "#A08070" }}>
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
            <h2 className="text-xl font-medium mb-1" style={{ color: "#3B2A24" }}>
              {u.addons} <span className="text-base font-light" style={{ color: "#A08070" }}>/ {u.addonsSub}</span>
            </h2>
            <p className="text-sm mb-6" style={{ color: "#A08070" }}>{u.addonsHint}</p>
            <div className="grid gap-3">
              {/* None option */}
              <button
                onClick={handleNoAddons}
                className="w-full text-left p-4 rounded-xl border-2 transition-all flex items-center gap-3"
                style={noAddons
                  ? { borderColor: "#8B1D24", backgroundColor: "#8B1D24", color: "white" }
                  : { borderColor: "#E8D8CC", backgroundColor: "white" }}
              >
                <Ban className="w-4 h-4 flex-shrink-0" style={{ color: noAddons ? "white" : "#A08070" }} />
                <div>
                  <p className="font-medium" style={{ color: noAddons ? "white" : "#3B2A24" }}>{u.noAddons}</p>
                  <p className="text-xs" style={{ color: noAddons ? "rgba(255,255,255,0.7)" : "#A08070" }}>{u.noAddonsSub}</p>
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
                      ? { borderColor: "#8B1D24", backgroundColor: "#FFF0E8" }
                      : { borderColor: "#E8D8CC", backgroundColor: "white" }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2"
                        style={isChecked
                          ? { backgroundColor: "#8B1D24", borderColor: "#8B1D24" }
                          : { borderColor: "#D6BCAE" }}
                      >
                        {isChecked && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <p className="font-medium" style={{ color: "#3B2A24" }}>
                        {lang === "th" ? a.nameTh : (a.name || a.nameTh)}
                      </p>
                    </div>
                    <p className="font-semibold" style={{ color: "#8B1D24" }}>+{formatPrice(a.price)}</p>
                  </button>
                );
              })}
            </div>
            {selectedAddons.size > 0 && (
              <div className="mt-4 p-3 rounded-lg text-sm" style={{ backgroundColor: "#FFF0E8" }}>
                <p style={{ color: "#5C4A42" }}>{u.addonsTotal}: <span className="font-semibold">+{formatPrice(addonsTotal)}</span></p>
              </div>
            )}
          </div>
        )}

        {/* ── Step 2: Date & Time ── */}
        {step === 2 && (
          <div>
            <h2 className="text-xl font-medium mb-1" style={{ color: "#3B2A24" }}>
              {u.dateTime} <span className="text-base font-light" style={{ color: "#A08070" }}>/ {u.dateTimeSub}</span>
            </h2>

            {/* Opening hours hint */}
            <p className="text-xs mb-3 flex items-center gap-1.5" style={{ color: "#A08070" }}>
              <Clock className="w-3.5 h-3.5 flex-shrink-0" />
              {lang === "th"
                ? "จ–ส 08:00–21:00 · อา 10:00–21:00 (รับจองถึง 20:30)"
                : "Mon–Sat 08:00–21:00 · Sun 10:00–21:00 (last slot 20:30)"}
            </p>

            {isHairColor && (
              <p className="text-sm mb-4 flex items-center gap-1" style={{ color: "#8B1D24" }}>
                <AlertCircle className="w-4 h-4" /> {u.hairColorNotice}
              </p>
            )}
            <div className="bg-white rounded-xl border p-4 mb-6 flex justify-center" style={{ borderColor: "#E8D8CC" }}>
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
                <p className="text-sm font-medium mb-3" style={{ color: "#6B5245" }}>
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
                            ? { backgroundColor: "#F5F0EC", borderColor: "#E8D8CC", color: "#C4B0A4", cursor: "not-allowed" }
                            : selectedTime === t
                            ? { backgroundColor: "#8B1D24", borderColor: "#8B1D24", color: "white", fontWeight: 500 }
                            : { backgroundColor: "white", borderColor: "#E8D8CC", color: "#5C4A42" }
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
            <h2 className="text-xl font-medium mb-6" style={{ color: "#3B2A24" }}>
              {u.details} <span className="text-base font-light" style={{ color: "#A08070" }}>/ {u.detailsSub}</span>
            </h2>

            {/* Logged-in profile card (only shown if user came in via Line) */}
            {liff.ready && liff.isLoggedIn && liff.profile && (
              <div className="mb-4 rounded-xl border p-4 flex items-center gap-3" style={{ borderColor: "#BBF7D0", background: "#F0FFF4" }}>
                {liff.profile.pictureUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={liff.profile.pictureUrl} alt="" className="w-9 h-9 rounded-full" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: "#3B2A24" }}>{liff.profile.displayName}</p>
                  <p className="text-xs" style={{ color: "#166534" }}>
                    {form.phone
                      ? (lang === "th" ? "ยินดีต้อนรับกลับ — กรอกข้อมูลให้แล้ว ✓" : "Welcome back — details pre-filled ✓")
                      : (lang === "th" ? "เข้าสู่ระบบด้วย LINE แล้ว" : "Signed in with LINE")}
                  </p>
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl border p-6 space-y-4" style={{ borderColor: "#E8D8CC" }}>
              <div className="space-y-1.5">
                <Label htmlFor="name" style={{ color: "#5C4A42" }}>{u.name} <span className="text-red-500">*</span></Label>
                <Input id="name" placeholder={u.namePh} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone" style={{ color: "#5C4A42" }}>{u.phone} <span className="text-red-500">*</span></Label>
                <Input id="phone" type="tel" placeholder="08X-XXX-XXXX" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email" style={{ color: "#5C4A42" }}>{u.email} <span className="text-sm font-normal" style={{ color: "#A08070" }}>{u.optional}</span></Label>
                <Input id="email" type="email" placeholder="you@email.com" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="notes" style={{ color: "#5C4A42" }}>{u.notes} <span className="text-sm font-normal" style={{ color: "#A08070" }}>{u.optional}</span></Label>
                <Textarea id="notes" placeholder={u.notesPh} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={3} />
              </div>
            </div>
          </div>
        )}

        {/* ── Step 4: Confirm ── */}
        {step === 4 && selectedService && selectedDate && (
          <div>
            <h2 className="text-xl font-medium mb-6" style={{ color: "#3B2A24" }}>
              {u.confirm} <span className="text-base font-light" style={{ color: "#A08070" }}>/ {u.confirmSub}</span>
            </h2>
            <Card className="mb-4" style={{ borderColor: "#E8D8CC" }}>
              <CardContent className="pt-6 space-y-3">
                {[
                  [u.branch, branch.name],
                  [u.service, lang === "th" ? selectedService.service.nameTh : (selectedService.service.name || selectedService.service.nameTh)],
                  [u.date, selectedDate.toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" })],
                  [u.time, `${selectedTime} — ${addMinutes(selectedTime, selectedService.duration)} น.`],
                  [u.duration, `${selectedService.duration} ${u.minutes}`],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between items-start">
                    <span className="text-sm" style={{ color: "#A08070" }}>{label}</span>
                    <span className="text-sm font-medium text-right max-w-[60%]" style={{ color: "#3B2A24" }}>{value}</span>
                  </div>
                ))}

                {selectedAddonItems.length > 0 && (
                  <>
                    <hr style={{ borderColor: "#F0E4D8" }} />
                    <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#8B1D24" }}>{u.addons}</p>
                    {selectedAddonItems.map((a) => (
                      <div key={a.id} className="flex justify-between">
                        <span className="text-sm" style={{ color: "#5C4A42" }}>{lang === "th" ? a.nameTh : (a.name || a.nameTh)}</span>
                        <span className="text-sm" style={{ color: "#5C4A42" }}>+{formatPrice(a.price)}</span>
                      </div>
                    ))}
                  </>
                )}

                <hr style={{ borderColor: "#F0E4D8" }} />
                {[
                  [u.name, form.name],
                  [u.phone, form.phone],
                  ...(form.email ? [[u.email, form.email]] : []),
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-sm" style={{ color: "#A08070" }}>{label}</span>
                    <span className="text-sm font-medium" style={{ color: "#3B2A24" }}>{value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full h-12 rounded-xl text-base font-medium text-white transition-opacity disabled:opacity-50"
              style={{ backgroundColor: "#8B1D24" }}
            >
              {loading ? u.submitting : u.submitBtn}
            </button>
            <p className="text-center text-xs mt-3" style={{ color: "#A08070" }}>
              {u.terms}
            </p>
          </div>
        )}

        {/* Navigation buttons */}
        {step < 4 && (
          <div className="flex gap-3 mt-8">
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep((s) => s - 1)} className="flex-1" style={{ borderColor: "#D6BCAE", color: "#6B5245" }}>
                <ArrowLeft className="w-4 h-4 mr-2" /> {u.back}
              </Button>
            )}
            <button
              onClick={() => setStep((s) => s + 1)}
              disabled={!canProceed()}
              className="flex-1 h-8 rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-40 flex items-center justify-center gap-1"
              style={{ backgroundColor: "#8B1D24" }}
            >
              {step === 3 ? u.review : u.next} <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Sticky summary strip */}
        {selectedService && step > 0 && step < 4 && (
          <div className="mt-6 p-4 rounded-xl flex items-center justify-between text-sm" style={{ backgroundColor: "#FFF0E8" }}>
            <div>
              <p className="font-medium" style={{ color: "#3B2A24" }}>{lang === "th" ? selectedService.service.nameTh : (selectedService.service.name || selectedService.service.nameTh)}</p>
              <p style={{ color: "#A08070" }}>{selectedService.duration} {u.minutes}</p>
            </div>
            {selectedDate && selectedTime && (
              <Badge style={{ backgroundColor: "#8B1D24", color: "white", border: "none" }}>
                {selectedDate.toLocaleDateString("th-TH", { day: "numeric", month: "short" })} {selectedTime}
              </Badge>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
