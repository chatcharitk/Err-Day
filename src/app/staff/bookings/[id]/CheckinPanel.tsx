"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Undo2, UserCheck } from "lucide-react";

const PRIMARY = "#8B1D24";
const TEXT    = "#3B2A24";
const MUTED   = "#A08070";
const BORDER  = "#E8D8CC";
const GREEN   = "#166534";

export type CheckinState = "waiting" | "inservice" | "done";

/** Check in / finish / undo for one of today's bookings, from the stylist's phone. */
export default function CheckinPanel({
  bookingId, state, servedByMe, servedByName, checkedInAt,
}: {
  bookingId: string;
  state: CheckinState;
  servedByMe: boolean;
  servedByName: string | null;
  checkedInAt: string | null;   // "HH:mm" Bangkok
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: "checkin" | "finish" | "undo") {
    if (action === "undo" && !confirm(state === "done" ? "ย้อนกลับเป็น 'กำลังทำ'?" : "ยกเลิกการเช็คอิน?")) return;
    setBusy(action); setError(null);
    try {
      const res = await fetch("/api/staff/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error ?? "ทำรายการไม่สำเร็จ");
      router.refresh();
    } catch {
      setError("เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง");
    } finally {
      setBusy(null);
    }
  }

  const spin = <Loader2 size={18} className="animate-spin" />;
  const lockedByOther = state !== "waiting" && !servedByMe;

  return (
    <section className="bg-white rounded-2xl p-4" style={{ border: `1.5px solid ${state === "waiting" ? PRIMARY : BORDER}` }}>
      <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: MUTED }}>เช็คอินวันนี้</p>

      {state === "waiting" && (
        <>
          <p className="text-sm mt-1" style={{ color: TEXT }}>ลูกค้ามาถึงแล้ว? กดเช็คอินเพื่อรับลูกค้าคนนี้</p>
          <button type="button" disabled={!!busy} onClick={() => run("checkin")}
            className="mt-3 w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-base font-bold text-white disabled:opacity-60"
            style={{ background: PRIMARY }}>
            {busy === "checkin" ? spin : <UserCheck size={18} />} เช็คอิน · ฉันรับลูกค้าคนนี้
          </button>
        </>
      )}

      {state === "inservice" && (
        <p className="text-sm font-semibold mt-1" style={{ color: TEXT }}>
          กำลังทำ · {servedByMe ? "คุณ" : servedByName ?? "—"}{checkedInAt ? ` · เช็คอิน ${checkedInAt} น.` : ""}
        </p>
      )}
      {state === "done" && (
        <p className="text-sm font-semibold mt-1 flex items-center gap-1.5" style={{ color: GREEN }}>
          <Check size={16} /> เสร็จแล้ว · {servedByMe ? "คุณ" : servedByName ?? "—"}
        </p>
      )}

      {state === "inservice" && servedByMe && (
        <button type="button" disabled={!!busy} onClick={() => run("finish")}
          className="mt-3 w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-base font-bold text-white disabled:opacity-60"
          style={{ background: GREEN }}>
          {busy === "finish" ? spin : <Check size={18} />} เสร็จแล้ว
        </button>
      )}

      {state !== "waiting" && servedByMe && (
        <button type="button" disabled={!!busy} onClick={() => run("undo")}
          className="mt-2 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold disabled:opacity-60"
          style={{ color: MUTED, border: `1px solid ${BORDER}` }}>
          {busy === "undo" ? <Loader2 size={14} className="animate-spin" /> : <Undo2 size={14} />} ย้อนกลับ (กดผิด)
        </button>
      )}

      {lockedByOther && (
        <p className="text-[11px] mt-2" style={{ color: MUTED }}>ช่างคนอื่นรับลูกค้าคนนี้แล้ว · ถ้าต้องแก้ ใช้ iPad หน้าร้าน</p>
      )}
      {error && <p className="text-xs mt-2 font-semibold" style={{ color: "#B91C1C" }}>{error}</p>}
    </section>
  );
}
