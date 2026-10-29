"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, AlertCircle, Phone, Mail, Star, CalendarRange, Repeat } from "lucide-react";
import PdpaConsentBlock from "@/components/PdpaConsentBlock";
import TermsConsentBlock from "@/components/TermsConsentBlock";
import { ENTITLEMENT_TERMS_TH, ENTITLEMENT_TERMS_EN } from "@/lib/terms";
import { getLiff } from "@/lib/liff-client";
import { useLang } from "@/components/LanguageProvider";
import { LangSwitcher } from "@/components/LangSwitcher";

type ProductKey = "membership" | "buffet" | "5pack";

interface Product {
  key:        ProductKey;
  nameTh:     string;
  nameEn:     string;
  priceTh:    string;
  validityTh: string;
  validityEn: string;
  perkTh:     string;
  perkEn:     string;
  icon:       React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
}

const PRODUCTS: Product[] = [
  {
    key:        "membership",
    nameTh:     "สมาชิกรายเดือน",
    nameEn:     "Monthly membership",
    priceTh:    "฿990",
    validityTh: "30 วัน",
    validityEn: "30 days",
    perkTh:     "ราคาพิเศษทุกบริการ — สระไดร์เริ่ม ฿100",
    perkEn:     "Member prices on every service — wash & blow-dry from ฿100",
    icon:       Star,
  },
  {
    key:        "buffet",
    nameTh:     "Buffet 30 วัน",
    nameEn:     "30-day Buffet",
    priceTh:    "฿3,500",
    validityTh: "30 วัน",
    validityEn: "30 days",
    perkTh:     "สระไดร์ไม่จำกัด ตลอด 30 วัน",
    perkEn:     "Unlimited wash & blow-dry for 30 days",
    icon:       Repeat,
  },
  {
    key:        "5pack",
    nameTh:     "แพ็กเกจ 5 ครั้ง",
    nameEn:     "5-visit package",
    priceTh:    "฿1,600",
    validityTh: "90 วัน",
    validityEn: "90 days",
    perkTh:     "สระไดร์ 5 ครั้ง ใช้ได้ภายใน 90 วัน",
    perkEn:     "5 wash & blow-dry visits within 90 days",
    icon:       CalendarRange,
  },
];

const PRIMARY = "#B52F3A";
const BORDER  = "#EADDD4";
const TEXT    = "#45352F";
const MUTED   = "#977A6F";
const BG      = "#FDF7F2";

type Step = "loading" | "form" | "submitting" | "success" | "error";

