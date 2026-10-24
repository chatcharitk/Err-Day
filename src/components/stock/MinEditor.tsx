"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BORDER, MUTED, PRIMARY } from "./theme";

/** Tap the "เตือน ≤ n" chip to change the low-stock minimum at one place. */
export default function MinEditor({ productId, location, min, custom }: { productId: string; location: string; min: number; custom: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function edit() {
    const v = prompt("แจ้งเตือนเมื่อเหลือไม่เกินกี่ชิ้นที่นี่? (เว้นว่าง = ใช้ค่าเริ่มต้นของสินค้า)", custom ? String(min) : "");
    if (v === null) return;
    setBusy(true);
    await fetch(`/api/admin/stock/products/${productId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ location, minQty: v.trim() === "" ? null : Number(v) }),
    }).catch(() => null);
    setBusy(false);
    router.refresh();
  }
  return (
    <button type="button" onClick={edit} disabled={busy} className="text-[11px] px-2 py-0.5 rounded-full"
      style={{ border: `1px solid ${custom ? PRIMARY : BORDER}`, color: custom ? PRIMARY : MUTED }}>
      {min > 0 ? `เตือน ≤ ${min}` : "ไม่เตือน"}
    </button>
  );
}
