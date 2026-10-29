"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Printer, Check, AlertCircle } from "lucide-react";

type Phase = "idle" | "sending" | "printing" | "done" | "error";

interface Props {
  /** Print this receipt… */
  receiptNumber?: string;
  lang?: "th" | "en";
  /** …or a test slip for this branch. */
  testBranchId?: string;
  label?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * One tap → the receipt prints on the branch's receipt printer (via the print
 * helper on that branch's computer). Shows "กำลังพิมพ์…" then "พิมพ์แล้ว ✓", or
 * the reason it failed, so the cashier is never left guessing.
 */
export default function ShopPrintButton({ receiptNumber, lang = "th", testBranchId, label = "พิมพ์ที่เครื่องพิมพ์ร้าน", className, style }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [msg, setMsg] = useState("");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  const press = async () => {
    if (phase === "sending" || phase === "printing") return;
    setPhase("sending"); setMsg("");
    try {
      const res = await fetch("/api/print/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testBranchId ? { test: true, branchId: testBranchId } : { receiptNumber, lang }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setPhase("error"); setMsg(data.error ?? "สั่งพิมพ์ไม่สำเร็จ"); return; }
      setPhase("printing");
      if (!data.agentOnline) setMsg("โปรแกรมพิมพ์บนเครื่องของสาขายังไม่เชื่อมต่อ — เปิดเครื่อง/ตรวจ WiFi แล้วงานจะพิมพ์เองเมื่อเชื่อมต่อ");

      const started = Date.now();
      timer.current = setInterval(async () => {
        const r = await fetch(`/api/print/jobs/${data.id}`).then(x => x.json()).catch(() => null);
        if (r?.status === "DONE") { if (timer.current) clearInterval(timer.current); setPhase("done"); setMsg(""); return; }
        if (r?.status === "FAILED" || r?.status === "EXPIRED") { if (timer.current) clearInterval(timer.current); setPhase("error"); setMsg(r.error ?? "พิมพ์ไม่สำเร็จ"); return; }
        if (Date.now() - started > 40_000) {
          if (timer.current) clearInterval(timer.current);
          setPhase("error"); setMsg("ยังไม่ได้พิมพ์ — ตรวจว่าเครื่องพิมพ์เปิดอยู่ และ iMac ของสาขาเปิดอยู่");
        }
      }, 1500);
    } catch {
      setPhase("error"); setMsg("เกิดข้อผิดพลาด ลองอีกครั้ง");
    }
  };

  const busy = phase === "sending" || phase === "printing";
  return (
    <div>
      <button type="button" onClick={press} disabled={phase === "sending"} className={className} style={style}>
        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : phase === "done" ? <Check size={16} /> : <Printer size={16} />}
          {phase === "sending" ? "กำลังส่ง..." : phase === "printing" ? "กำลังพิมพ์..." : phase === "done" ? "พิมพ์แล้ว ✓ (กดเพื่อพิมพ์ซ้ำ)" : label}
        </span>
      </button>
      {msg && (
        <p style={{ display: "flex", gap: 6, alignItems: "flex-start", marginTop: 6, fontSize: 12, lineHeight: 1.4, color: phase === "error" ? "#B42318" : "#977A6F" }}>
          {phase === "error" && <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />}
          <span>{msg}</span>
        </p>
      )}
    </div>
  );
}
