"use client";
import { Download } from "lucide-react";

export default function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()}
      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
      style={{ background: "#8B1D24" }}>
      <Download size={16} /> ดาวน์โหลด PDF / พิมพ์
    </button>
  );
}
