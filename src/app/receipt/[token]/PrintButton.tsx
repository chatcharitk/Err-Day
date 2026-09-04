"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";

/**
 * Rendered above the receipt card. Every entry point (POS success screen,
 * sales history, mobile booking detail) now opens this page in the SAME tab,
 * so a real browser history entry exists to go back to — router.back() covers
 * it. The one exception is a customer scanning the printed QR fresh: there is
 * no app history to return to, so the button only renders once we can confirm
 * there's actually somewhere to go.
 */
export function ReceiptBackButton() {
  const router = useRouter();
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    setCanGoBack(window.history.length > 1);
  }, []);

  if (!canGoBack) return null;
  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="no-print receipt-back"
      aria-label="กลับ"
    >
      <ArrowLeft size={18} /> กลับ
    </button>
  );
}

/** Print / share controls, below the receipt card. Hidden on paper via `.no-print`. */
export default function PrintButton({ url }: { url: string }) {
  const share = async () => {
    // Web Share on mobile (staff handing the link to a customer); clipboard elsewhere.
    if (navigator.share) {
      try {
        await navigator.share({ url });
        return;
      } catch {
        // User dismissed the sheet — fall through to copying instead.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      alert("คัดลอกลิงก์ใบเสร็จแล้ว");
    } catch {
      alert(url);
    }
  };

  return (
    <div className="no-print receipt-actions">
      <button type="button" onClick={() => window.print()} className="receipt-btn receipt-btn-primary">
        พิมพ์ใบเสร็จ
      </button>
      <button type="button" onClick={share} className="receipt-btn">
        ส่งลิงก์
      </button>
    </div>
  );
}
