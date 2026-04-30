import Link from "next/link";
import { ArrowLeft, UserPlus, Sparkles, Star, Repeat, CalendarRange, Check } from "lucide-react";

export const metadata = {
  title: "สมาชิก err.day",
};

const PRIMARY = "#8B1D24";
const TEXT    = "#3B2A24";
const MUTED   = "#A08070";
const BORDER  = "#E8D8CC";
const BG      = "#FDF7F2";

const PRODUCTS = [
  {
    icon:       Star,
    name:       "สมาชิกรายเดือน",
    price:      "฿990",
    validity:   "30 วัน",
    perk:       "ราคาพิเศษทุกบริการ — สระไดร์เริ่ม ฿100",
    highlight:  false,
  },
  {
    icon:       Repeat,
    name:       "Buffet 30 วัน",
    price:      "฿3,500",
    validity:   "30 วัน",
    perk:       "สระไดร์ไม่จำกัดครั้ง ตลอด 30 วัน",
    highlight:  true,
  },
  {
    icon:       CalendarRange,
    name:       "แพ็กเกจ 5 ครั้ง",
    price:      "฿1,600",
    validity:   "90 วัน",
    perk:       "สระไดร์ 5 ครั้ง ใช้ได้ภายใน 90 วัน",
    highlight:  false,
  },
];

const SHARED_PERKS = [
  "ชำระเงินที่หน้าร้านแค่ครั้งเดียว",
  "ใช้ได้ทุกสาขา err.day",
  "สะสมประวัติและดูสถานะผ่าน LINE",
];

export default function MembershipLandingPage() {
  return (
    <main className="min-h-screen" style={{ background: BG }}>
      <div className="max-w-md mx-auto px-5 py-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm mb-6"
          style={{ color: MUTED }}
        >
          <ArrowLeft size={14} />
          กลับหน้าแรก
        </Link>

        {/* Hero */}
        <div
          className="rounded-3xl p-6 mb-5 text-white relative overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${PRIMARY}, #5d1318)` }}
        >
          <Sparkles
            size={120}
            className="absolute -right-6 -top-6 opacity-10"
            strokeWidth={1}
          />
          <div className="relative">
            <p className="text-xs uppercase tracking-widest opacity-80 mb-1">err.day Membership &amp; Packages</p>
            <h1 className="text-2xl font-medium leading-tight mb-2">
              เลือกแพ็กเกจที่ใช่สำหรับคุณ
            </h1>
            <p className="text-sm opacity-90 leading-relaxed">
              3 ตัวเลือก — สมาชิกรายเดือน, Buffet ไม่จำกัด, หรือแพ็กเกจ 5 ครั้ง
              <br />
              ลงทะเบียนผ่าน LINE แล้วชำระที่ร้าน
            </p>
          </div>
        </div>

        {/* Product cards */}
        <div className="space-y-3 mb-5">
          {PRODUCTS.map((p) => {
            const Icon = p.icon;
            return (
              <div
                key={p.name}
                className="rounded-2xl bg-white p-4 flex items-start gap-3"
                style={{
                  border: `1.5px solid ${p.highlight ? PRIMARY : BORDER}`,
                  background: p.highlight ? "#FFF8F4" : "white",
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center mt-0.5"
                  style={{ background: p.highlight ? PRIMARY : "#FFF0E8", color: p.highlight ? "white" : PRIMARY }}
                >
                  <Icon size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="font-semibold text-sm" style={{ color: TEXT }}>{p.name}</p>
                    <p className="font-bold text-sm" style={{ color: PRIMARY }}>{p.price}</p>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: MUTED }}>{p.perk}</p>
                  <p
                    className="text-[10px] mt-0.5 font-medium uppercase tracking-wide"
                    style={{ color: MUTED }}
                  >
                    ใช้ได้ {p.validity}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Shared perks */}
        <div
          className="rounded-2xl bg-white p-5 mb-5"
          style={{ border: `1.5px solid ${BORDER}` }}
        >
          <p className="text-xs uppercase tracking-widest mb-3 font-semibold" style={{ color: PRIMARY }}>
            ทุกแพ็กเกจรวมถึง
          </p>
          <ul className="space-y-2.5">
            {SHARED_PERKS.map((b, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm" style={{ color: TEXT }}>
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: "#F0FFF4" }}
                >
                  <Check size={12} style={{ color: "#166534" }} strokeWidth={3} />
                </div>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* CTA */}
        <div className="space-y-2.5">
          <Link
            href="/liff/membership/signup"
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl text-white font-semibold transition-opacity hover:opacity-90"
            style={{ background: PRIMARY }}
          >
            <UserPlus size={18} />
            ลงทะเบียนผ่าน LINE
          </Link>
        </div>

        <p className="text-xs text-center mt-6" style={{ color: MUTED }}>
          เป็นสมาชิกอยู่แล้ว? ดูสถานะได้ที่ &ldquo;การจองของฉัน&rdquo; ใน LINE
        </p>

        <p className="text-xs text-center mt-3" style={{ color: MUTED }}>
          การลงทะเบียนจะมีการขอความยินยอมตาม{" "}
          <Link href="/privacy" className="underline" style={{ color: PRIMARY }}>
            นโยบายความเป็นส่วนตัว
          </Link>
        </p>
      </div>
    </main>
  );
}
