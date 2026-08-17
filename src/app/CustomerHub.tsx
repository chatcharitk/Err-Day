"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CalendarDays, Clock3, CreditCard, MapPin, Sparkles, Star, Trash2, X } from "lucide-react";
import { useLiff } from "@/hooks/useLiff";
import { useLang } from "@/components/LanguageProvider";
import { LangSwitcher } from "@/components/LangSwitcher";
import { RescheduleModal, type ReschedulableBooking } from "@/app/my-bookings/MyBookingsClient";

type Tab = "home" | "book" | "history" | "tarot";
type Branch = { id: string; name: string; address: string; phone: string; bookingEnabled: boolean };
type Booking = ReschedulableBooking & {
  status: string;
  branch: { name: string; phone?: string | null };
  service: { id: string; name: string; nameTh: string; category?: string | null };
};
type MembershipData = {
  membership?: { label?: string | null; expiresAt?: string | null; isExpired?: boolean } | null;
  packages?: Array<{ id: string; nameTh: string; expiresAt: string; usagesLeft: number; usageLimit: number }>;
};
type Customer = { name: string; nickname?: string | null; phone: string; dateOfBirth?: string | null };
type Reading = { love: string; career: string; finance: string };

const DECK = [
  { id: 74, name: "The Star", th: "ดาวแห่งความหวัง", image: "/tarot/The-Star.png" },
  { id: 75, name: "The Moon", th: "จันทราแห่งสัญชาตญาณ", image: "/tarot/The-Moon.png" },
  { id: 76, name: "The Sun", th: "สุริยะแห่งความสำเร็จ", image: "/tarot/The-Sun.png" },
  { id: 63, name: "The Lovers", th: "คู่รักแห่งการเลือก", image: "/tarot/The-Lovers.png" },
  { id: 67, name: "Wheel of Fortune", th: "วงล้อแห่งโชคชะตา", image: "/tarot/Wheel of Fortune.png" },
  { id: 58, name: "The Magician", th: "นักมายาแห่งพลัง", image: "/tarot/The-Magician.png" },
] as const;

const STATUS: Record<"th" | "en", Record<string, string>> = {
  th: { PENDING: "รอยืนยัน", CONFIRMED: "ยืนยันแล้ว", COMPLETED: "เสร็จสิ้น", CANCELLED: "ยกเลิกแล้ว", NO_SHOW: "ไม่มาตามนัด" },
  en: { PENDING: "Pending", CONFIRMED: "Confirmed", COMPLETED: "Completed", CANCELLED: "Cancelled", NO_SHOW: "No-show" },
};

