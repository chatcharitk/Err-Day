"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

/**
 * Admin switch: show or hide one week's shift roster in the staff app
 * ("ของฉัน" + "ตารางทีม"). Shifts still drive online booking either way.
 */
export default function StaffVisibilityToggle({ week }: { week: string }) {
  const [state, setState] = useState<{ week: string; hidden: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const hidden = state?.week === week ? state.hidden : null;

  useEffect(() => {
    let off = false;
    fetch(`/api/admin/shifts/visibility?week=${week}`).then(r => r.json()).then((j: { hidden?: boolean }) => { if (!off) setState({ week, hidden: !!j.hidden }); }).catch(() => {});
    return () => { off = true; };
  }, [week]);

  async function toggle() {
    if (hidden === null) return;
    setBusy(true);
    const res = await fetch("/api/admin/shifts/visibility", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ week, hidden: !hidden }),
    }).catch(() => null);
    const j = await res?.json().catch(() => null) as { hidden?: boolean } | null;
    if (res?.ok && j) setState({ week, hidden: !!j.hidden });
    setBusy(false);
  }

  const on = hidden === false;
  return (
    <button type="button" onClick={toggle} disabled={busy || hidden === null}
      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm bg-white disabled:opacity-60"
      style={{ border: `1px solid ${on ? "#BBF7D0" : "#FED7AA"}`, color: "#3B2A24" }}
      role="switch" aria-checked={on}>
      {on ? <Eye size={16} style={{ color: "#166534" }} /> : <EyeOff size={16} style={{ color: "#9A3412" }} />}
      <span className="flex-1 text-left">
        {hidden === null ? "กำลังโหลด…" : on ? "พนักงานเห็นตารางสัปดาห์นี้" : "ซ่อนจากพนักงาน (ยังไม่ประกาศ)"}
      </span>
      <span className="w-10 h-6 rounded-full relative transition-colors" style={{ background: on ? "#16A34A" : "#D6C7BC" }}>
        <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all" style={{ left: on ? 18 : 2 }} />
      </span>
    </button>
  );
}
