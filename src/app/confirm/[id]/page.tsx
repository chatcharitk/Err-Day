import { notFound } from "next/navigation";
import Link from "next/link";
import { CheckCircle, MapPin, Phone, Clock, Calendar, User } from "lucide-react";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

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
    <main className="min-h-screen" style={{ backgroundColor: "#FFFAF7" }}>
      <div className="max-w-lg mx-auto px-6 py-16 text-center">
        <div className="flex justify-center mb-4">
          <CheckCircle className="w-16 h-16" style={{ color: "#B52F3A" }} />
        </div>
        <h1 className="text-2xl font-medium mb-2" style={{ color: "#45352F" }}>จองคิวสำเร็จ!</h1>
        <p className="mb-2" style={{ color: "#6F574D" }}>เราตั้งตารอต้อนรับคุณ</p>
        <p className="text-sm mb-8" style={{ color: "#977A6F" }}>Booking Confirmed — เราจะแจ้งเตือนคุณก่อนวันนัด</p>

        {/* ── Branch map ── */}
        {(() => {
          const { mapLat, mapLng, mapUrl, address } = booking.branch;
          // Use precise coordinates when available; otherwise fall back to address search
          const embedSrc = mapLat && mapLng
            ? `https://maps.google.com/maps?q=${mapLat},${mapLng}&output=embed&hl=th&z=17`
            : `https://maps.google.com/maps?q=${encodeURIComponent(address)}&output=embed&hl=th&z=16`;
          const mapsLink = mapUrl ?? `https://maps.google.com/maps?q=${encodeURIComponent(address)}`;
          return (
            <div className="rounded-2xl overflow-hidden mb-6" style={{ border: "1.5px solid #EADDD4" }}>
              <iframe
                title={`แผนที่ ${booking.branch.name}`}
                width="100%"
                height="200"
                style={{ border: 0, display: "block" }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                src={embedSrc}
              />
              <div className="px-4 py-3 flex items-center gap-2" style={{ backgroundColor: "#FFFBF8" }}>
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#B52F3A" }} />
                <p className="text-xs flex-1 truncate" style={{ color: "#6F574D" }}>{address}</p>
                <a
                  href={mapsLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium flex-shrink-0"
                  style={{ color: "#B52F3A" }}
                >
                  เปิดใน Google Maps →
                </a>
              </div>
            </div>
          );
        })()}

        <div className="rounded-2xl bg-white text-left mb-6 overflow-hidden" style={{ border: "1.5px solid #EADDD4" }}>
          {/* Card header strip */}
          <div className="px-6 py-3 flex items-center justify-between" style={{ backgroundColor: "#B52F3A" }}>
            <span className="text-xs font-semibold uppercase tracking-widest text-white/70">หมายเลขการจอง</span>
            <span className="text-xs font-mono text-white">{booking.id.slice(-8).toUpperCase()}</span>
          </div>
          <div className="px-6 pt-5 pb-6 space-y-4">
            <span
              className="inline-block text-xs font-medium px-2.5 py-1 rounded-full"
              style={{ backgroundColor: "#FFF3ED", color: "#B52F3A" }}
            >
              {booking.status === "PENDING" ? "รอยืนยัน" : booking.status}
            </span>

            <hr style={{ borderColor: "#F1E4DC" }} />

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "#D8B4A3" }} />
                <div>
                  <p className="font-medium text-sm" style={{ color: "#45352F" }}>{booking.branch.name}</p>
                  <p className="text-xs" style={{ color: "#977A6F" }}>{booking.branch.address}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 flex-shrink-0" style={{ color: "#D8B4A3" }} />
                <p className="text-sm" style={{ color: "#45352F" }}>{dateStr}</p>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 flex-shrink-0" style={{ color: "#D8B4A3" }} />
                <p className="text-sm" style={{ color: "#45352F" }}>{booking.startTime} — {booking.endTime} น.</p>
              </div>
              <div className="flex items-center gap-3">
                <User className="w-4 h-4 flex-shrink-0" style={{ color: "#D8B4A3" }} />
                <p className="text-sm" style={{ color: "#45352F" }}>{booking.staff?.name ?? "ช่างที่ว่างในขณะนั้น"}</p>
              </div>
            </div>

            <hr style={{ borderColor: "#F1E4DC" }} />

            {[
              ["บริการ", booking.service.nameTh || booking.service.name],
              ["ชื่อผู้จอง", booking.customer.name],
              ["โทรศัพท์", booking.customer.phone],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between">
                <span className="text-sm" style={{ color: "#977A6F" }}>{label}</span>
                <span className="font-medium text-sm" style={{ color: "#45352F" }}>{value}</span>
              </div>
            ))}

          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Link
            href="/my-bookings"
            className="flex items-center justify-center w-full py-3 rounded-xl text-white font-medium transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#B52F3A" }}
          >
            จัดการการจองของฉัน
          </Link>
          <Link
            href="/"
            className="flex items-center justify-center w-full py-3 rounded-xl font-medium border-2 transition-colors"
            style={{ borderColor: "#D8B4A3", color: "#6F574D" }}
          >
            จองคิวอีกครั้ง
          </Link>
        </div>

        <p className="text-xs mt-6 flex items-center justify-center gap-1" style={{ color: "#977A6F" }}>
          <Phone className="w-3 h-3" /> โทร: {booking.branch.phone}
        </p>
      </div>
    </main>
  );
}
