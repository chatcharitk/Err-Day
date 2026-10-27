"use client";

import { Printer } from "lucide-react";

export default function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: "#8B1D24" }}>
      <Printer size={15} /> พิมพ์ / บันทึก PDF
    </button>
  );
}
