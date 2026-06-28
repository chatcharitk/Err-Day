"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MonitorCheck, Check } from "lucide-react";

const PRIMARY = "#8B1D24";
const TEXT    = "#3B2A24";
const MUTED   = "#A08070";
const BORDER  = "#E8D8CC";
const BG      = "#FDF8F3";

export default function SetupClient({
  branches, currentBranchId, adminName,
}: {
  branches: { id: string; name: string }[];
  currentBranchId: string | null;
  adminName: string;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState<string | null>(null);
  const [error,  setError]  = useState("");

  async function arm(branchId: string) {
    setError("");
    setSaving(branchId);
    try {
      const res = await fetch("/api/admin/kiosk/arm", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ branchId }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "ตั้งค่าไม่สำเร็จ");
        setSaving(null);
        return;
      }
      router.replace("/desk");
      router.refresh();
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
      setSaving(null);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-5" style={{ background: BG }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3"
            style={{ background: PRIMARY }}>
            <MonitorCheck size={26} color="white" />
          </div>
          <h1 className="text-xl font-bold" style={{ color: TEXT }}>ตั้งค่าอุปกรณ์หน้าร้าน</h1>
          <p className="text-sm mt-1" style={{ color: MUTED }}>
            เลือกสาขาของอุปกรณ์นี้ — ทำครั้งเดียว หลังจากนั้นพนักงานใช้ได้เลยไม่ต้องเข้าสู่ระบบ
          </p>
        </div>

        <div className="rounded-2xl bg-white p-4 space-y-2.5" style={{ border: `1.5px solid ${BORDER}` }}>
          {branches.map(b => {
            const isCurrent = b.id === currentBranchId;
            const busy = saving === b.id;
            return (
              <button key={b.id} onClick={() => arm(b.id)} disabled={!!saving}
                className="w-full flex items-center justify-between gap-3 rounded-xl px-5 py-4 text-left transition-all active:scale-[0.99] disabled:opacity-60"
                style={{ border: `1.5px solid ${isCurrent ? PRIMARY : BORDER}`, background: isCurrent ? "#FFF8F4" : "white" }}>
                <span className="text-base font-semibold" style={{ color: TEXT }}>{b.name}</span>
                {busy
                  ? <Loader2 size={20} className="animate-spin" style={{ color: PRIMARY }} />
                  : isCurrent
                    ? <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: PRIMARY }}><Check size={15} /> อุปกรณ์นี้</span>
                    : <span className="text-sm" style={{ color: MUTED }}>เลือก →</span>}
              </button>
            );
          })}
        </div>

        {error && <p className="text-sm text-center mt-3" style={{ color: "#B91C1C" }}>{error}</p>}

        <p className="text-xs text-center mt-5" style={{ color: MUTED }}>
          เข้าสู่ระบบในชื่อ <span className="font-medium">{adminName}</span> · ผู้ดูแลระบบ
        </p>
      </div>
    </main>
  );
}