const COPY = {
  th: {
    connecting: "กำลังเชื่อมต่อ LINE...", errorTitle: "เกิดข้อผิดพลาด", openInLine: "กรุณาเปิดหน้านี้ผ่าน LINE",
    lineConnected: "เชื่อมต่อ LINE แล้ว ✓",
    title: "เลือกแพ็กเกจของคุณ", subtitle: "เลือก 1 รายการแล้วกรอกข้อมูล — ชำระเงินที่ร้านเมื่อมาถึง",
    valid: "ใช้ได้",
    name: "ชื่อ-นามสกุล *", namePh: "เช่น ชัชจรินทร์ ใจดี",
    nickname: "ชื่อเล่น", nicknameHint: "พนักงานจะใช้ชื่อนี้เรียกคุณ", nicknamePh: "เช่น แอม, บิ๊ก, นุ้ย",
    nicknameFallback: (n: string) => `หากเว้นว่างจะใช้ “${n}” แทน`,
    phone: "เบอร์โทรศัพท์ *", email: "อีเมล (ไม่บังคับ)", gender: "เพศ (ไม่บังคับ)",
    genders: { FEMALE: "หญิง", MALE: "ชาย", OTHER: "อื่น ๆ" },
    dob: "วันเกิด",
    termsTitle: "ข้อตกลงสมาชิกและแพ็กเกจ", termsLabel: "ฉันได้อ่านและยอมรับข้อตกลงนี้",
    errName: "กรุณาระบุชื่อ", errPhone: "กรุณาระบุเบอร์โทร", errDob: "กรุณาระบุวันเกิด",
    errPdpa: "กรุณายอมรับนโยบาย PDPA", errTerms: "กรุณายอมรับข้อตกลงสมาชิกและแพ็กเกจ",
    errGeneric: "เกิดข้อผิดพลาด", errRetry: "เกิดข้อผิดพลาด กรุณาลองใหม่",
    submitting: "กำลังลงทะเบียน...", submit: (price: string) => `ลงทะเบียน — ชำระที่ร้าน ${price}`,
    footer: "บัญชี LINE ของคุณจะถูกเชื่อมโยงกับข้อมูลสมาชิก",
  },
  en: {
    connecting: "Connecting to LINE...", errorTitle: "Something went wrong", openInLine: "Please open this page in LINE",
    lineConnected: "LINE connected ✓",
    title: "Choose your package", subtitle: "Pick one and fill in your details — pay at the salon when you arrive",
    valid: "Valid for",
    name: "Full name *", namePh: "e.g. Jane Smith",
    nickname: "Nickname", nicknameHint: "Our staff will call you by this name", nicknamePh: "e.g. Am, Big, Nui",
    nicknameFallback: (n: string) => `If left blank we'll use “${n}”`,
    phone: "Phone number *", email: "Email (optional)", gender: "Gender (optional)",
    genders: { FEMALE: "Female", MALE: "Male", OTHER: "Other" },
    dob: "Date of birth",
    termsTitle: "Membership & package terms", termsLabel: "I have read and accept these terms",
    errName: "Please enter your name", errPhone: "Please enter your phone number", errDob: "Please enter your date of birth",
    errPdpa: "Please accept the personal data (PDPA) consent", errTerms: "Please accept the membership & package terms",
    errGeneric: "Something went wrong", errRetry: "Something went wrong — please try again",
    submitting: "Registering...", submit: (price: string) => `Register — pay ${price} at the salon`,
    footer: "Your LINE account will be linked to your membership",
  },
} as const;

interface LineProfile {
  userId:      string;
  displayName: string;
  pictureUrl?: string;
}

