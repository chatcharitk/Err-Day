import { notFound } from "next/navigation";
import MobileTop from "@/components/stock/MobileTop";
import { loadColorCard, loadShadeOptions } from "@/lib/color-card";
import { prisma } from "@/lib/prisma";
import { VISIT_PUBLIC_SELECT, cleanZones } from "@/lib/color";
import ColorCard from "./ColorCard";
import ProfileForm from "./ProfileForm";
import VisitEditor from "./VisitEditor";
import PrintCard from "./PrintCard";

/**
 * Colour-record screens shared by the staff app (/staff/customers/[id]/color)
 * and the admin phone app (/admin/m/customers/[id]/color). `base` is the route
 * prefix; nothing here selects ColorVisit.costSatang.
 */

const Shell = ({ title, sub, back, children }: { title: string; sub?: string; back: string; children: React.ReactNode }) => (
  <div className="min-h-screen" style={{ background: "#FDF8F3" }}>
    <div className="max-w-md mx-auto min-h-screen">
      <MobileTop title={title} back={back} />
      {sub && <p className="px-4 pt-2 text-xs" style={{ color: "#A08070" }}>{sub}</p>}
      <div className="px-4 py-3">{children}</div>
    </div>
  </div>
);

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

export async function ColorCardView({ customerId, base, back, bookingId, defaultBranchId, canChooseBranch }: {
  customerId: string; base: string; back: string; bookingId: string | null; defaultBranchId: string | null; canChooseBranch: boolean;
}) {
  const data = await loadColorCard(customerId);
  if (!data) notFound();
  const booking = bookingId ? await prisma.booking.findFirst({ where: { id: bookingId, customerId }, select: { id: true, branchId: true } }) : null;
  const p = data.profile;
  return (
    <Shell title={`การ์ดสีผม · ${data.customer.label}`} back={back}>
      <ColorCard
        customerId={customerId} base={base}
        profile={p ? { ...p, patchTestAt: iso(p.patchTestAt), consentAt: iso(p.consentAt), updatedAt: p.updatedAt.toISOString() } : null}
        visits={data.visits.map(v => ({ ...v, date: v.date.toISOString() }))}
        branches={data.branches} bookingId={booking?.id ?? null}
        defaultBranchId={booking?.branchId ?? defaultBranchId ?? data.branches[0]?.id ?? null} canChooseBranch={canChooseBranch}
      />
    </Shell>
  );
}

export async function ColorProfileView({ customerId, base }: { customerId: string; base: string }) {
  const data = await loadColorCard(customerId);
  if (!data) notFound();
  const p = data.profile;
  return (
    <Shell title="ประวัติก่อนทำสี" sub={`${data.customer.label} · ถามลูกค้าที่หน้าร้าน`} back={base}>
      <ProfileForm
        customerId={customerId} customerLabel={data.customer.label} doneHref={base}
        initial={{
          naturalLevel: p?.naturalLevel ?? null, grayPercent: p?.grayPercent ?? null, length: p?.length ?? null, texture: p?.texture ?? null,
          curl: p?.curl ?? null, density: p?.density ?? null, condition: p?.condition ?? [], scalp: p?.scalp ?? [], chemicalHistory: p?.chemicalHistory ?? [],
          lastChemical: p?.lastChemical ?? null, lastChemicalProduct: p?.lastChemicalProduct ?? "", allergy: p?.allergy ?? "UNKNOWN",
          allergyDetail: p?.allergyDetail ?? "", patchTestResult: p?.patchTestResult ?? null, preferredTones: p?.preferredTones ?? "",
          avoidTones: p?.avoidTones ?? "", goals: p?.goals ?? "", consentMarketing: p?.consentMarketing ?? false, hasConsent: !!p?.consentAt,
        }}
      />
    </Shell>
  );
}

export async function ColorVisitView({ customerId, visitId, base }: { customerId: string; visitId: string; base: string }) {
  const [v, data, shades] = await Promise.all([
    prisma.colorVisit.findFirst({ where: { id: visitId, customerId }, select: VISIT_PUBLIC_SELECT }),
    loadColorCard(customerId),
    loadShadeOptions(),
  ]);
  if (!v || !data) notFound();
  const branch = data.branches.find(b => b.id === v.branchId)?.name ?? "";
  const when = v.date.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "2-digit" });
  return (
    <Shell title={`บันทึกสี · ${data.customer.label}`} sub={`ครั้งที่ ${v.visitNo} · ${when} · ${branch} · ช่าง${v.stylistName}${v.status === "DONE" ? " · เสร็จแล้ว" : ""}`} back={base}>
      {data.profile?.allergy === "YES" && (
        <p className="mb-3 rounded-xl px-3 py-2 text-sm" style={{ background: "#FDE9E7", color: "#B42318" }}>
          <b>⚠︎ เคยแพ้ / ระคายเคือง</b>{data.profile.allergyDetail ? ` — ${data.profile.allergyDetail}` : ""}
        </p>
      )}
      <VisitEditor
        customerId={customerId} branchId={v.branchId} backHref={base} shades={shades} canPhoto={!!data.profile?.consentAt}
        initial={{
          id: v.id, status: v.status, serviceTypes: v.serviceTypes, rootLevel: v.rootLevel, midEndsLevel: v.midEndsLevel, targetLevel: v.targetLevel,
          grayPercent: v.grayPercent, preChecks: v.preChecks, patchTestNeeded: v.patchTestNeeded, zones: cleanZones(v.zones), otherProducts: v.otherProducts,
          result: v.result, scalpAfter: v.scalpAfter, referencePhotos: v.referencePhotos, beforePhotos: v.beforePhotos, afterPhotos: v.afterPhotos,
          nextTimeNotes: v.nextTimeNotes,
        }}
      />
    </Shell>
  );
}

export async function ColorPrintView({ customerId, base }: { customerId: string; base: string }) {
  const data = await loadColorCard(customerId);
  if (!data) notFound();
  return <PrintCard data={data} backHref={base} />;
}
