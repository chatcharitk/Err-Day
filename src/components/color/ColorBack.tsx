"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/**
 * Back arrow for the colour-record screens. Moves inside the section replace
 * the history entry, so the card always sits one step after the page it was
 * opened from — `history` mode just steps back to it. Pushing that page instead
 * made a loop: its own back button (router.back) returned to the card.
 * Falls back to `href` when the card was opened directly (no page to go back to).
 */
export default function ColorBack({ href, history }: { href: string; history: boolean }) {
  const router = useRouter();
  function go() {
    // document.referrer is only the full-page-load referrer (client navigation
    // doesn't update it, and the installed app has none), so only reject a
    // referrer from another site.
    const ref = document.referrer;
    const cameFromApp = window.history.length > 1 && (!ref || ref.startsWith(location.origin));
    if (history && cameFromApp) router.back();
    else router.replace(href);
  }
  return (
    <button type="button" onClick={go} className="p-1" style={{ color: "#A08070" }} aria-label="กลับ"><ArrowLeft size={18} /></button>
  );
}
