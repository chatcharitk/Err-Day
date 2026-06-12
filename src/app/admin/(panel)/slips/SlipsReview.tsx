"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Check, X, Loader2, ExternalLink, AlertTriangle } from "lucide-react";

const PRIMARY = "#8B1D24";
const TEXT    = "#3B2A24";
const MUTED   = "#A08070";
const BORDER  = "#E8D8CC";

interface SlipRow {
  id:         string;
  branchId:   string;
  imageUrl:   string;
  amount:     number | null;     // satang
  transferAt: string | null;
  bankName:   string | null;
  senderName: string | null;
  ocrStatus:  string;
  bookingId:  string | null;     // auto-suggested booking (validated server-side)
  createdAt:  string;
}

interface OpenBooking {
  id:           string;
  branchId:     string;
  startTime:    string;
  totalPrice:   number;          // satang
  hasReceipt:   boolean;
  customerName: string;
  serviceName:  string;
}

interface Props {
  branches:     { id: string; name: string }[];
  slips:        SlipRow[];
  openBookings: OpenBooking[];
}

const baht = (satang: number) => `฿${(satang / 100).toLocaleString()}`;

function capturedAtLabel(iso: string): string {
  return new Date(iso).toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function SlipsReview({ branches, slips: initial, openBookings }: Props) {
  const router = useRouter();
  const [slips, setSlips] = useState<SlipRow[]>(initial);
  // Per-slip selected booking (initialised to the auto-suggestion).
  const [picks, setPicks] = useState<Record<string, string>>(() =>
    Object.fromEntries(initial.filter(s => s.bookingId).map(s => [s.id, s.bookingId!])));
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const branchName = (id: string) => branches.find(b => b.id === id)?.name?.replace(/^err\.day\s*/i, "") ?? id;

  async function act(slipId: string, action: "confirm" | "dismiss") {
    setBusyId(slipId);
    setErrors(prev => ({ ...prev, [slipId]: "" }));
    try {
      const res = await fetch(`/api/admin/slips/${slipId}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...(action === "confirm" ? { bookingId: picks[slipId] || undefined } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) { setErrors(prev => ({ ...prev, [slipId]: data.error ?? "เกิดข้อผิดพลาด" })); return; }
      setSlips(prev => prev.filter(s => s.id !== slipId));
      router.refresh();
    } catch {
      setErrors(prev => ({ ...prev, [slipId]: "เกิดข้อผิดพลาด กรุณาลองใหม่" }));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="px-6 py-8 max-w-5xl">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-widest mb-1" style={{ color: MUTED }}>Payment Slips</p>
        <h1 className="text-2xl font-medium" style={{ color: TEXT }}>สลิปโอนเงิน</h1>
        <p className="text-xs mt-1" style={{ color: MUTED }}>
          สลิปที่พนักงานส่งในกลุ่ม LINE จะปรากฏที่นี่อัตโนมัติ — ตรวจสอบ เลือกคิว แล้วกดยืนยันเพื่อเช็คเอาท์
        </p>
      </div>

      {slips.length === 0 && (
        <div className="rounded-2xl bg-white p-10 text-center" style={{ border: `1.5px solid ${BORDER}` }}>
          <Check className="w-8 h-8 mx-auto mb-2" style={{ color: "#16a34a" }} />
          <p className="text-sm font-medium" style={{ color: TEXT }}>ไม่มีสลิปค้างตรวจ</p>
          <p className="text-xs mt-1" style={{ color: MUTED }}>สลิปใหม่จากกลุ่ม LINE จะขึ้นที่นี่เอง</p>
        </div>
      )}

      <div className="space-y-4">
        {slips.map(s => {
          const candidates = openBookings.filter(b => b.branchId === s.branchId);
          const picked = picks[s.id] ?? "";
          return (
            <div key={s.id} className="rounded-2xl bg-white p-4 flex gap-4" style={{ border: `1.5px solid ${BORDER}` }}>
              {/* Slip image */}
              <a href={s.imageUrl} target="_blank" rel="noreferrer" className="flex-shrink-0 relative group">
                <Image
                  src={s.imageUrl}
                  alt="payment slip"
                  width={120}
                  height={160}
                  className="rounded-lg object-cover w-[120px] h-[160px]"
                  style={{ border: `1px solid ${BORDER}` }}
                />
                <span className="absolute bottom-1 right-1 p-1 rounded bg-white/80 opacity-0 group-hover:opacity-100">
                  <ExternalLink size={12} style={{ color: MUTED }} />
                </span>
              </a>

              {/* Details + actions */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <p className="text-xl font-bold" style={{ color: TEXT }}>
                    {s.amount != null ? baht(s.amount) : "อ่านยอดไม่ได้"}
                  </p>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: "#F0E4D8", color: PRIMARY }}>
                    {branchName(s.branchId)}
                  </span>
                  {s.ocrStatus !== "OK" && (
                    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "#FEF3C7", color: "#92400E" }}>
                      <AlertTriangle size={10} /> อ่านอัตโนมัติไม่สำเร็จ
                    </span>
                  )}
                </div>
                <p className="text-xs mt-0.5" style={{ color: MUTED }}>
                  {[s.bankName, s.transferAt && `โอนเวลา ${s.transferAt}`, s.senderName && `จาก ${s.senderName}`]
                    .filter(Boolean).join(" · ") || "—"}
                  {" · "}รับเมื่อ {capturedAtLabel(s.createdAt)}
                </p>

                {/* Booking picker */}
                <div className="mt-3">
                  <label className="text-xs font-medium block mb-1" style={{ color: TEXT }}>
                    คิวที่ชำระ {s.bookingId && picked === s.bookingId && (
                      <span style={{ color: "#16a34a" }}>(จับคู่อัตโนมัติ — ยอดตรง)</span>
                    )}
                  </label>
                  <select
                    value={picked}
                    onChange={e => setPicks(prev => ({ ...prev, [s.id]: e.target.value }))}
                    className="w-full text-sm rounded-lg px-3 py-2 bg-white"
                    style={{ border: `1.5px solid ${picked ? "#86EFAC" : BORDER}`, color: TEXT }}
                  >
                    <option value="">— เลือกคิววันนี้ —</option>
                    {candidates.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.startTime} · {b.customerName} · {b.serviceName} · {baht(b.totalPrice)}
                        {b.hasReceipt ? " (มีสลิปแล้ว)" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {errors[s.id] && <p className="text-xs mt-2" style={{ color: "#DC2626" }}>{errors[s.id]}</p>}

                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => act(s.id, "confirm")}
                    disabled={busyId === s.id || !picked}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-white px-4 py-2 rounded-lg disabled:opacity-40"
                    style={{ background: PRIMARY }}
                  >
                    {busyId === s.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    ยืนยัน + เช็คเอาท์
                  </button>
                  <button
                    onClick={() => act(s.id, "dismiss")}
                    disabled={busyId === s.id}
                    className="inline-flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg disabled:opacity-40"
                    style={{ border: `1px solid ${BORDER}`, color: MUTED }}
                  >
                    <X size={14} /> ไม่ใช่สลิปชำระ
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
