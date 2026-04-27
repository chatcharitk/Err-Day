import { notFound } from "next/navigation";
import Link from "next/link";
import { CheckCircle, MapPin, Phone, Clock, Calendar, User } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function formatPrice(satang: number) {
  return `฿${(satang / 100).toLocaleString()}`;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  CONFIRMED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
  COMPLETED: "bg-stone-100 text-stone-700",
  NO_SHOW: "bg-red-100 text-red-700",
};

export default async function ConfirmPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { branch: true, service: true, staff: true, customer: true },
  });

  if (!booking) notFound();

  const dateStr = new Date(booking.date).toLocaleDateString("th-TH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <main className="min-h-screen" style={{ backgroundColor: "#FDF8F3" }}>
      <div className="max-w-lg mx-auto px-6 py-16 text-center">
        <div className="flex justify-center mb-4">
          <CheckCircle className="w-16 h-16" style={{ color: "#8B1D24" }} />
        </div>
        <h1 className="text-2xl font-medium mb-2" style={{ color: "#3B2A24" }}>จองคิวสำเร็จ!</h1>
        <p className="mb-2" style={{ color: "#6B5245" }}>เราตั้งตารอต้อนรับคุณ</p>
        <p className="text-sm mb-8" style={{ color: "#A08070" }}>Booking Confirmed — เราจะแจ้งเตือนคุณก่อนวันนัด</p>

        {/* ── Branch map ── */}
        {(() => {
          const { mapLat, mapLng, mapUrl, address } = booking.branch;
          // Use precise coordinates when available; otherwise fall back to address search
          const embedSrc = mapLat && mapLng
            ? `https://maps.google.com/maps?q=${mapLat},${mapLng}&output=embed&hl=th&z=17`
            : `https://maps.google.com/maps?q=${encodeURIComponent(address)}&output=embed&hl=th&z=16`;
          const mapsLink = mapUrl ?? `https://maps.google.com/maps?q=${encodeURIComponent(address)}`;
          return (
            <div className="rounded-2xl overflow-hidden mb-6" style={{ border: "1.5px solid #E8D8CC" }}>
              <iframe
                title={`แผนที่ ${booking.branch.name}`}
                width="100%"
                height="200"
                style={{ border: 0, display: "block" }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                src={embedSrc}
              />
              <div className="px-4 py-3 flex items-center gap-2" style={{ backgroundColor: "#FFF8F4" }}>
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#8B1D24" }} />
                <p className="text-xs flex-1 truncate" style={{ color: "#6B5245" }}>{address}</p>
                <a
                  href={mapsLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium flex-shrink-0"
                  style={{ color: "#8B1D24" }}
                >
                  เปิดใน Google Maps →
                </a>
              </div>
            </div>
          );
        })()}

        <div className="rounded-2xl bg-white text-left mb-6 overflow-hidden" style={{ border: "1.5px solid #E8D8CC" }}>
          {/* Card header strip */}
          <div className="px-6 py-3 flex items-center justify-between" style={{ backgroundColor: "#8B1D24" }}>
            <span className="text-xs font-semibold uppercase tracking-widest text-white/70">หมายเลขการจอง</span>
            <span className="text-xs font-mono text-white">{booking.id.slice(-8).toUpperCase()}</span>
          </div>
          <div className="px-6 pt-5 pb-6 space-y-4">
            <span
              className="inline-block text-xs font-medium px-2.5 py-1 rounded-full"
              style={{ backgroundColor: "#FFF0E8", color: "#8B1D24" }}
            >
              {booking.status === "PENDING" ? "รอยืนยัน" : booking.status}
            </span>

            <hr style={{ borderColor: "#F0E4D8" }} />

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "#D6BCAE" }} />
                <div>
                  <p className="font-medium text-sm" style={{ color: "#3B2A24" }}>{booking.branch.name}</p>
                  <p className="text-xs" style={{ color: "#A08070" }}>{booking.branch.address}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 flex-shrink-0" style={{ color: "#D6BCAE" }} />
                <p className="text-sm" style={{ color: "#3B2A24" }}>{dateStr}</p>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 flex-shrink-0" style={{ color: "#D6BCAE" }} />
                <p className="text-sm" style={{ color: "#3B2A24" }}>{booking.startTime} — {booking.endTime} น.</p>
              </div>
              <div className="flex items-center gap-3">
                <User className="w-4 h-4 flex-shrink-0" style={{ color: "#D6BCAE" }} />
                <p className="text-sm" style={{ color: "#3B2A24" }}>{booking.staff?.name ?? "ช่างที่ว่างในขณะนั้น"}</p>
              </div>
            </div>

            <hr style={{ borderColor: "#F0E4D8" }} />

            {[
              ["บริการ", booking.service.nameTh || booking.service.name],
              ["ชื่อผู้จอง", booking.customer.name],
              ["โทรศัพท์", booking.customer.phone],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between">
                <span className="text-sm" style={{ color: "#A08070" }}>{label}</span>
                <span className="font-medium text-sm" style={{ color: "#3B2A24" }}>{value}</span>
              </div>
            ))}

            <hr style={{ borderColor: "#F0E4D8" }} />

            <div className="flex justify-between items-center">
              <span className="font-semibold" style={{ color: "#5C4A42" }}>ยอดรวม</span>
              <span className="font-bold text-xl" style={{ color: "#8B1D24" }}>{formatPrice(booking.totalPrice)}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Link
            href="/my-bookings"
            className="flex items-center justify-center w-full py-3 rounded-xl text-white font-medium transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#8B1D24" }}
          >
            จัดการการจองของฉัน
          </Link>
          <Link
            href="/"
            className="flex items-center justify-center w-full py-3 rounded-xl font-medium border-2 transition-colors"
            style={{ borderColor: "#D6BCAE", color: "#6B5245" }}
          >
            จองคิวอีกครั้ง
          </Link>
        </div>

        <p className="text-xs mt-6 flex items-center justify-center gap-1" style={{ color: "#A08070" }}>
          <Phone className="w-3 h-3" /> โทร: {booking.branch.phone}
        </p>
      </div>
    </main>
  );
}
