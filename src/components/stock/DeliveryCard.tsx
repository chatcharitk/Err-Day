"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Truck } from "lucide-react";
import type { PendingTransfer } from "@/lib/stock";
import { BORDER, MUTED, PRIMARY, TEXT, LOW, postStock } from "./theme";

function when(iso: string) {
  return new Date(iso).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** A delivery on the way: the branch confirms what arrived (edit if short). Admin can also cancel. */
export default function DeliveryCard({ t, canCancel }: { t: PendingTransfer; canCancel?: boolean }) {
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  const [got, setGot] = useState<Record<string, string>>(() => Object.fromEntries(t.items.map(i => [i.id, String(i.qtySent)])));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function act(action: "receive" | "cancel") {
    if (action === "cancel" && !confirm("ยกเลิกการส่งนี้? ของจะกลับเข้าต้นทาง")) return;
    if (action === "receive" && !confirm(`ยืนยันรับของ ${t.items.length} รายการ ที่ ${t.toName}?`)) return;
    setBusy(true); setErr(null);
    const received = edit ? Object.fromEntries(Object.entries(got).map(([k, v]) => [k, Number(v || 0)])) : undefined;
    const r = await postStock({ action, transferId: t.id, received });
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    router.refresh();
  }

  return (
    <div className="rounded-xl p-3" style={{ border: `1px solid ${PRIMARY}`, background: "#FFF7F5" }}>
      <div className="flex items-center gap-2">
        <Truck size={16} style={{ color: PRIMARY }} />
        <p className="text-sm font-medium flex-1" style={{ color: TEXT }}>ของกำลังส่ง {t.fromName} → {t.toName}</p>
      </div>
      <p className="text-[11px] mt-0.5" style={{ color: MUTED }}>ส่งโดย {t.sentBy} · {when(t.sentAt)}{t.note ? ` · ${t.note}` : ""}</p>
      <ul className="mt-2 space-y-1">
        {t.items.map(i => (
          <li key={i.id} className="flex items-center gap-2 text-sm" style={{ color: TEXT }}>
            <span className="flex-1">{i.label}</span>
            {edit ? (
              <input inputMode="numeric" value={got[i.id] ?? ""} onChange={e => setGot(g => ({ ...g, [i.id]: e.target.value.replace(/[^0-9]/g, "") }))}
                className="w-14 text-center py-1 rounded-lg outline-none bg-white" style={{ border: `1px solid ${BORDER}` }} />
            ) : <b>{i.qtySent}</b>}
            <span className="text-xs w-8" style={{ color: MUTED }}>{i.unit}</span>
          </li>
        ))}
      </ul>
      {err && <p className="text-xs mt-2" style={{ color: LOW }}>{err}</p>}
      <div className="flex gap-2 mt-3">
        <button type="button" disabled={busy} onClick={() => act("receive")} className="flex-1 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50" style={{ background: PRIMARY }}>
          {busy ? "กำลังบันทึก…" : edit ? "รับของตามจำนวนที่แก้" : "รับของแล้ว ครบ"}
        </button>
        {!edit && (
          <button type="button" disabled={busy} onClick={() => setEdit(true)} className="px-3 py-2 rounded-lg text-sm" style={{ border: `1px solid ${BORDER}`, color: TEXT }}>ได้ไม่ครบ</button>
        )}
        {canCancel && (
          <button type="button" disabled={busy} onClick={() => act("cancel")} className="px-3 py-2 rounded-lg text-sm" style={{ border: `1px solid ${BORDER}`, color: LOW }}>ยกเลิก</button>
        )}
      </div>
    </div>
  );
}
