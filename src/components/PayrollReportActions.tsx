"use client";
import { useState } from "react";
import css from "./Finance.module.css";
export default function PayrollReportActions({ summary }: { summary: string }) {
  const [copied, setCopied] = useState(false),
    [error, setError] = useState("");
  return (
    <div className={`${css.toolbar} ${css.screenOnly}`}>
      <button onClick={() => window.print()}>พิมพ์ / บันทึกเป็น PDF</button>
      <button
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(summary);
            setCopied(true);
          } catch {
            setError("คัดลอกอัตโนมัติไม่ได้ เลือกข้อความสรุปด้านล่างได้เลย");
          }
        }}
      >
        {copied ? "คัดลอกสรุปแล้ว" : "คัดลอกสรุปเพื่อส่ง"}
      </button>
      {error && <p>{error}</p>}
    </div>
  );
}
