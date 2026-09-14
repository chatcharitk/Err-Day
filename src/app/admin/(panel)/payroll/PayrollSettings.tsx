"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
const PRIMARY = "#8B1D24",
  TEXT = "#3B2A24",
  MUTED = "#765d50",
  BORDER = "#E8D8CC";
type PayType = "MONTHLY_SALARY" | "DAILY_WAGE";
type Cadence = "MONTHLY" | "WEEKLY";
interface Branch {
  id: string;
  name: string;
}
export interface StaffCfg {
  id: string;
  name: string;
  branchId: string;
  payType: PayType;
  baseSatang: number;
  payCadence: Cadence;
  otRateSatang: number | null;
  normalWorkMinutes: number;
}
export interface ServiceCfg {
  id: string;
  nameTh: string;
  category: string;
  commissionSatang: number;
}
export interface AddonCfg {
  id: string;
  nameTh: string;
  commissionSatang: number;
}
const baht = (s: number) =>
  `฿${(s / 100).toLocaleString("th-TH", { maximumFractionDigits: 2 })}`;
const branchShort = (b: Branch) => b.name.replace(/^err\.day\s*/i, "");
export default function SettingsTab({
  branches,
  staffConfig,
  services,
  addons,
}: {
  branches: Branch[];
  staffConfig: StaffCfg[];
  services: ServiceCfg[];
  addons: AddonCfg[];
}) {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-sm font-semibold mb-1" style={{ color: TEXT }}>
          ฐานเงินเดือน / ค่าแรง + เรต OT
        </h2>
        <p className="text-[11px] mb-3" style={{ color: MUTED }}>
          OT/ชม. คำนวณอัตโนมัติ: เงินเดือน ÷ (30×8) หรือ ค่าแรงรายวัน ÷ 8
          (กรอกเรตเองได้ถ้าต้องการ)
        </p>
        <div className="space-y-4">
          {branches.map((b) => {
            const list = staffConfig.filter((s) => s.branchId === b.id);
            if (list.length === 0) return null;
            return (
              <div key={b.id}>
                <p
                  className="text-xs font-medium mb-1"
                  style={{ color: PRIMARY }}
                >
                  {branchShort(b)}
                </p>
                <div className="space-y-2">
                  {list.map((s) => (
                    <StaffPayRow key={s.id} staff={s} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold mb-1" style={{ color: TEXT }}>
          ค่ามือต่อบริการ (commission)
        </h2>
        <p className="text-[11px] mb-3" style={{ color: MUTED }}>
          จำนวนเงิน (บาท) ที่ช่างได้ต่อ 1 ครั้งที่ทำบริการนี้ —
          ไม่ขึ้นกับส่วนลดสมาชิก/แพ็กเกจ
        </p>
        <div className="space-y-2">
          {services.map((s) => (
            <ServiceCommissionRow key={s.id} service={s} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold mb-1" style={{ color: TEXT }}>
          ค่ามือต่อบริการเสริม (add-on)
        </h2>
        <p className="text-[11px] mb-3" style={{ color: MUTED }}>
          จำนวนเงิน (บาท) ที่ช่างได้เพิ่ม เมื่อบริการเสริมนี้อยู่ในงานที่เสร็จ
        </p>
        {addons.length === 0 ? (
          <p className="text-xs" style={{ color: MUTED }}>
            — ยังไม่มีบริการเสริม —
          </p>
        ) : (
          <div className="space-y-2">
            {addons.map((a) => (
              <AddonCommissionRow key={a.id} addon={a} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StaffPayRow({ staff }: { staff: StaffCfg }) {
  const router = useRouter();
  const [payType, setPayType] = useState<PayType>(staff.payType);
  const [baseBaht, setBaseBaht] = useState(String(staff.baseSatang / 100));
  const [normalHours, setNormalHours] = useState(
    String(staff.normalWorkMinutes / 60),
  );
  const [rateBaht, setRateBaht] = useState(
    staff.otRateSatang == null ? "" : String(staff.otRateSatang / 100),
  );
  const [error, setError] = useState("");
  const [cadence, setCadence] = useState<Cadence>(staff.payCadence);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const baseSatang = Math.round((parseFloat(baseBaht) || 0) * 100);
  const otRate =
    rateBaht !== ""
      ? Math.round(Number(rateBaht) * 100)
      : baseSatang <= 0
        ? 0
        : baseSatang / (payType === "DAILY_WAGE" ? 8 : 240);
  const dirty =
    payType !== staff.payType ||
    baseSatang !== staff.baseSatang ||
    cadence !== staff.payCadence ||
    Number(normalHours) * 60 !== staff.normalWorkMinutes ||
    (rateBaht === "" ? null : Math.round(Number(rateBaht) * 100)) !==
      staff.otRateSatang;

  async function save() {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const res = await fetch(`/api/admin/staff/${staff.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payType,
          baseSatang,
          payCadence: cadence,
          normalWorkMinutes: Math.round(Number(normalHours) * 60),
          otRateSatang:
            rateBaht === "" ? null : Math.round(Number(rateBaht) * 100),
        }),
      });
      if (res.ok) {
        setSaved(true);
        router.refresh();
        setTimeout(() => setSaved(false), 1500);
      } else {
        const data = await res.json();
        setError(data.error || "บันทึกไม่สำเร็จ");
      }
    } catch {
      setError("เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="rounded-xl bg-white p-3 flex items-center gap-2 flex-wrap"
      style={{ border: `1px solid ${BORDER}` }}
    >
      <p className="font-medium w-28 flex-shrink-0" style={{ color: TEXT }}>
        {staff.name}
      </p>
      <select
        value={payType}
        onChange={(e) => setPayType(e.target.value as PayType)}
        className="text-sm px-2 py-1.5 rounded-lg border bg-white"
        style={{ borderColor: BORDER, color: TEXT }}
      >
        <option value="MONTHLY_SALARY">เงินเดือน</option>
        <option value="DAILY_WAGE">รายวัน</option>
      </select>
      <div className="flex items-center gap-1">
        <span className="text-xs" style={{ color: MUTED }}>
          ฿
        </span>
        <input
          type="number"
          min="0"
          value={baseBaht}
          onChange={(e) => setBaseBaht(e.target.value)}
          className="w-24 px-2 py-1.5 text-sm rounded-lg border text-right"
          style={{ borderColor: BORDER, color: TEXT }}
        />
        <span className="text-[11px]" style={{ color: MUTED }}>
          {payType === "DAILY_WAGE" ? "/วัน" : "/เดือน"}
        </span>
      </div>
      <select
        value={cadence}
        onChange={(e) => setCadence(e.target.value as Cadence)}
        className="text-sm px-2 py-1.5 rounded-lg border bg-white"
        style={{ borderColor: BORDER, color: TEXT }}
      >
        <option value="MONTHLY">จ่ายรายเดือน</option>
        <option value="WEEKLY">จ่ายรายสัปดาห์</option>
      </select>
      <label>
        ชั่วโมงปกติ/วัน
        <input
          type="number"
          min="0.1"
          max="24"
          step="0.5"
          value={normalHours}
          onChange={(e) => setNormalHours(e.target.value)}
        />
      </label>
      <label>
        เรต OT ฿/ชม. (ว่าง = สูตรเดิม)
        <input
          type="number"
          min="0"
          step="0.01"
          value={rateBaht}
          onChange={(e) => setRateBaht(e.target.value)}
        />
      </label>
      <span style={{ color: MUTED }}>OT {baht(otRate)}/ชม.</span>
      {error && (
        <p role="alert" className="text-red-600">
          {error}
        </p>
      )}
      <button
        onClick={save}
        disabled={!dirty || saving}
        className="ml-auto text-xs px-3 py-1.5 rounded-lg text-white inline-flex items-center gap-1 disabled:opacity-40"
        style={{ background: PRIMARY }}
      >
        {saving ? (
          <Loader2 size={12} className="animate-spin" />
        ) : saved ? (
          <Check size={12} />
        ) : null}
        {saved ? "บันทึกแล้ว" : "บันทึก"}
      </button>
    </div>
  );
}

function ServiceCommissionRow({ service }: { service: ServiceCfg }) {
  const router = useRouter();
  const [val, setVal] = useState(String(service.commissionSatang / 100));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const satang = Math.round((parseFloat(val) || 0) * 100);
  const dirty = satang !== service.commissionSatang;

  async function save() {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const res = await fetch(`/api/admin/services/${service.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commissionBaht: parseFloat(val) || 0 }),
      });
      if (res.ok) {
        setSaved(true);
        router.refresh();
        setTimeout(() => setSaved(false), 1500);
      } else {
        const data = await res.json();
        setError(data.error || "บันทึกไม่สำเร็จ");
      }
    } catch {
      setError("เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="rounded-xl bg-white p-2.5 flex items-center gap-2"
      style={{ border: `1px solid ${BORDER}` }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: TEXT }}>
          {service.nameTh}
        </p>
        <p className="text-[10px]" style={{ color: MUTED }}>
          {service.category}
        </p>
      </div>
      <span className="text-xs" style={{ color: MUTED }}>
        ฿
      </span>
      <input
        type="number"
        min="0"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        className="w-20 px-2 py-1.5 text-sm rounded-lg border text-right"
        style={{ borderColor: BORDER, color: TEXT }}
      />
      {error && (
        <p role="alert" className="text-red-600">
          {error}
        </p>
      )}
      <button
        onClick={save}
        disabled={!dirty || saving}
        className="text-xs px-3 py-1.5 rounded-lg inline-flex items-center gap-1 disabled:opacity-30"
        style={{
          border: `1px solid ${BORDER}`,
          color: saved ? "#166534" : PRIMARY,
        }}
      >
        {saving ? (
          <Loader2 size={12} className="animate-spin" />
        ) : saved ? (
          <Check size={12} />
        ) : (
          "บันทึก"
        )}
      </button>
    </div>
  );
}

function AddonCommissionRow({ addon }: { addon: AddonCfg }) {
  const router = useRouter();
  const [val, setVal] = useState(String(addon.commissionSatang / 100));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const satang = Math.round((parseFloat(val) || 0) * 100);
  const dirty = satang !== addon.commissionSatang;

  async function save() {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const res = await fetch(`/api/admin/addons/${addon.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commissionBaht: parseFloat(val) || 0 }),
      });
      if (res.ok) {
        setSaved(true);
        router.refresh();
        setTimeout(() => setSaved(false), 1500);
      } else {
        const data = await res.json();
        setError(data.error || "บันทึกไม่สำเร็จ");
      }
    } catch {
      setError("เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="rounded-xl bg-white p-2.5 flex items-center gap-2"
      style={{ border: `1px solid ${BORDER}` }}
    >
      <p
        className="text-sm font-medium truncate flex-1 min-w-0"
        style={{ color: TEXT }}
      >
        {addon.nameTh}
      </p>
      <span className="text-xs" style={{ color: MUTED }}>
        ฿
      </span>
      <input
        type="number"
        min="0"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        className="w-20 px-2 py-1.5 text-sm rounded-lg border text-right"
        style={{ borderColor: BORDER, color: TEXT }}
      />
      {error && (
        <p role="alert" className="text-red-600">
          {error}
        </p>
      )}
      <button
        onClick={save}
        disabled={!dirty || saving}
        className="text-xs px-3 py-1.5 rounded-lg inline-flex items-center gap-1 disabled:opacity-30"
        style={{
          border: `1px solid ${BORDER}`,
          color: saved ? "#166534" : PRIMARY,
        }}
      >
        {saving ? (
          <Loader2 size={12} className="animate-spin" />
        ) : saved ? (
          <Check size={12} />
        ) : (
          "บันทึก"
        )}
      </button>
    </div>
  );
}
