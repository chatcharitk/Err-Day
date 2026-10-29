"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { RECEIPT_TEXT, type ReceiptLang } from "@/lib/receipt-i18n";

/**
 * Rendered above the receipt card. Every entry point (POS success screen,
 * sales history, mobile booking detail) now opens this page in the SAME tab,
 * so a real browser history entry exists to go back to — router.back() covers
 * it. The one exception is a customer scanning the printed QR fresh: there is
 * no app history to return to, so the button only renders once we can confirm
 * there's actually somewhere to go.
 */
export function ReceiptBackButton({ label = "กลับ" }: { label?: string }) {
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
      aria-label={label}
    >
      <ArrowLeft size={18} /> {label}
    </button>
  );
}

/** TH | EN switch. Replaces the history entry so Back still returns to the till, not to the other language. */
export function ReceiptLangToggle({ lang }: { lang: ReceiptLang }) {
  const router = useRouter();
  const go = (l: ReceiptLang) => { if (l !== lang) router.replace(l === "en" ? "?lang=en" : "?", { scroll: false }); };
  return (
    <div className="no-print receipt-lang">
      <button type="button" onClick={() => go("th")} className={lang === "th" ? "on" : ""}>TH</button>
      <button type="button" onClick={() => go("en")} className={lang === "en" ? "on" : ""}>EN</button>
    </div>
  );
}

/** Print / share controls, below the receipt card. Hidden on paper via `.no-print`. */
export default function PrintButton({ url, lang = "th" }: { url: string; lang?: ReceiptLang }) {
  const t = RECEIPT_TEXT[lang];
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
      alert(t.copied);
    } catch {
      alert(url);
    }
  };

  return (
    <div className="no-print receipt-actions">
      <button type="button" onClick={() => window.print()} className="receipt-btn receipt-btn-primary">
        {t.print}
      </button>
      <button type="button" onClick={share} className="receipt-btn">
        {t.share}
      </button>
    </div>
  );
}
