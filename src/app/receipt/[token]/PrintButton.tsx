"use client";

/**
 * Print / share controls. Hidden on paper via `.no-print` — they exist only for
 * the on-screen copy.
 */
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
