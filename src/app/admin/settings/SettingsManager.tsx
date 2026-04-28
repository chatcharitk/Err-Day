"use client";

import { useState } from "react";
import { MapPin, Phone, Clock, Globe, Check, Loader2, ExternalLink } from "lucide-react";

interface Branch {
  id:        string;
  name:      string;
  address:   string;
  phone:     string;
  openTime:  string | null;
  closeTime: string | null;
  mapUrl:    string | null;
  mapLat:    number | null;
  mapLng:    number | null;
}

const TIME_OPTIONS: string[] = [];
for (let h = 7; h <= 23; h++) {
  TIME_OPTIONS.push(`${String(h).padStart(2,"0")}:00`);
  if (h < 23) TIME_OPTIONS.push(`${String(h).padStart(2,"0")}:30`);
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-widest font-medium block mb-1" style={{ color: "#A08070" }}>
        {label}
      </label>
      {hint && <p className="text-xs mb-1.5" style={{ color: "#C4B0A4" }}>{hint}</p>}
      {children}
    </div>
  );
}

function inputClass() {
  return "w-full px-3 py-2.5 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#8B1D24]/30";
}

export default function SettingsManager({ branches }: { branches: Branch[] }) {
  const [selectedId, setSelectedId] = useState(branches[0]?.id ?? "");
  const [form,  setForm]  = useState<Branch>(branches[0] ?? {} as Branch);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState("");

  function selectBranch(id: string) {
    const b = branches.find((x) => x.id === id);
    if (!b) return;
    setSelectedId(id);
    setForm({ ...b });
    setSaved(false);
    setError("");
  }

  function set<K extends keyof Branch>(k: K, v: Branch[K]) {
    setForm((f) => ({ ...f, [k]: v }));
    setSaved(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/branches/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:      form.name,
          address:   form.address,
          phone:     form.phone,
          openTime:  form.openTime  || null,
          closeTime: form.closeTime || null,
          mapUrl:    form.mapUrl    || null,
          mapLat:    form.mapLat    ?? null,
          mapLng:    form.mapLng    ?? null,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed");
      setSaved(true);
    } catch (e) {
      setError((e as Error).message || "เกิดข้อผิดพลาด");
    } finally {
      setSaving(false);
    }
  }

  // Preview map URL
  const embedSrc = form.mapLat && form.mapLng
    ? `https://maps.google.com/maps?q=${form.mapLat},${form.mapLng}&output=embed&hl=th&z=17`
    : form.address
    ? `https://maps.google.com/maps?q=${encodeURIComponent(form.address)}&output=embed&hl=th&z=16`
    : null;

  return (
    <main className="min-h-screen p-8" style={{ background: "#FDF8F3" }}>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-medium" style={{ color: "#3B2A24" }}>ตั้งค่าร้าน</h1>
          <p className="text-sm" style={{ color: "#A08070" }}>Shop Settings — แก้ไขข้อมูลสาขา</p>
        </div>

        {/* Branch tabs */}
        {branches.length > 1 && (
          <div className="flex gap-2 mb-6 flex-wrap">
            {branches.map((b) => (
              <button
                key={b.id}
                onClick={() => selectBranch(b.id)}
                className="px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                style={
                  selectedId === b.id
                    ? { background: "#8B1D24", color: "white" }
                    : { background: "white", color: "#5C4A42", border: "1.5px solid #E8D8CC" }
                }
              >
                {b.name}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">

          {/* ── Basic info ── */}
          <div className="rounded-2xl bg-white p-6 space-y-4" style={{ border: "1.5px solid #E8D8CC" }}>
            <p className="text-sm font-semibold" style={{ color: "#3B2A24" }}>ข้อมูลพื้นฐาน</p>

            <Field label="ชื่อสาขา">
              <input
                value={form.name ?? ""}
                onChange={(e) => set("name", e.target.value)}
                className={inputClass()}
                style={{ border: "1.5px solid #E8D8CC" }}
                required
              />
            </Field>

            <Field label="ที่อยู่">
              <textarea
                value={form.address ?? ""}
                onChange={(e) => set("address", e.target.value)}
                className={inputClass() + " resize-none"}
                style={{ border: "1.5px solid #E8D8CC" }}
                rows={2}
                required
              />
            </Field>

            <Field label="เบอร์โทรศัพท์">
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#D6BCAE" }} />
                <input
                  type="tel"
                  value={form.phone ?? ""}
                  onChange={(e) => set("phone", e.target.value)}
                  className={inputClass() + " pl-9"}
                  style={{ border: "1.5px solid #E8D8CC" }}
                  required
                />
              </div>
            </Field>
          </div>

          {/* ── Operating hours ── */}
          <div className="rounded-2xl bg-white p-6 space-y-4" style={{ border: "1.5px solid #E8D8CC" }}>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" style={{ color: "#8B1D24" }} />
              <p className="text-sm font-semibold" style={{ color: "#3B2A24" }}>เวลาทำการ</p>
            </div>
            <p className="text-xs" style={{ color: "#A08070" }}>
              แสดงบนหน้าร้านและหน้าจองคิว — ใช้สำหรับข้อมูลเท่านั้น
              กำหนดกะพนักงานจริงได้ที่เมนู <strong>ตารางงาน</strong>
            </p>

            <div className="grid grid-cols-2 gap-3">
              <Field label="เปิด">
                <select
                  value={form.openTime ?? ""}
                  onChange={(e) => set("openTime", e.target.value || null)}
                  className={inputClass()}
                  style={{ border: "1.5px solid #E8D8CC" }}
                >
                  <option value="">— ไม่ระบุ —</option>
                  {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t} น.</option>)}
                </select>
              </Field>
              <Field label="ปิด">
                <select
                  value={form.closeTime ?? ""}
                  onChange={(e) => set("closeTime", e.target.value || null)}
                  className={inputClass()}
                  style={{ border: "1.5px solid #E8D8CC" }}
                >
                  <option value="">— ไม่ระบุ —</option>
                  {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t} น.</option>)}
                </select>
              </Field>
            </div>
          </div>

          {/* ── Location / Map ── */}
          <div className="rounded-2xl bg-white p-6 space-y-4" style={{ border: "1.5px solid #E8D8CC" }}>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4" style={{ color: "#8B1D24" }} />
              <p className="text-sm font-semibold" style={{ color: "#3B2A24" }}>แผนที่ / Location</p>
            </div>

            <Field
              label="Google Maps Link"
              hint="วาง URL จาก Google Maps (maps.app.goo.gl หรือ maps.google.com) — ใช้สำหรับปุ่ม &ldquo;เปิดใน Google Maps&rdquo;"
            >
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#D6BCAE" }} />
                <input
                  type="url"
                  value={form.mapUrl ?? ""}
                  onChange={(e) => set("mapUrl", e.target.value || null)}
                  placeholder="https://maps.app.goo.gl/..."
                  className={inputClass() + " pl-9"}
                  style={{ border: "1.5px solid #E8D8CC" }}
                />
              </div>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Latitude" hint="เช่น 13.6654423">
                <input
                  type="number"
                  step="any"
                  value={form.mapLat ?? ""}
                  onChange={(e) => set("mapLat", e.target.value ? Number(e.target.value) : null)}
                  placeholder="13.xxxxxx"
                  className={inputClass()}
                  style={{ border: "1.5px solid #E8D8CC" }}
                />
              </Field>
              <Field label="Longitude" hint="เช่น 100.6027686">
                <input
                  type="number"
                  step="any"
                  value={form.mapLng ?? ""}
                  onChange={(e) => set("mapLng", e.target.value ? Number(e.target.value) : null)}
                  placeholder="100.xxxxxx"
                  className={inputClass()}
                  style={{ border: "1.5px solid #E8D8CC" }}
                />
              </Field>
            </div>

            <p className="text-xs" style={{ color: "#A08070" }}>
              วิธีดู Coordinates: เปิด Google Maps → คลิกขวาที่ตำแหน่งร้าน → คัดลอกตัวเลข (lat, lng)
            </p>

            {/* Map preview */}
            {embedSrc && (
              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #E8D8CC" }}>
                <iframe
                  src={embedSrc}
                  width="100%"
                  height="200"
                  style={{ border: 0, display: "block" }}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
                <div className="px-3 py-2 flex items-center justify-between" style={{ background: "#FFF8F4" }}>
                  <p className="text-xs" style={{ color: "#A08070" }}>ตัวอย่างแผนที่</p>
                  {form.mapUrl && (
                    <a href={form.mapUrl} target="_blank" rel="noopener noreferrer"
                      className="text-xs flex items-center gap-1" style={{ color: "#8B1D24" }}>
                      เปิด Google Maps <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Save */}
          {error && (
            <p className="text-sm p-3 rounded-xl" style={{ color: "#991B1B", background: "#FEE2E2" }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3.5 rounded-2xl text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60 transition-colors"
            style={{ background: saved ? "#16A34A" : "#8B1D24" }}
          >
            {saving ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> กำลังบันทึก...</>
            ) : saved ? (
              <><Check className="w-4 h-4" /> บันทึกแล้ว</>
            ) : (
              "บันทึกการเปลี่ยนแปลง"
            )}
          </button>
        </form>
      </div>
    </main>
  );
}