const HUB_UI = {
  th: {
    loginIntro: "พื้นที่สำหรับลูกค้า err.day", loginTitle: "เข้าสู่ระบบเพื่อดูสมาชิก การจอง และบริการของคุณ", loginButton: "เข้าสู่ระบบด้วย LINE", loginNote: "เราใช้ LINE เพื่อยืนยันตัวตนและแสดงข้อมูลของคุณอย่างปลอดภัย",
    preparing: "กำลังเตรียมพื้นที่ของคุณ...", loading: "กำลังโหลดข้อมูลของคุณ...", loadFailed: "โหลดข้อมูลไม่สำเร็จ", retry: "ลองใหม่",
    hello: "สวัสดี", active: "ใช้งานได้", expired: "หมดอายุ", member: "สมาชิก err.day",
    daysLeft: "สมาชิกเหลืออีก", days: "วัน", expires: "หมดอายุ", noExpiry: "ไม่กำหนด", uses: "ครั้ง",
    noPlan: "ยังไม่มีสมาชิกหรือแพ็กเกจ", noPlanText: "สมัครสมาชิกเพื่อรับราคาพิเศษและสิทธิประโยชน์จาก err.day", viewPlans: "ดูแพ็กเกจสมาชิก",
    book: "จองคิว", bookHint: "เลือกสาขาและเวลาที่สะดวก", startBooking: "เริ่มจอง",
    next: "นัดหมายถัดไป", viewAll: "ดูทั้งหมด", manage: "จัดการนัดหมาย", cancel: "ยกเลิกนัดหมาย", noUpcoming: "ยังไม่มีนัดหมายที่กำลังจะมาถึง", bookNow: "จองคิวเลย",
    comingSoon: "ดูดวง เร็ว ๆ นี้", tarotSoon: "ฟีเจอร์ดูดวงกำลังเตรียมเปิดให้บริการ", soon: "เร็ว ๆ นี้",
    chooseBranch: "เลือกสาขาเพื่อจองคิว", chooseBranchHint: "เลือกสาขาที่สะดวก แล้วทำรายการจองในขั้นตอนถัดไป", chooseThisBranch: "เลือกสาขานี้",
    history: "ประวัติการจอง", historyHint: "ดูนัดหมายที่กำลังจะมาถึงและประวัติการใช้บริการ", noHistory: "ยังไม่มีประวัติการจอง",
    memberTab: "สมาชิก", bookTab: "จองคิว", historyTab: "ประวัติ", tarotTab: "ดูดวง",
    cancelTitle: "ยืนยันการยกเลิกนัดหมาย?", cancelText: "นัดหมายนี้จะถูกยกเลิกและไม่สามารถย้อนกลับได้", keep: "เก็บนัดหมายไว้", confirmCancel: "ยืนยันยกเลิก", cancelling: "กำลังยกเลิก...",
    contactTitle: "กรุณาติดต่อแอดมิน", contactText: "ไม่สามารถยกเลิกออนไลน์ภายใน 30 นาทีก่อนเวลานัด กรุณาติดต่อร้านเพื่อขอความช่วยเหลือ", close: "ปิด", call: "โทรหาร้าน",
    cancelError: "ไม่สามารถยกเลิกนัดหมายได้ กรุณาลองใหม่อีกครั้ง",
  },
  en: {
    loginIntro: "Your err.day space", loginTitle: "Sign in to view your membership, bookings, and services.", loginButton: "Sign in with LINE", loginNote: "We use LINE to verify your identity and display your information securely.",
    preparing: "Preparing your space...", loading: "Loading your information...", loadFailed: "Unable to load your information", retry: "Try again",
    hello: "Hello", active: "Active", expired: "Expired", member: "err.day Member",
    daysLeft: "Membership remaining", days: "days", expires: "Expires", noExpiry: "No expiry", uses: "uses",
    noPlan: "No membership or package yet", noPlanText: "Join to enjoy member pricing and err.day benefits.", viewPlans: "View membership plans",
    book: "Book an appointment", bookHint: "Choose a branch and convenient time", startBooking: "Book now",
    next: "Next appointment", viewAll: "View all", manage: "Manage appointment", cancel: "Cancel appointment", noUpcoming: "You have no upcoming appointments", bookNow: "Book now",
    comingSoon: "Tarot coming soon", tarotSoon: "We’re preparing the tarot experience for you.", soon: "Coming soon",
    chooseBranch: "Choose a branch", chooseBranchHint: "Select your preferred branch to continue booking.", chooseThisBranch: "Choose this branch",
    history: "Booking history", historyHint: "View upcoming appointments and your visit history.", noHistory: "No booking history yet",
    memberTab: "Member", bookTab: "Book", historyTab: "History", tarotTab: "Tarot",
    cancelTitle: "Cancel this appointment?", cancelText: "This appointment will be cancelled and cannot be restored.", keep: "Keep appointment", confirmCancel: "Cancel appointment", cancelling: "Cancelling...",
    contactTitle: "Please contact the salon", contactText: "Online cancellation is unavailable within 30 minutes of your appointment. Please contact the salon for assistance.", close: "Close", call: "Call salon",
    cancelError: "We couldn’t cancel this appointment. Please try again.",
  },
} as const;

function displayDate(value: string, lang: "th" | "en") {
  return new Intl.DateTimeFormat(lang === "th" ? "th-TH" : "en-GB", { dateStyle: "long" }).format(new Date(value));
}

