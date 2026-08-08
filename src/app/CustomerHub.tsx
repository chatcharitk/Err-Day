"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Clock3, CreditCard, MapPin, Sparkles, Star } from "lucide-react";
import { useLiff } from "@/hooks/useLiff";

type Tab = "home" | "book" | "history" | "tarot";
type Branch = { id: string; name: string; address: string; bookingEnabled: boolean };
type Booking = {
  id: string; date: string; startTime: string; endTime: string; status: string;
  branch: { name: string }; service: { name: string; nameTh?: string | null; category?: string | null };
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

const STATUS: Record<string, string> = {
  PENDING: "รอยืนยัน", CONFIRMED: "ยืนยันแล้ว", COMPLETED: "เสร็จสิ้น", CANCELLED: "ยกเลิกแล้ว", NO_SHOW: "ไม่มาตามนัด",
};

function thaiDate(value: string) {
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "long" }).format(new Date(value));
}

function daysUntil(value?: string | null) {
  if (!value) return 0;
  return Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000));
}

export default function CustomerHub({ branches, tarotEnabled }: { branches: Branch[]; tarotEnabled: boolean }) {
  const liff = useLiff();
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
    .filter(b => !["CANCELLED", "COMPLETED", "NO_SHOW"].includes(b.status) && new Date(`${b.date}T${b.startTime}`).getTime() >= openedAt)
    .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`))[0], [bookings, openedAt]);
  const activePackage = membership?.packages?.[0];
  const displayName = customer?.nickname || customer?.name?.split(" ")[0] || liff.profile?.displayName || "คุณ";

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

  if (!liff.ready) return <div className="hub-loading"><span /><p>กำลังเตรียมพื้นที่ของคุณ...</p></div>;
  if (!liff.isLoggedIn || !liff.profile) return (
    <main className="customer-hub hub-login">
      <header className="hub-header"><span className="hub-logo">err<span>·</span>day</span></header>
      <section>
        <span className="login-mark">LINE</span>
        <p>พื้นที่สำหรับลูกค้า err.day</p>
        <h1>เข้าสู่ระบบเพื่อดูสมาชิก<br />การจอง และดวงของคุณ</h1>
        <button type="button" onClick={liff.login}>เข้าสู่ระบบด้วย LINE</button>
        <small>เราใช้ LINE เพื่อยืนยันตัวตนและแสดงข้อมูลของคุณอย่างปลอดภัย</small>
      </section>
    </main>
  );
  if (dataLoading) return <div className="hub-loading"><span /><p>กำลังโหลดข้อมูลของคุณ...</p></div>;
  if (dataError) return (
    <main className="customer-hub hub-error-state">
      <span>!</span><h1>โหลดข้อมูลไม่สำเร็จ</h1><p>{dataError}</p>
      <button type="button" onClick={() => void loadCustomerData()}>ลองใหม่</button>
    </main>
  );

  return (
    <main className="customer-hub">
      <header className="hub-header">
        <span className="hub-logo">err<span>·</span>day</span>
        <div className="hub-profile">
          {liff.isLoggedIn && <span className="line-pill"><i /> LINE</span>}
          {liff.profile?.pictureUrl ? <Image src={liff.profile.pictureUrl} alt="" width={36} height={36} className="hub-avatar" unoptimized /> : <span className="hub-avatar hub-initial">{displayName[0]}</span>}
        </div>
      </header>

      <div className="hub-scroll" ref={scrollRef}>
        {tab === "home" && <>
          <section className="welcome"><p>WELCOME BACK</p><h1>สวัสดี {displayName}</h1>{customer?.phone && <span>{customer.phone}</span>}</section>
          <div className="welcome-wave" />
          <section className="hub-section entitlement">
            {membership?.membership ? <div className="member-card">
              <span className="foil" /><div className="card-top"><div><small>ERR.DAY MEMBER</small><h2>{membership.membership.label || "สมาชิก err.day"}</h2></div><b>{membership.membership.isExpired ? "หมดอายุ" : "ใช้งานได้"}</b></div>
              <div className="card-stats"><div><small>สมาชิกเหลืออีก</small><strong>{daysUntil(membership.membership.expiresAt)}<em> วัน</em></strong></div><div><small>หมดอายุ</small><span>{membership.membership.expiresAt ? thaiDate(membership.membership.expiresAt) : "ไม่กำหนด"}</span></div></div>
            </div> : activePackage ? <div className="package-card"><small>ERR.DAY PACKAGE</small><h2>{activePackage.nameTh}</h2><div className="card-stats"><strong>{activePackage.usagesLeft}<em> / {activePackage.usageLimit} ครั้ง</em></strong><span>หมดอายุ {thaiDate(activePackage.expiresAt)}</span></div></div> : <div className="empty-card"><small>ERR.DAY MEMBER</small><h2>ยังไม่มีสมาชิกหรือแพ็กเกจ</h2><p>สมัครสมาชิกเพื่อรับราคาพิเศษและสิทธิประโยชน์จาก err.day</p><Link href="/liff/membership/signup">ดูแพ็กเกจสมาชิก</Link></div>}
          </section>

          <section className="hub-section booking-priority">
            <button type="button" onClick={() => setTab("book")}>
              <span className="booking-icon"><CalendarDays /></span>
              <span><strong>จองคิว</strong><small>เลือกสาขาและเวลาที่สะดวก</small></span>
              <b>เริ่มจอง <span aria-hidden="true">›</span></b>
            </button>
          </section>

          <section className="hub-section"><div className="section-heading"><div><h2>นัดหมายถัดไป</h2><p>Next appointment</p></div><button onClick={() => setTab("history")}>ดูทั้งหมด</button></div>
            {upcoming ? <article className="appointment"><div className="appointment-title"><div><h3>{upcoming.service.nameTh || upcoming.service.name}</h3><p>{upcoming.service.category}</p></div><span>{STATUS[upcoming.status] || upcoming.status}</span></div><p><MapPin /> {upcoming.branch.name}</p><p><CalendarDays /> {thaiDate(upcoming.date)}</p><p><Clock3 /> {upcoming.startTime} — {upcoming.endTime} น.</p><Link href="/my-bookings">จัดการนัดหมาย</Link></article> : <div className="empty-appointment"><CalendarDays /><p>ยังไม่มีนัดหมายที่กำลังจะมาถึง</p><button onClick={() => setTab("book")}>จองคิวเลย</button></div>}
          </section>

          <section className="hub-section"><button className={`tarot-teaser${tarotEnabled ? "" : " coming-soon"}`} disabled={!tarotEnabled} onClick={() => setTab("tarot")}><span className="mini-card"><Star /></span><span><small>{tarotEnabled ? "DAILY READING" : "COMING SOON"}</small><strong>{tarotEnabled ? "ดวงวันนี้ของคุณ" : "ดูดวง เร็ว ๆ นี้"}</strong><em>{tarotEnabled ? "เลือกไพ่ 3 ใบ เพื่ออ่านความรัก การงาน และการเงิน" : "ฟีเจอร์ดูดวงกำลังเตรียมเปิดให้บริการ"}</em></span>{tarotEnabled ? <b>›</b> : <b className="soon-badge">เร็ว ๆ นี้</b>}</button></section>
        </>}

        {tab === "book" && <section className="hub-section tab-page"><small>BOOK AN APPOINTMENT</small><h1>เลือกสาขาเพื่อจองคิว</h1><p>เลือกสาขาที่สะดวก แล้วทำรายการจองในขั้นตอนถัดไป</p><div className="branch-list">{branches.map(branch => <article key={branch.id}><div><h2>{branch.name}</h2><p><MapPin /> {branch.address}</p></div>{branch.bookingEnabled ? <Link href={`/book/${branch.id}`}>เลือกสาขานี้</Link> : <span>เร็วๆ นี้</span>}</article>)}</div></section>}

        {tab === "history" && <section className="hub-section tab-page"><small>YOUR VISITS</small><h1>ประวัติการจอง</h1><p>ดูนัดหมายที่กำลังจะมาถึงและประวัติการใช้บริการ</p><div className="history-list">{bookings.length ? bookings.map(b => <article key={b.id}><div><h2>{b.service.nameTh || b.service.name}</h2><p>{b.branch.name}</p><p>{thaiDate(b.date)} · {b.startTime} น.</p></div><span>{STATUS[b.status] || b.status}</span></article>) : <div className="empty-appointment"><Clock3 /><p>ยังไม่มีประวัติการจอง</p></div>}</div></section>}

        {tab === "tarot" && <section className="tarot-page"><div className="tarot-title"><span>✦ ERR.DAY TAROT ✦</span><h1>ดูดวงแบบละเอียด</h1><p>เลือกไพ่ตามความรู้สึก 3 ใบ สำหรับความรัก การงาน และการเงิน</p></div>
          {customer?.dateOfBirth && <div className="birthday"><span>วันเกิดของคุณ</span><strong>{thaiDate(customer.dateOfBirth)}</strong><small>บันทึกไว้จากโปรไฟล์สมาชิก</small></div>}
          <div className="deck-box"><div className="step-title"><b>1</b><span>เลือกไพ่ 3 ใบ</span><em>{selected.length}/3</em></div><p>ลำดับที่เลือก: ความรัก · การงาน · การเงิน</p><div className="tarot-deck">{DECK.map(card => { const order = selected.indexOf(card.id); return <button type="button" key={card.id} onClick={() => toggleCard(card.id)} className={order >= 0 ? "selected" : ""} aria-label={`เลือกไพ่ ${card.name}`} aria-pressed={order >= 0}><span className="card-back">✦</span><span className="card-front"><Image src={card.image} alt={card.name} fill sizes="100px" /><i>{card.name}</i></span>{order >= 0 && <b>{order + 1}</b>}</button>})}</div></div>
          <button className="reveal" disabled={selected.length !== 3 || readingBusy} onClick={reveal}><Sparkles /> {readingBusy ? "กำลังเปิดคำทำนาย..." : selected.length === 3 ? "เปิดคำทำนายแบบละเอียด" : `เลือกไพ่อีก ${3 - selected.length} ใบ`}</button>
          {readingError && <div className="reading-error" role="alert" aria-live="polite">{readingError}</div>}
          {reading && <div className="reading"><div className="reading-divider">YOUR READING</div>{[{ icon: "♡", title: "ความรัก", body: reading.love }, { icon: "✦", title: "การงาน", body: reading.career }, { icon: "฿", title: "การเงิน", body: reading.finance }].map(item => <article key={item.title}><span>{item.icon}</span><div><h2>{item.title}</h2><p>{item.body}</p></div></article>)}<p className="provider">คำทำนายโดย AstrologyAPI · ใช้เพื่อความบันเทิงและการสะท้อนตนเอง</p></div>}
        </section>}
      </div>

      <nav className="hub-tabs" aria-label="เมนูลูกค้า">{[
        ["home", CreditCard, "สมาชิก"], ["book", CalendarDays, "จองคิว"], ["history", Clock3, "ประวัติ"], ["tarot", Sparkles, "ดูดวง"],
      ].map(([id, Icon, label]) => {
        const disabled = id === "tarot" && !tarotEnabled;
        return <button type="button" key={String(id)} disabled={disabled} onClick={() => setTab(id as Tab)} className={`${tab === id ? "active " : ""}${id === "book" ? "booking-tab" : ""}`} aria-current={tab === id ? "page" : undefined} aria-label={disabled ? "ดูดวง เร็ว ๆ นี้" : String(label)}><Icon /><span>{String(label)}</span></button>;
      })}</nav>
    </main>
  );
}
