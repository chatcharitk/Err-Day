import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import AdminActions from "./AdminActions";

export const dynamic = "force-dynamic";

function formatPrice(satang: number) {
  return `฿${(satang / 100).toLocaleString()}`;
}

const STATUS_TH: Record<string, string> = {
  PENDING: "รอยืนยัน",
  CONFIRMED: "ยืนยันแล้ว",
  CANCELLED: "ยกเลิก",
  COMPLETED: "เสร็จสิ้น",
  NO_SHOW: "ไม่มา",
};

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  PENDING:   { bg: "#FFF8E8", color: "#B45309" },
  CONFIRMED: { bg: "#ECFDF5", color: "#065F46" },
  CANCELLED: { bg: "#FEF2F2", color: "#991B1B" },
  COMPLETED: { bg: "#F5F0EC", color: "#5C4A42" },
  NO_SHOW:   { bg: "#FEF2F2", color: "#7C3AED" },
};

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ branchId?: string }>;
}) {
  const { branchId } = await searchParams;

  const [branches, bookings] = await Promise.all([
    prisma.branch.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.booking.findMany({
      where: branchId ? { branchId } : undefined,
      include: { branch: true, service: true, staff: true, customer: true },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    }),
  ]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcoming = bookings.filter((b) => new Date(b.date) >= today);
  const past = bookings.filter((b) => new Date(b.date) < today);
  const pending = bookings.filter((b) => b.status === "PENDING");
  const totalRevenue = bookings
    .filter((b) => b.status === "COMPLETED")
    .reduce((sum, b) => sum + b.totalPrice, 0);

  return (
    <div className="px-8 py-8">
      {/* Page header */}
      <div className="mb-8">
        <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "#A08070" }}>Dashboard</p>
        <h1 className="text-2xl font-medium" style={{ color: "#3B2A24" }}>ภาพรวม</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "การจองที่กำลังมา", labelEn: "Upcoming", value: upcoming.length },
          { label: "รอยืนยัน", labelEn: "Pending", value: pending.length, highlight: pending.length > 0 },
          { label: "รายรับรวม (เสร็จสิ้น)", labelEn: "Revenue", value: formatPrice(totalRevenue) },
        ].map(({ label, labelEn, value, highlight }) => (
          <div
            key={label}
            className="rounded-2xl bg-white p-5"
            style={{ border: "1.5px solid #E8D8CC" }}
          >
            <p
              className="text-2xl font-semibold mb-1"
              style={{ color: highlight ? "#8B1D24" : "#3B2A24" }}
            >
              {value}
            </p>
            <p className="text-sm" style={{ color: "#6B5245" }}>{label}</p>
            <p className="text-xs" style={{ color: "#A08070" }}>{labelEn}</p>
          </div>
        ))}
      </div>

      {/* Branch filter */}
      <div className="mb-6">
        <AdminActions branches={branches} currentBranchId={branchId} />
      </div>

      {/* Upcoming bookings */}
      <div className="rounded-2xl bg-white mb-6 overflow-hidden" style={{ border: "1.5px solid #E8D8CC" }}>
        <div className="px-6 py-4" style={{ borderBottom: "1px solid #F0E4D8" }}>
          <h2 className="font-medium text-sm" style={{ color: "#3B2A24" }}>
            การจองที่กำลังมา <span style={{ color: "#A08070" }}>({upcoming.length})</span>
          </h2>
        </div>
        {upcoming.length === 0 ? (
          <p className="text-center py-8 text-sm" style={{ color: "#A08070" }}>ไม่มีการจอง</p>
        ) : (
          <div className="divide-y" style={{ borderColor: "#F5EFE9" }}>
            {upcoming.map((b) => {
              const sc = STATUS_COLORS[b.status] ?? STATUS_COLORS.PENDING;
              return (
                <div key={b.id} className="px-6 py-4 flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="font-medium text-sm" style={{ color: "#3B2A24" }}>{b.customer.name}</p>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ backgroundColor: sc.bg, color: sc.color }}
                      >
                        {STATUS_TH[b.status] ?? b.status}
                      </span>
                    </div>
                    <p className="text-sm" style={{ color: "#6B5245" }}>{b.service.nameTh || b.service.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: "#A08070" }}>
                      {new Date(b.date).toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short" })}
                      {" · "}{b.startTime}–{b.endTime}
                      {b.staff && ` · ${b.staff.name}`}
                    </p>
                    <p className="text-xs" style={{ color: "#A08070" }}>
                      {b.branch.name} · {b.customer.phone}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-semibold text-sm" style={{ color: "#8B1D24" }}>{formatPrice(b.totalPrice)}</p>
                    <p className="text-xs font-mono mt-0.5" style={{ color: "#C4B0A4" }}>#{b.id.slice(-6).toUpperCase()}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Past bookings */}
      {past.length > 0 && (
        <div className="rounded-2xl bg-white overflow-hidden" style={{ border: "1.5px solid #E8D8CC" }}>
          <div className="px-6 py-4" style={{ borderBottom: "1px solid #F0E4D8" }}>
            <h2 className="font-medium text-sm" style={{ color: "#A08070" }}>
              ที่ผ่านมา <span>({past.length})</span>
            </h2>
          </div>
          <div className="divide-y" style={{ borderColor: "#F5EFE9" }}>
            {past.map((b) => {
              const sc = STATUS_COLORS[b.status] ?? STATUS_COLORS.COMPLETED;
              return (
                <div key={b.id} className="px-6 py-3 flex items-start justify-between gap-4 opacity-70">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <p className="font-medium text-sm" style={{ color: "#3B2A24" }}>{b.customer.name}</p>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ backgroundColor: sc.bg, color: sc.color }}
                      >
                        {STATUS_TH[b.status] ?? b.status}
                      </span>
                    </div>
                    <p className="text-xs" style={{ color: "#A08070" }}>
                      {b.service.nameTh || b.service.name} · {new Date(b.date).toLocaleDateString("th-TH", { day: "numeric", month: "short" })} {b.startTime}
                    </p>
                  </div>
                  <p className="text-sm flex-shrink-0" style={{ color: "#6B5245" }}>{formatPrice(b.totalPrice)}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
