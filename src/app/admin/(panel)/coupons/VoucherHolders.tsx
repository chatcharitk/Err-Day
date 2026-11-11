import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PACKAGE_SPECS, VOUCHER_USED_PREFIX } from "@/lib/packages";
import { VOUCHER_SKUS } from "@/lib/voucher-skus";

const TEXT = "#3B2A24", MUTED = "#A08070", BORDER = "#E8D8CC";

const baht = (s: number) => `฿${(s / 100).toLocaleString("th-TH")}`;
const day = (d: Date) => d.toLocaleDateString("th-TH", { day: "numeric", month: "short", timeZone: "Asia/Bangkok" });

type Status = { label: string; bg: string; fg: string };
const ST: Record<string, Status> = {
  open:    { label: "ยังไม่ใช้", bg: "#EFF6FF", fg: "#1D4ED8" },
  used:    { label: "ใช้แล้ว", bg: "#DCFCE7", fg: "#15803D" },
  expired: { label: "หมดอายุ", bg: "#F3F4F6", fg: "#6B7280" },
  closed:  { label: "ยกเลิก", bg: "#FEE2E2", fg: "#B91C1C" },
};

/** Prepaid vouchers (e.g. 11.11 PJOLI) — who bought one, and whether it's been used. */
export default async function VoucherHolders({ compact }: { compact?: boolean }) {
  const rows = await prisma.customerPackage.findMany({
    where: { packageSku: { in: VOUCHER_SKUS } },
    orderBy: { startedAt: "desc" },
    include: { customer: { select: { id: true, name: true, nickname: true, phone: true } } },
  });
  if (rows.length === 0 && !VOUCHER_SKUS.some(s => PACKAGE_SPECS[s]?.expiresOn && PACKAGE_SPECS[s].expiresOn! >= new Date().toISOString().slice(0, 10))) {
    return null;
  }

  const usedOn = (notes: string | null) =>
    notes?.startsWith(VOUCHER_USED_PREFIX) ? notes.slice(VOUCHER_USED_PREFIX.length) : null;
  const bookingIds = [...new Set(rows.flatMap(r => [r.bookingId, usedOn(r.notes)]).filter((x): x is string => !!x))];
  const bookings = new Map(
    (await prisma.booking.findMany({
      where: { id: { in: bookingIds } },
      select: { id: true, date: true, paidAt: true, branch: { select: { name: true } } },
    })).map(b => [b.id, b]),
  );

  const now = new Date();
  const items = rows.map(r => {
    const status = r.closedAt ? "closed"
      : r.usageLimit > 0 && r.usagesUsed >= r.usageLimit ? "used"
      : r.expiresAt < now ? "expired" : "open";
    const bought = r.bookingId ? bookings.get(r.bookingId) : undefined;
    const usedId = usedOn(r.notes);
    const used = usedId ? bookings.get(usedId) : undefined;
    return { r, status, bought, used, usedId };
  });

  const sold = items.filter(i => i.status !== "closed");
  const revenue = sold.reduce((s, i) => s + i.r.paidAmount, 0);
  const usedCount = sold.filter(i => i.status === "used").length;
  const openCount = sold.filter(i => i.status === "open").length;

  const bookingHref = (id: string) => compact ? `/admin/m/${id}` : `/admin/bookings/${id}`;
  const customerHref = (id: string) => compact ? `/admin/m/customers/${id}` : `/admin/customers/${id}`;
  const branchShort = (n?: string) => n?.replace(/^err\.day\s*สาขา/, "") ?? "";

  return (
    <div className={compact ? "px-4 pb-6" : "px-6 pb-8 max-w-6xl"}>
      <section className={compact ? "rounded-2xl bg-white p-4" : "rounded-2xl bg-white p-5"} style={{ border: `1px solid ${BORDER}` }}>
        <h2 className="text-lg font-semibold" style={{ color: TEXT }}>🎫 บัตรซื้อเก็บ (ซื้อแล้วมาใช้ทีหลัง)</h2>
        <p className="text-xs mt-1 mb-4" style={{ color: MUTED }}>
          {VOUCHER_SKUS.map(s => PACKAGE_SPECS[s]?.shortDescTh).filter(Boolean).join(" · ")} — ขายที่ POS หมวดแพ็กเกจ ระบบตัดสิทธิ์ให้เองเมื่อเลือกลูกค้า
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          {[
            ["ขายแล้ว", `${sold.length} ใบ`],
            ["ยอดขาย", baht(revenue)],
            ["ใช้แล้ว", `${usedCount} ใบ`],
            ["ยังไม่ใช้", `${openCount} ใบ`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl p-3" style={{ background: "#F9F4F0" }}>
              <p className="text-[11px]" style={{ color: MUTED }}>{k}</p>
              <p className="text-base font-semibold" style={{ color: TEXT }}>{v}</p>
            </div>
          ))}
        </div>

        {items.length === 0 ? (
          <p className="text-sm py-4 text-center" style={{ color: MUTED }}>ยังไม่มีลูกค้าซื้อ</p>
        ) : compact ? (
          <div className="space-y-2">
            {items.map(({ r, status, bought, used, usedId }) => (
              <div key={r.id} className="rounded-xl p-3" style={{ border: `1px solid ${BORDER}` }}>
                <div className="flex items-start justify-between gap-2">
                  <Link href={customerHref(r.customer.id)} className="font-medium text-sm underline-offset-2 hover:underline" style={{ color: TEXT }}>
                    {r.customer.nickname || r.customer.name}
                  </Link>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: ST[status].bg, color: ST[status].fg }}>{ST[status].label}</span>
                </div>
                <p className="text-xs mt-1" style={{ color: MUTED }}>
                  ซื้อ {day(r.startedAt)} {branchShort(bought?.branch.name)} · {baht(r.paidAmount)}
                  {r.bookingId && <> · <Link href={bookingHref(r.bookingId)} className="underline">บิลซื้อ</Link></>}
                </p>
                <p className="text-xs" style={{ color: MUTED }}>
                  {status === "used"
                    ? <>ใช้ {used ? `${day(used.date)} ${branchShort(used.branch.name)}` : ""}{usedId && <> · <Link href={bookingHref(usedId)} className="underline">บิลที่ใช้</Link></>}</>
                    : <>ใช้ได้ถึง {day(r.expiresAt)}</>}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs" style={{ color: MUTED }}>
                  {["ลูกค้า", "เบอร์", "ซื้อเมื่อ", "สาขา", "จ่าย", "สถานะ", "ใช้เมื่อ / ใช้ได้ถึง", ""].map(h => (
                    <th key={h} className="py-2 pr-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map(({ r, status, bought, used, usedId }) => (
                  <tr key={r.id} style={{ borderTop: `1px solid ${BORDER}`, color: TEXT }}>
                    <td className="py-2 pr-3">
                      <Link href={customerHref(r.customer.id)} className="hover:underline">{r.customer.nickname || r.customer.name}</Link>
                    </td>
                    <td className="py-2 pr-3" style={{ color: MUTED }}>{r.customer.phone}</td>
                    <td className="py-2 pr-3">{day(r.startedAt)}</td>
                    <td className="py-2 pr-3">{branchShort(bought?.branch.name)}</td>
                    <td className="py-2 pr-3">{baht(r.paidAmount)}</td>
                    <td className="py-2 pr-3">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: ST[status].bg, color: ST[status].fg }}>{ST[status].label}</span>
                    </td>
                    <td className="py-2 pr-3">
                      {status === "used"
                        ? <>{used ? `${day(used.date)} ${branchShort(used.branch.name)}` : "ใช้แล้ว"}{usedId && <> · <Link href={bookingHref(usedId)} className="underline text-xs">บิลที่ใช้</Link></>}</>
                        : <span style={{ color: MUTED }}>ถึง {day(r.expiresAt)}</span>}
                    </td>
                    <td className="py-2 text-xs">
                      {r.bookingId && <Link href={bookingHref(r.bookingId)} className="underline" style={{ color: MUTED }}>บิลซื้อ</Link>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