function daysUntil(value?: string | null) {
  if (!value) return 0;
  return Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000));
}

function bookingStartsAt(dateValue: string, startTime: string) {
  const localDate = dateValue.slice(0, 10);
  const localTime = startTime.length === 5 ? `${startTime}:00` : startTime;
  return Date.parse(`${localDate}T${localTime}+07:00`);
}

export default function CustomerHub({ branches, tarotEnabled }: { branches: Branch[]; tarotEnabled: boolean }) {
  const liff = useLiff();
  const { lang } = useLang();
  const u = HUB_UI[lang];
  const [openedAt] = useState(() => Date.now());
  const scrollRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<Tab>("home");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [membership, setMembership] = useState<MembershipData | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [reading, setReading] = useState<Reading | null>(null);
  const [readingError, setReadingError] = useState("");
  const [readingBusy, setReadingBusy] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState("");
  const [cancelDialog, setCancelDialog] = useState<"confirm" | "contact" | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const [editing, setEditing] = useState<Booking | null>(null);

  const loadCustomerData = useCallback(async () => {
    if (!liff.accessToken) return;
    setDataLoading(true);
    setDataError("");
    try {
      const response = await fetch("/api/customer/hub", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineAccessToken: liff.accessToken }),
      });
      if (!response.ok) throw new Error("customer_data_unavailable");
      const data = await response.json();
      setCustomer(data.customer);
      setMembership({ membership: data.membership, packages: data.packages });
      setBookings(data.bookings ?? []);
    } catch {
      setDataError("ไม่สามารถโหลดข้อมูลสมาชิกและการจองได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setDataLoading(false);
    }
  }, [liff.accessToken]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadCustomerData(), 0);
    return () => window.clearTimeout(timer);
  }, [loadCustomerData]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [tab]);

  const upcoming = useMemo(() => bookings
    .filter(b => {
      const startsAt = bookingStartsAt(b.date, b.startTime);
      return !["CANCELLED", "COMPLETED", "NO_SHOW"].includes(b.status)
        && Number.isFinite(startsAt)
        && startsAt >= openedAt;
    })
    .sort((a, b) => bookingStartsAt(a.date, a.startTime) - bookingStartsAt(b.date, b.startTime))[0], [bookings, openedAt]);
  const activePackage = membership?.packages?.[0];
  const displayName = customer?.nickname || customer?.name?.split(" ")[0] || liff.profile?.displayName || "คุณ";

  function requestCancellation() {
    if (!upcoming) return;
    setCancelError("");
    const remaining = bookingStartsAt(upcoming.date, upcoming.startTime) - Date.now();
    setCancelDialog(remaining <= 30 * 60 * 1000 ? "contact" : "confirm");
  }

  async function confirmCancellation() {
    if (!upcoming || !liff.profile?.userId) return;
    setCancelBusy(true);
    setCancelError("");
    try {
      const response = await fetch(`/api/customer/bookings/${encodeURIComponent(upcoming.id)}?lineUserId=${encodeURIComponent(liff.profile.userId)}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (response.status === 409 && data.error === "cancellation_cutoff") {
        setCancelDialog("contact");
        return;
      }
      if (!response.ok) throw new Error("cancel_failed");
      setCancelDialog(null);
      await loadCustomerData();
    } catch {
      setCancelError(u.cancelError);
    } finally {
      setCancelBusy(false);
    }
  }

  function toggleCard(id: number) {
    setReading(null); setReadingError("");
    setSelected(current => current.includes(id) ? current.filter(x => x !== id) : current.length < 3 ? [...current, id] : current);
  }

  async function reveal() {
    if (selected.length !== 3) return;
    setReadingBusy(true); setReadingError(""); setReading(null);
    try {
      const response = await fetch("/api/tarot", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          love: selected[0], career: selected[1], finance: selected[2],
          lineAccessToken: liff.accessToken,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || data.error || "ไม่สามารถเปิดคำทำนายได้");
      setReading(data);
    } catch (error) {
      setReadingError(error instanceof Error ? error.message : "ไม่สามารถเปิดคำทำนายได้");
    } finally { setReadingBusy(false); }
  }

  if (!liff.ready) return <div className="hub-loading"><span /><p>{u.preparing}</p></div>;
  if (!liff.isLoggedIn || !liff.profile) return (
    <main className="customer-hub hub-login">
      <header className="hub-header"><span className="hub-logo">err<span>·</span>day</span><LangSwitcher /></header>
      <section>
        <span className="login-mark">LINE</span>
        <p>{u.loginIntro}</p>
        <h1>{u.loginTitle}</h1>
        <button type="button" onClick={liff.login}>{u.loginButton}</button>
        <small>{u.loginNote}</small>
      </section>
    </main>
  );
  if (dataLoading) return <div className="hub-loading"><span /><p>{u.loading}</p></div>;
  if (dataError) return (
    <main className="customer-hub hub-error-state">
      <span>!</span><h1>{u.loadFailed}</h1><p>{dataError}</p>
      <button type="button" onClick={() => void loadCustomerData()}>{u.retry}</button>
    </main>
  );

  return (
    <main className="customer-hub">
      <header className="hub-header">
        <span className="hub-logo">err<span>·</span>day</span>
        <div className="hub-profile">
          <LangSwitcher />
          {liff.isLoggedIn && <span className="line-pill"><i /> LINE</span>}
        </div>
      </header>

      <div className="hub-scroll" ref={scrollRef}>
        {tab === "home" && <>
          <section className="welcome">
            <div className="welcome-copy"><p>WELCOME BACK</p><h1>{u.hello} {displayName}</h1>{customer?.phone && <span>{customer.phone}</span>}</div>
            {liff.profile.pictureUrl ? <Image src={liff.profile.pictureUrl} alt="" width={64} height={64} className="hub-avatar welcome-avatar" unoptimized /> : <span className="hub-avatar hub-initial welcome-avatar">{displayName[0]}</span>}
          </section>
          <div className="welcome-wave" />
          <section className="hub-section entitlement">
            {membership?.membership ? <div className="member-card">
              <span className="foil" /><div className="card-top"><div><small>ERR.DAY MEMBER</small><h2>{membership.membership.label || u.member}</h2></div><b>{membership.membership.isExpired ? u.expired : u.active}</b></div>
              <div className="card-stats"><div><small>{u.daysLeft}</small><strong>{daysUntil(membership.membership.expiresAt)}<em> {u.days}</em></strong></div><div><small>{u.expires}</small><span>{membership.membership.expiresAt ? displayDate(membership.membership.expiresAt, lang) : u.noExpiry}</span></div></div>
            </div> : activePackage ? <div className="package-card"><small>ERR.DAY PACKAGE</small><h2>{activePackage.nameTh}</h2><div className="card-stats"><strong>{activePackage.usagesLeft}<em> / {activePackage.usageLimit} {u.uses}</em></strong><span>{u.expires} {displayDate(activePackage.expiresAt, lang)}</span></div></div> : <div className="empty-card"><small>ERR.DAY MEMBER</small><h2>{u.noPlan}</h2><p>{u.noPlanText}</p><Link href="/liff/membership/signup">{u.viewPlans}</Link></div>}
          </section>

          <section className="hub-section booking-priority">
            <button type="button" onClick={() => setTab("book")}>
              <span className="booking-icon"><CalendarDays /></span>
              <span><strong>{u.book}</strong><small>{u.bookHint}</small></span>
              <b>{u.startBooking} <span aria-hidden="true">›</span></b>
            </button>
          </section>

          <section className="hub-section"><div className="section-heading"><div><h2>{u.next}</h2><p>Next appointment</p></div><button onClick={() => setTab("history")}>{u.viewAll}</button></div>
            {upcoming ? <article className="appointment"><div className="appointment-title"><div><h3>{lang === "th" ? upcoming.service.nameTh || upcoming.service.name : upcoming.service.name}</h3><p>{upcoming.service.category}</p></div><span>{STATUS[lang][upcoming.status] || upcoming.status}</span></div><p><MapPin /> {upcoming.branch.name}</p><p><CalendarDays /> {displayDate(upcoming.date, lang)}</p><p><Clock3 /> {upcoming.startTime} — {upcoming.endTime} {lang === "th" ? "น." : ""}</p><div className="appointment-actions"><button className="manage-appointment" type="button" onClick={() => setEditing(upcoming)}>{u.manage}</button><button type="button" onClick={requestCancellation}><Trash2 />{u.cancel}</button></div></article> : <div className="empty-appointment"><CalendarDays /><p>{u.noUpcoming}</p><button onClick={() => setTab("book")}>{u.bookNow}</button></div>}
          </section>

          <section className="hub-section"><button className={`tarot-teaser${tarotEnabled ? "" : " coming-soon"}`} disabled={!tarotEnabled} onClick={() => setTab("tarot")}><span className="mini-card"><Star /></span><span><small>{tarotEnabled ? "DAILY READING" : "COMING SOON"}</small><strong>{tarotEnabled ? (lang === "th" ? "ดวงวันนี้ของคุณ" : "Your daily reading") : u.comingSoon}</strong><em>{tarotEnabled ? (lang === "th" ? "เลือกไพ่ 3 ใบ เพื่ออ่านความรัก การงาน และการเงิน" : "Choose 3 cards for love, career, and finance") : u.tarotSoon}</em></span>{tarotEnabled ? <b>›</b> : <b className="soon-badge">{u.soon}</b>}</button></section>
        </>}

        {tab === "book" && <section className="hub-section tab-page"><small>BOOK AN APPOINTMENT</small><h1>{u.chooseBranch}</h1><p>{u.chooseBranchHint}</p><div className="branch-list">{branches.map(branch => <article key={branch.id}><div><h2>{branch.name}</h2><p><MapPin /> {branch.address}</p></div>{branch.bookingEnabled ? <Link href={`/book/${branch.id}`}>{u.chooseThisBranch}</Link> : <span>{u.soon}</span>}</article>)}</div></section>}

        {tab === "history" && <section className="hub-section tab-page"><small>YOUR VISITS</small><h1>{u.history}</h1><p>{u.historyHint}</p><div className="history-list">{bookings.length ? bookings.map(b => <article key={b.id}><div><h2>{lang === "th" ? b.service.nameTh || b.service.name : b.service.name}</h2><p>{b.branch.name}</p><p>{displayDate(b.date, lang)} · {b.startTime} {lang === "th" ? "น." : ""}</p></div><span>{STATUS[lang][b.status] || b.status}</span></article>) : <div className="empty-appointment"><Clock3 /><p>{u.noHistory}</p></div>}</div></section>}

        {tab === "tarot" && <section className="tarot-page"><div className="tarot-title"><span>✦ ERR.DAY TAROT ✦</span><h1>ดูดวงแบบละเอียด</h1><p>เลือกไพ่ตามความรู้สึก 3 ใบ สำหรับความรัก การงาน และการเงิน</p></div>
          {customer?.dateOfBirth && <div className="birthday"><span>วันเกิดของคุณ</span><strong>{displayDate(customer.dateOfBirth, lang)}</strong><small>บันทึกไว้จากโปรไฟล์สมาชิก</small></div>}
          <div className="deck-box"><div className="step-title"><b>1</b><span>เลือกไพ่ 3 ใบ</span><em>{selected.length}/3</em></div><p>ลำดับที่เลือก: ความรัก · การงาน · การเงิน</p><div className="tarot-deck">{DECK.map(card => { const order = selected.indexOf(card.id); return <button type="button" key={card.id} onClick={() => toggleCard(card.id)} className={order >= 0 ? "selected" : ""} aria-label={`เลือกไพ่ ${card.name}`} aria-pressed={order >= 0}><span className="card-back">✦</span><span className="card-front"><Image src={card.image} alt={card.name} fill sizes="100px" /><i>{card.name}</i></span>{order >= 0 && <b>{order + 1}</b>}</button>})}</div></div>
          <button className="reveal" disabled={selected.length !== 3 || readingBusy} onClick={reveal}><Sparkles /> {readingBusy ? "กำลังเปิดคำทำนาย..." : selected.length === 3 ? "เปิดคำทำนายแบบละเอียด" : `เลือกไพ่อีก ${3 - selected.length} ใบ`}</button>
          {readingError && <div className="reading-error" role="alert" aria-live="polite">{readingError}</div>}
          {reading && <div className="reading"><div className="reading-divider">YOUR READING</div>{[{ icon: "♡", title: "ความรัก", body: reading.love }, { icon: "✦", title: "การงาน", body: reading.career }, { icon: "฿", title: "การเงิน", body: reading.finance }].map(item => <article key={item.title}><span>{item.icon}</span><div><h2>{item.title}</h2><p>{item.body}</p></div></article>)}<p className="provider">คำทำนายโดย AstrologyAPI · ใช้เพื่อความบันเทิงและการสะท้อนตนเอง</p></div>}
        </section>}
      </div>

      {editing && liff.profile && <RescheduleModal
        booking={editing}
        branches={branches}
        lineUserId={liff.profile.userId}
        lang={lang}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          void loadCustomerData();
        }}
      />}

      {cancelDialog && upcoming && <div className="hub-dialog-backdrop" role="presentation" onClick={() => !cancelBusy && setCancelDialog(null)}>
        <section className="hub-dialog" role="dialog" aria-modal="true" aria-labelledby="cancel-dialog-title" onClick={(event) => event.stopPropagation()}>
          <button className="hub-dialog-close" type="button" aria-label={u.close} onClick={() => setCancelDialog(null)} disabled={cancelBusy}><X /></button>
          <span className={`hub-dialog-icon ${cancelDialog === "contact" ? "contact" : "cancel"}`}><AlertCircle /></span>
          <h2 id="cancel-dialog-title">{cancelDialog === "contact" ? u.contactTitle : u.cancelTitle}</h2>
          <p>{cancelDialog === "contact" ? u.contactText : u.cancelText}</p>
          {cancelError && <p className="hub-dialog-error" role="alert">{cancelError}</p>}
          {cancelDialog === "contact" ? <div className="hub-dialog-actions">
            {upcoming.branch.phone && <a className="dialog-primary" href={`tel:${upcoming.branch.phone}`}>{u.call} · {upcoming.branch.phone}</a>}
            <button type="button" onClick={() => setCancelDialog(null)}>{u.close}</button>
          </div> : <div className="hub-dialog-actions split">
            <button type="button" onClick={() => setCancelDialog(null)} disabled={cancelBusy}>{u.keep}</button>
            <button className="dialog-danger" type="button" onClick={() => void confirmCancellation()} disabled={cancelBusy}>{cancelBusy ? u.cancelling : u.confirmCancel}</button>
          </div>}
        </section>
      </div>}

      <nav className="hub-tabs" aria-label={lang === "th" ? "เมนูลูกค้า" : "Customer menu"}>{[
        ["home", CreditCard, u.memberTab], ["book", CalendarDays, u.bookTab], ["history", Clock3, u.historyTab], ["tarot", Sparkles, u.tarotTab],
      ].map(([id, Icon, label]) => {
        const disabled = id === "tarot" && !tarotEnabled;
        return <button type="button" key={String(id)} disabled={disabled} onClick={() => setTab(id as Tab)} className={`${tab === id ? "active " : ""}${id === "book" ? "booking-tab" : ""}`} aria-current={tab === id ? "page" : undefined} aria-label={disabled ? u.comingSoon : String(label)}><Icon /><span>{String(label)}</span></button>;
      })}</nav>
    </main>
  );
}
