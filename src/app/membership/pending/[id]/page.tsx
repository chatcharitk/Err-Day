import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, MapPin, Phone, AlertCircle, CalendarDays } from "lucide-react";
export const dynamic = "force-dynamic";

const PRIMARY = "#8B1D24";
const TEXT    = "#3B2A24";
const MUTED   = "#A08070";
const BORDER  = "#E8D8CC";
const BG      = "#FDF7F2";

const PRODUCT_INFO: Record<string, { name: string; priceTh: string; validityTh: string; perkTh: string }> = {
  membership: {
    name:       "สมาชิกรายเดือน",
    priceTh:    "฿990",
    validityTh: "30 วัน",
    perkTh:     "ราคาพิเศษทุกบริการ — สระไดร์เริ่ม ฿100",
  },
  buffet: {
    name:       "Buffet 30 วัน",
    priceTh:    "฿3,500",
    validityTh: "30 วัน",
    perkTh:     "สระไดร์ไม่จำกัด ตลอด 30 วัน",
  },
  "5pack": {
    name:       "แพ็กเกจ 5 ครั้ง",
    priceTh:    "฿1,600",
    validityTh: "90 วัน",
    perkTh:     "สระไดร์ 5 ครั้ง ใช้ได้ภายใน 90 วัน",
  },
};

export default async function PendingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ p?: string }>;
}) {
  const { id } = await params;
  const { p } = await searchParams;
  const productKey = p && PRODUCT_INFO[p] ? p : "membership";
  const productInfo = PRODUCT_INFO[productKey];

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      membership: { include: { tier: true } },
    },
  });

  if (!customer) notFound();

  // Only short-circuit if they signed up for "membership" AND already hold an active one.
  // Buying a package while you also hold a membership is fine — they stack.
  const m = customer.membership;
  const now = new Date();
  const expired = m?.expiresAt != null && new Date(m.expiresAt) <= now;
  const usedUp  = m && m.usagesAllowed > 0 && m.usagesUsed >= m.usagesAllowed;
  const isActiveMember = productKey === "membership" && !!m && !expired && !usedUp;

  return (
    <main className="min-h-screen" style={{ background: BG }}>
      <div className="max-w-md mx-auto px-5 py-8">
        <Link
          href="/membership"
          className="inline-flex items-center gap-1.5 text-sm mb-6"
          style={{ color: MUTED }}
        >
          <ArrowLeft size={14} />
          กลับ
        </Link>

        {isActiveMember ? (
          /* Already paid-up case */
          <div
            className="rounded-3xl p-6 text-white text-center"
            style={{ background: `linear-gradient(135deg, #166534, #14532d)` }}
          >
            <CheckCircle2 size={48} className="mx-auto mb-3" />
            <h1 className="text-xl font-medium mb-1">คุณเป็นสมาชิกอยู่แล้ว</h1>
            <p className="text-sm opacity-90">{customer.name}</p>
            <Link
              href="/my-bookings"
              className="inline-flex items-center gap-1.5 mt-5 px-5 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: "white", color: "#166534" }}
            >
              <CalendarDays size={14} />
              ดูสถานะที่การจองของฉัน
            </Link>
          </div>
        ) : (
          <>
            {/* Success header */}
            <div
              className="rounded-3xl p-6 mb-5 text-white"
              style={{ background: `linear-gradient(135deg, ${PRIMARY}, #5d1318)` }}
            >
              <CheckCircle2 size={36} className="mb-3" />
              <h1 className="text-xl font-medium leading-tight mb-1">
                ลงทะเบียนสำเร็จ! 🎉
              </h1>
              <p className="text-sm opacity-90">
                กรุณาชำระเงิน {productInfo.priceTh} ที่หน้าร้านเพื่อเปิดใช้บริการ
              </p>
            </div>

            {/* Selected product card */}
            <div
              className="rounded-2xl p-4 mb-5 flex items-center gap-3"
              style={{ background: "#FFF8F4", border: `1.5px solid ${PRIMARY}` }}
            >
              <div
                className="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center font-bold"
                style={{ background: PRIMARY, color: "white" }}
              >
                {productInfo.priceTh}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs uppercase tracking-widest font-semibold mb-0.5" style={{ color: PRIMARY }}>
                  รายการที่เลือก
                </p>
                <p className="text-sm font-semibold" style={{ color: TEXT }}>{productInfo.name}</p>
                <p className="text-xs mt-0.5" style={{ color: MUTED }}>{productInfo.perkTh} · ใช้ได้ {productInfo.validityTh}</p>
              </div>
            </div>

            {/* Customer info card */}
            <div
              className="rounded-2xl bg-white p-5 mb-5"
              style={{ border: `1.5px solid ${BORDER}` }}
            >
              <p className="text-xs uppercase tracking-widest mb-3 font-semibold" style={{ color: PRIMARY }}>
                ข้อมูลลงทะเบียน
              </p>
              <div className="space-y-2">
                <div>
                  <p className="text-xs" style={{ color: MUTED }}>ชื่อ</p>
                  <p className="text-sm font-medium" style={{ color: TEXT }}>{customer.name}</p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: MUTED }}>เบอร์โทร — แสดงให้พนักงานเพื่อค้นหา</p>
                  <p className="text-base font-bold tracking-wide" style={{ color: PRIMARY }}>{customer.phone}</p>
                </div>
              </div>
            </div>

            {/* Instructions */}
            <div
              className="rounded-2xl p-5 mb-5"
              style={{ background: "#FFF8F4", border: `1.5px solid ${BORDER}` }}
            >
              <p className="text-xs uppercase tracking-widest mb-3 font-semibold" style={{ color: PRIMARY }}>
                ขั้นตอนต่อไป
              </p>
              <ol className="space-y-3 text-sm" style={{ color: TEXT }}>
                {[
                  "ไปที่ err.day Salon ทุกสาขา",
                  "แสดงหน้านี้ให้พนักงานเห็น",
                  `พนักงานจะค้นหาด้วยเบอร์โทร และคิดเงิน ${productInfo.priceTh} ผ่านระบบ POS`,
                  `เมื่อชำระเสร็จ ${productInfo.name} จะเริ่มมีผลทันที (ใช้ได้ ${productInfo.validityTh})`,
                ].map((step, i) => (
                  <li key={i} className="flex gap-3">
                    <span
                      className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                      style={{ background: PRIMARY }}
                    >
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Note */}
            <div
              className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs mb-5"
              style={{ background: "#FFFBEB", color: "#92400e" }}
            >
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
              <p>
                {productInfo.name}จะยังไม่ active จนกว่าจะชำระเงินที่ร้าน — หากเปลี่ยนใจไม่จำเป็นต้องทำอะไร
              </p>
            </div>

          </>
        )}

        {/* Branch contact */}
        <div className="mt-6 text-xs space-y-1.5" style={{ color: MUTED }}>
          <p className="flex items-center gap-1.5">
            <MapPin size={11} /> err.day Salon ทุกสาขา
          </p>
          <p className="flex items-center gap-1.5">
            <Phone size={11} /> สอบถามที่ร้าน
          </p>
        </div>
      </div>
    </main>
  );
}
