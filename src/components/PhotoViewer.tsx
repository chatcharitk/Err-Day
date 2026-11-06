"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

/** Full-screen photo view: tap outside or ✕ to close, swipe / arrows / ← → keys to move. */
export default function PhotoViewer({ urls, start, onClose }: { urls: string[]; start: number; onClose: () => void }) {
  const [i, setI] = useState(start);
  const touchX = useRef<number | null>(null);
  const go = (d: number) => setI(x => (x + d + urls.length) % urls.length);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") setI(x => (x - 1 + urls.length) % urls.length);
      if (e.key === "ArrowRight") setI(x => (x + 1) % urls.length);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose, urls.length]);

  if (!urls.length) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.92)" }} onClick={onClose}
      onTouchStart={e => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={e => {
        const s = touchX.current; touchX.current = null;
        if (s == null || urls.length < 2) return;
        const dx = e.changedTouches[0].clientX - s;
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
      }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={urls[i]} alt="" className="max-w-full max-h-full object-contain select-none" onClick={e => e.stopPropagation()} />
      <button type="button" onClick={onClose} className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center text-white" style={{ background: "rgba(255,255,255,0.15)" }} aria-label="ปิด"><X size={20} /></button>
      {urls.length > 1 && (
        <>
          <button type="button" onClick={e => { e.stopPropagation(); go(-1); }} className="absolute left-3 w-10 h-10 rounded-full flex items-center justify-center text-white" style={{ background: "rgba(255,255,255,0.15)" }} aria-label="รูปก่อนหน้า"><ChevronLeft size={22} /></button>
          <button type="button" onClick={e => { e.stopPropagation(); go(1); }} className="absolute right-3 w-10 h-10 rounded-full flex items-center justify-center text-white" style={{ background: "rgba(255,255,255,0.15)" }} aria-label="รูปถัดไป"><ChevronRight size={22} /></button>
          <p className="absolute bottom-6 text-white/80 text-sm tabular-nums">{i + 1} / {urls.length}</p>
        </>
      )}
    </div>
  );
}