export default function LiffMembershipSignupPage() {
  const router = useRouter();
  const { lang } = useLang();
  const t = COPY[lang];

  const [step,     setStep]     = useState<Step>("loading");
  const [profile,  setProfile]  = useState<LineProfile | null>(null);

  // Form state
  const [product,     setProduct]     = useState<ProductKey>("membership");
  const [name,        setName]        = useState("");
  const [nickname,    setNickname]    = useState("");
  const [phone,       setPhone]       = useState("");
  const [email,       setEmail]       = useState("");
  const [gender,      setGender]      = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [pdpa,        setPdpa]        = useState(false);
  const [terms,       setTerms]       = useState(false);
  const [formErr,     setFormErr]     = useState("");

  const selectedProduct = PRODUCTS.find(p => p.key === product)!;

  // Init LIFF and login — getLiff() reuses the already-initialized singleton
  // from LiffProvider so this completes instantly after the OAuth redirect.
  useEffect(() => {
    getLiff()
      .then(async (liff) => {
        if (!liff.isLoggedIn()) {
          liff.login({ redirectUri: window.location.href });
          return;
        }
        const p = await liff.getProfile();
        setProfile({
          userId:      p.userId,
          displayName: p.displayName,
          pictureUrl:  p.pictureUrl ?? undefined,
        });
        // The LINE display name is shown in the banner above but deliberately
        // NOT copied into the name field — it is usually a handle or emoji, and
        // pre-filling it meant members were registered under something that is
        // not their real first and last name. Same rule as the booking form.
        setStep("form");
      })
      .catch(() => {
        setStep("error");
      });
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErr("");

    if (!name.trim())  { setFormErr(t.errName);  return; }
    if (!phone.trim()) { setFormErr(t.errPhone); return; }
    if (!dateOfBirth)  { setFormErr(t.errDob);   return; }
    if (!pdpa)         { setFormErr(t.errPdpa);  return; }
    if (!terms)        { setFormErr(t.errTerms); return; }

    // Nickname is required — fall back to first word of name if left blank
    const finalNickname = nickname.trim() || name.trim().split(/\s+/)[0];

    setStep("submitting");
    try {
      const res = await fetch("/api/membership/signup", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:        name.trim(),
          nickname:    finalNickname,
          phone:       phone.trim(),
          email:       email.trim() || undefined,
          gender:      gender || undefined,
          dateOfBirth: dateOfBirth || undefined,
          pdpaConsent: pdpa,
          termsAccepted: terms,
          source:      `liff-${product}`,
          lineUserId:  profile?.userId,
          pictureUrl:  profile?.pictureUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        // The API answers in Thai — English visitors get the generic English message.
        setFormErr(lang === "en" || !data.error ? t.errGeneric : data.error);
        setStep("form");
        return;
      }

      if (data.status === "already_member") {
        // Already a member — redirect to การจองของฉัน which shows membership status
        router.replace(`/my-bookings`);
        return;
      }
      // pending_payment — pass chosen product as a query param so the pending
      // page can show the correct product name & price.
      router.replace(`/membership/pending/${data.customerId}?p=${product}`);
    } catch {
      setFormErr(t.errRetry);
      setStep("form");
    }
  }, [name, nickname, phone, email, gender, dateOfBirth, pdpa, terms, profile, product, router, t, lang]);

  // ── Loading ──
  if (step === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: BG }}>
        <div className="text-center">
          <div
            className="w-12 h-12 rounded-full border-4 border-t-transparent animate-spin mx-auto mb-4"
            style={{ borderColor: "#EADDD4", borderTopColor: PRIMARY }}
          />
          <p className="text-sm" style={{ color: MUTED }}>{t.connecting}</p>
        </div>
      </div>
    );
  }

  // ── Error ──
  if (step === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: BG }}>
        <div className="text-center max-w-xs">
          <AlertCircle className="mx-auto mb-3" size={44} style={{ color: PRIMARY }} />
          <p className="font-semibold mb-1" style={{ color: TEXT }}>{t.errorTitle}</p>
          <p className="text-sm" style={{ color: MUTED }}>{t.openInLine}</p>
        </div>
      </div>
    );
  }

  // ── Form ──
  return (
    <main className="min-h-screen" style={{ background: BG }}>
      <div className="max-w-md mx-auto px-5 py-8">
        <div className="flex justify-end mb-3">
          <LangSwitcher tone="light" />
        </div>

        {/* LINE profile banner */}
        {profile && (
          <div
            className="flex items-center gap-3 rounded-2xl p-3 mb-6"
            style={{ background: "#F0FFF4", border: "1.5px solid #BBF7D0" }}
          >
            {profile.pictureUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={profile.pictureUrl} alt="" className="w-10 h-10 rounded-full flex-shrink-0 object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-green-200 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 size={20} style={{ color: "#166534" }} />
              </div>
            )}
            <div>
              <p className="text-xs font-semibold" style={{ color: "#166534" }}>{t.lineConnected}</p>
              <p className="text-sm" style={{ color: TEXT }}>{profile.displayName}</p>
            </div>
          </div>
        )}

        <header className="mb-6">
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: MUTED }}>Sign up</p>
          <h1 className="text-2xl font-medium" style={{ color: TEXT }}>{t.title}</h1>
          <p className="text-sm mt-1" style={{ color: MUTED }}>
            {t.subtitle}
          </p>
        </header>

        {/* Product picker */}
        <div className="space-y-2.5 mb-6">
          {PRODUCTS.map(p => {
            const isSelected = product === p.key;
            const Icon = p.icon;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => setProduct(p.key)}
                className="w-full text-left rounded-2xl border-2 p-3.5 transition-all flex items-start gap-3"
                style={{
                  borderColor: isSelected ? PRIMARY : BORDER,
                  background:  isSelected ? "#FFFBF8" : "white",
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center"
                  style={{
                    background: isSelected ? PRIMARY : "#FFF3ED",
                    color:      isSelected ? "white"  : PRIMARY,
                  }}
                >
                  <Icon size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="font-semibold text-sm" style={{ color: TEXT }}>{lang === "en" ? p.nameEn : p.nameTh}</p>
                    <p className="font-bold text-sm" style={{ color: PRIMARY }}>{p.priceTh}</p>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: MUTED }}>{lang === "en" ? p.perkEn : p.perkTh}</p>
                  <p className="text-[10px] mt-0.5 font-medium uppercase tracking-wide" style={{ color: MUTED }}>
                    {t.valid} {lang === "en" ? p.validityEn : p.validityTh}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs mb-1.5 font-medium" style={{ color: MUTED }}>{t.name}</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t.namePh}
              className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none bg-white"
              style={{ borderColor: BORDER, color: TEXT }}
            />
          </div>

          {/* Nickname */}
          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <label className="text-xs font-medium" style={{ color: MUTED }}>
                {t.nickname} <span style={{ color: PRIMARY }}>*</span>
              </label>
              <span className="text-[10px]" style={{ color: MUTED }}>
                {t.nicknameHint}
              </span>
            </div>
            <input
              type="text"
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              placeholder={name.trim().split(/\s+/)[0] || t.nicknamePh}
              className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none bg-white"
              style={{ borderColor: BORDER, color: TEXT }}
            />
            {!nickname.trim() && name.trim() && (
              <p className="text-[10px] mt-1" style={{ color: MUTED }}>
                {t.nicknameFallback(name.trim().split(/\s+/)[0])}
              </p>
            )}
          </div>

          {/* Phone */}
          <div>
            <label className="block text-xs mb-1.5 font-medium" style={{ color: MUTED }}>{t.phone}</label>
            <div className="flex items-center gap-2 border rounded-xl px-3 py-2.5 bg-white" style={{ borderColor: BORDER }}>
              <Phone size={15} style={{ color: MUTED }} />
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="08x-xxx-xxxx"
                className="flex-1 text-sm outline-none bg-transparent"
                style={{ color: TEXT }}
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs mb-1.5 font-medium" style={{ color: MUTED }}>{t.email}</label>
            <div className="flex items-center gap-2 border rounded-xl px-3 py-2.5 bg-white" style={{ borderColor: BORDER }}>
              <Mail size={15} style={{ color: MUTED }} />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="flex-1 text-sm outline-none bg-transparent"
                style={{ color: TEXT }}
              />
            </div>
          </div>

          {/* Gender */}
          <div>
            <label className="block text-xs mb-1.5 font-medium" style={{ color: MUTED }}>{t.gender}</label>
            <div className="flex gap-2">
              {(["FEMALE", "MALE", "OTHER"] as const).map(v => ({ v, label: t.genders[v] })).map(g => (
                <button
                  key={g.v}
                  type="button"
                  onClick={() => setGender(gender === g.v ? "" : g.v)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors"
                  style={{
                    background: gender === g.v ? PRIMARY : "white",
                    color:      gender === g.v ? "white"  : MUTED,
                    border:     `1px solid ${gender === g.v ? PRIMARY : BORDER}`,
                  }}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date of birth */}
          <div>
            <label className="block text-xs mb-1.5 font-medium" style={{ color: MUTED }}>{t.dob} <span className="text-red-500">*</span></label>
            <input
              type="date"
              value={dateOfBirth}
              onChange={e => setDateOfBirth(e.target.value)}
              className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none bg-white"
              style={{ borderColor: BORDER, color: dateOfBirth ? TEXT : MUTED }}
            />
          </div>

          {/* PDPA */}
          <PdpaConsentBlock checked={pdpa} onChange={setPdpa} context="liff" lang={lang} />

          {/* Membership & package terms */}
          <TermsConsentBlock
            checked={terms}
            onChange={setTerms}
            title={t.termsTitle}
            rules={lang === "en" ? ENTITLEMENT_TERMS_EN : ENTITLEMENT_TERMS_TH}
            label={t.termsLabel}
          />

          {/* Form error */}
          {formErr && (
            <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm" style={{ background: "#FEF2F2", color: "#991b1b" }}>
              <AlertCircle size={14} />
              {formErr}
            </div>
          )}

          <button
            type="submit"
            disabled={step === "submitting"}
            className="w-full py-3.5 rounded-xl text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ background: PRIMARY }}
          >
            {step === "submitting" && <Loader2 size={16} className="animate-spin" />}
            {step === "submitting"
              ? t.submitting
              : t.submit(selectedProduct.priceTh)}
          </button>

          <p className="text-xs text-center" style={{ color: MUTED }}>
            {t.footer}
          </p>
        </form>
      </div>
    </main>
  );
}
