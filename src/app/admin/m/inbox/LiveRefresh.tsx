"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Keeps an inbox screen live: every few seconds asks for a tiny change marker
 * and re-renders the server page only when a message or draft actually changed.
 */
export default function LiveRefresh({ threadId, seconds = 3 }: { threadId?: string; seconds?: number }) {
  const router = useRouter();
  const last = useRef<string | null>(null);
  useEffect(() => {
    let alive = true;
    const url = `/api/admin/inbox/version${threadId ? `?thread=${encodeURIComponent(threadId)}` : ""}`;
    async function tick() {
      if (document.visibilityState !== "visible") return;
      const v = await fetch(url, { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(d => d?.v as string | undefined).catch(() => undefined);
      if (!alive || !v) return;
      if (last.current !== null && v !== last.current) router.refresh();
      last.current = v;
    }
    void tick();
    const t = window.setInterval(() => void tick(), seconds * 1000);
    const onVisible = () => { if (document.visibilityState === "visible") void tick(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { alive = false; window.clearInterval(t); document.removeEventListener("visibilitychange", onVisible); };
  }, [router, threadId, seconds]);
  return null;
}
