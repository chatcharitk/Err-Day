import { ALLERGY_LABEL, RESULT_LABEL, ZONE_LABEL } from "@/lib/color-options";
import { zoneSummary, type ColorCardData } from "@/lib/color-card";
import PrintButton from "./PrintButton";

const fmt = (d: Date | string) => new Date(d).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "2-digit" });

/**
 * A4 colour card for the stylist to study before a job — profile, warnings and
 * the last three formulas in grams. No costs. Phone is masked like the staff app.
 */
export default function PrintCard({ data, backHref }: { data: ColorCardData; backHref: string }) {
  const { customer, profile, visits } = data;
  const done = visits.filter(v => v.status === "DONE").slice(0, 3);
  const photos = done.flatMap(v => [...v.beforePhotos.slice(0, 1).map(u => ({ u, t: `ก่อน ${fmt(v.date)}` })), ...v.afterPhotos.slice(0, 1).map(u => ({ u, t: `หลัง ${fmt(v.date)}` }))]).slice(0, 4);
  const phone = customer.phone.replace(/^(\d{3})\d{3}(\d{4})$/, "$1-xxx-$2");
  const notes = done.map(v => v.nextTimeNotes && `${fmt(v.date)} (${v.stylistName}): ${v.nextTimeNotes}`).filter(Boolean);

  return (
    <div className="print-root">
      <style>{`
        @page { size: A4; margin: 12mm; }
        /* The admin phone app wraps pages in a phone-width column — let the A4 sheet use the full width. */
        body:has(.print-root) .max-w-md { max-width: none !important; box-shadow: none !important; }
        .print-root { background: #EEE7E2; min-height: 100vh; padding: 16px; }
        .sheet { background: #fff; color: #2C201C; max-width: 794px; margin: 0 auto; padding: 32px 36px; font-size: 13px; line-height: 1.5; display: flex; flex-direction: column; gap: 14px; box-shadow: 0 10px 30px -18px rgba(0,0,0,.4); }
        .bar { max-width: 794px; margin: 0 auto 12px; display: flex; gap: 8px; justify-content: space-between; align-items: center; }
        .head { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 2px solid #8B1D24; padding-bottom: 8px; gap: 12px; flex-wrap: wrap; }
        .brand { font-size: 24px; font-weight: 700; color: #8B1D24; }
        .alert { background: #FDE9E7; color: #B42318; border-radius: 8px; padding: 8px 12px; font-weight: 600; }
        .warn { background: #FFF7ED; color: #9A3412; border-radius: 8px; padding: 8px 12px; }
        .grid { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 8px; }
        .grid div { border: 1px solid #E9DCD3; border-radius: 8px; padding: 6px 8px; }
        .grid small, .muted { color: #86736A; }
        .grid small { display: block; font-size: 11px; }
        h3 { font-size: 13px; color: #8B1D24; margin: 0; text-transform: uppercase; letter-spacing: .06em; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th { background: #F5E6E4; color: #8B1D24; text-align: left; padding: 6px 8px; font-weight: 600; }
        td { border-top: 1px solid #E9DCD3; padding: 6px 8px; vertical-align: top; }
        .photos { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 8px; }
        .photos figure { margin: 0; } .photos img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 8px; }
        .photos figcaption { font-size: 10px; color: #86736A; text-align: center; }
        @media print { .print-root { background: #fff; padding: 0; } .bar { display: none; } .sheet { box-shadow: none; padding: 0; max-width: none; } }
      `}</style>
      <div className="bar">
        <a href={backHref} style={{ color: "#86736A", fontSize: 14 }}>← กลับ</a>
        <PrintButton />
      </div>
      <div className="sheet">
        <div className="head">
          <span className="brand">err·day</span>
          <span>การ์ดสีผม · <b>{customer.label}</b>{customer.nickname && customer.name !== customer.nickname ? ` (${customer.name})` : ""} · {phone}</span>
          <span className="muted" style={{ fontSize: 11 }}>พิมพ์ {fmt(new Date())}</span>
        </div>

        {profile?.allergy === "YES" && <div className="alert">⚠︎ เคยแพ้ / ระคายเคือง{profile.allergyDetail ? ` — ${profile.allergyDetail}` : ""}</div>}
        {profile && profile.allergy !== "YES" && profile.allergy !== "NONE" && <div className="warn">ประวัติการแพ้: {ALLERGY_LABEL[profile.allergy]}{profile.allergyDetail ? ` — ${profile.allergyDetail}` : ""}</div>}
        {profile?.patchTestResult && <div className={profile.patchTestResult === "PASS" ? "warn" : "alert"}>Patch test {profile.patchTestResult === "PASS" ? "ผ่าน" : "ไม่ผ่าน"}{profile.patchTestAt ? ` · ${fmt(profile.patchTestAt)}` : ""}{profile.patchTestBy ? ` · ${profile.patchTestBy}` : ""}</div>}
        {!profile && <div className="warn">ยังไม่มีประวัติก่อนทำสี — ถามลูกค้าที่หน้าร้านก่อนเริ่มงาน</div>}

        {profile && (
          <>
            <div className="grid">
              <div><small>ระดับธรรมชาติ</small><b>{profile.naturalLevel ?? "—"}</b></div>
              <div><small>ผมหงอก</small><b>{profile.grayPercent != null ? `${profile.grayPercent}%` : "—"}</b></div>
              <div><small>ความยาว / เส้น</small><b>{[profile.length, profile.texture, profile.curl].filter(Boolean).join(" · ") || "—"}</b></div>
              <div><small>ความหนา</small><b>{profile.density ?? "—"}</b></div>
            </div>
            <div style={{ display: "grid", gap: 2 }}>
              <span><span className="muted">สภาพผม:</span> {profile.condition.join(", ") || "—"} · <span className="muted">หนังศีรษะ:</span> {profile.scalp.join(", ") || "—"}</span>
              <span><span className="muted">เคมีใน 12 เดือน:</span> {profile.chemicalHistory.join(", ") || "—"}{profile.lastChemical ? ` · ล่าสุด ${profile.lastChemical}` : ""}{profile.lastChemicalProduct ? ` (${profile.lastChemicalProduct})` : ""}</span>
              <span><span className="muted">โทนที่ชอบ:</span> {profile.preferredTones ?? "—"} · <span className="muted">ไม่ต้องการ:</span> {profile.avoidTones ?? "—"}</span>
              {profile.goals && <span><span className="muted">เป้าหมาย:</span> {profile.goals}</span>}
            </div>
          </>
        )}

        <h3>สูตร {done.length} ครั้งล่าสุด</h3>
        {done.length === 0 ? <p className="muted">ยังไม่มีสูตรที่บันทึกเสร็จ</p> : (
          <table>
            <thead><tr><th style={{ width: "22%" }}>วันที่ / ช่าง</th><th>สูตร (กรัม)</th><th style={{ width: "16%" }}>ผล</th></tr></thead>
            <tbody>
              {done.map(v => (
                <tr key={v.id}>
                  <td>{fmt(v.date)}<br /><span className="muted">{v.stylistName} · {v.branchName}</span><br /><span className="muted">{v.serviceTypes.join(", ")}</span></td>
                  <td>
                    {v.zones.map(z => <div key={z.zone}><b>{ZONE_LABEL[z.zone]}</b> · {zoneSummary(z)}</div>)}
                    {v.targetLevel ? <div className="muted">เป้าหมายระดับ {v.targetLevel}{v.rootLevel ? ` · โคนเดิม ${v.rootLevel}` : ""}</div> : null}
                    {v.otherProducts && <div className="muted">อื่นๆ: {v.otherProducts}</div>}
                  </td>
                  <td>{v.result ? RESULT_LABEL[v.result] : "—"}{v.scalpAfter ? <><br /><span className="muted">{v.scalpAfter}</span></> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {photos.length > 0 && (
          <div className="photos">
            {photos.map(p => (
              <figure key={p.u}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.u} alt="" />
                <figcaption>{p.t}</figcaption>
              </figure>
            ))}
          </div>
        )}

        {notes.length > 0 && (
          <div style={{ borderTop: "1px dashed #E9DCD3", paddingTop: 8 }}>
            <h3 style={{ marginBottom: 4 }}>จำไว้</h3>
            {notes.map(n => <div key={n as string}>{n}</div>)}
          </div>
        )}
      </div>
    </div>
  );
}
