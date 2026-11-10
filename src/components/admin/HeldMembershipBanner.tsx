"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { HeldMembership } from "@/lib/membership-held";

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit", timeZone: "Asia/Bangkok" });

/**
 * "This customer paid for a membership that isn't switched on yet" — shown on a
 * booking so the desk opens it when the customer comes in. Activation uses the
 * customer-screen endpoint ({ activate: true }); with a period still running,
 * the new one starts the day after it ends (no days lost).
 */
export default function HeldMembershipBanner({ customerId, held, canActivate = true, onActivated }: {
  customerId: string;
  held: HeldMembership;
  canActivate?: boolean;
  onActivated?: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  const queued = held.currentExpiresAt != null;

  async function activate() {
    const msg = queued
      ? `เปิดใช้งานสมาชิกรอบถัดไป?\nรอบใหม่จะเริ่มหลังรอบปัจจุบันหมด (${fmtDate(held.currentExpiresAt!)})`
      : "เปิดใช้งานสมาชิกตอนนี้?\nเริ่มนับ 30 วันตั้งแต่วันนี้ และใช้ราคาสมาชิกได้ทันที";
    if (!window.confirm(msg)) return;
    setBusy(true); setErr("");
    try {
      const res = await fetch(`/api/admin/customers/${customerId}/membership`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activate: true }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setErr(d.error ?? "เปิดใช้งานไม่สำเร็จ");
        return;
      }
      setDone(true);
      onActivated?.();
      router.refresh();
    } catch {
      setErr("เกิดข้อผิดพลาด — ลองอีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-xl px-3 py-2.5 text-sm font-medium" style={{ background: "#ECFDF5", color: "#065F46", border: "1px solid #A7F3D0" }}>
        ✓ เปิดใช้งานสมาชิกแล้ว
      </div>
    );
  }

  return (
    <div className="rounded-xl px-3 py-3" style={{ background: "#FFF7E6", border: "1.5px solid #F59E0B" }}>
      <p className="text-sm font-semibold" style={{ color: "#92400E" }}>
        🎟 {queued ? "มีสมาชิกรอบถัดไปจ่ายแล้ว — รอเปิดใช้งาน" : "ลูกค้าจ่ายค่าสมาชิกล่วงหน้าแล้ว — ยังไม่ได้เปิดใช้งาน"}
      </p>
      <p className="text-xs mt-0.5" style={{ color: "#B45309" }}>
        จ่ายเมื่อ {fmtDate(held.paidAt)}
        {queued ? ` · รอบปัจจุบันถึง ${fmtDate(held.currentExpiresAt!)}` : " · ถ้าลูกค้ามาใช้บริการวันนี้ ให้เปิดใช้งานก่อนคิดเงิน"}
      </p>
      {canActivate ? (
        <button onClick={activate} disabled={busy}
          className="mt-2 w-full py-2 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60"
          style={{ background: "#D97706" }}>
          {busy && <Loader2 size={14} className="animate-spin" />}
          {queued ? "เปิดใช้งานรอบถัดไป" : "เปิดใช้งานสมาชิกวันนี้"}
        </button>
      ) : (
        <p className="text-xs mt-1.5 font-medium" style={{ color: "#92400E" }}>แจ้งเคาน์เตอร์ / แอดมินให้เปิดใช้งานก่อนคิดเงิน</p>
      )}
      {err && <p className="text-xs text-red-600 mt-1">{err}</p>}
    </div>
  );
}

/** Self-loading variant for screens that only know the customer id (POS). */
export function HeldMembershipCheck({ customerId, onActivated }: { customerId: string | null; onActivated?: () => void }) {
  const [held, setHeld] = useState<{ id: string; held: HeldMembership | null } | null>(null);
  useEffect(() => {
    if (!customerId) return;
    let cancelled = false;
    fetch(`/api/admin/customers/${customerId}/held-membership`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!cancelled) setHeld({ id: customerId, held: d?.held ?? null }); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [customerId]);
  if (!customerId || held?.id !== customerId || !held.held) return null;
  return <HeldMembershipBanner customerId={customerId} held={held.held} onActivated={onActivated} />;
}
