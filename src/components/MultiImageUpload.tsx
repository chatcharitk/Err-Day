"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, X, Plus } from "lucide-react";
import { resizeImageFile } from "@/lib/resize-image";

interface Props {
  /** Storage path kind (same endpoint as ImageUpload). */
  kind:     "receipt";
  /** Reference id (booking id) — also used in the storage path. */
  ref:      string;
  /** Current image URLs, in order. */
  value:    string[];
  /** Called with the full new list after an add or a remove. */
  onChange: (urls: string[]) => void | Promise<void>;
  label?:   string;
  /** Text on the big add button, e.g. "แนบสลิป". */
  addLabel?: string;
  /** Upper bound so a stuck tap can't pile up endless uploads. */
  max?:     number;
}

const PRIMARY = "#8B1D24";
const MUTED   = "#A08070";
const BORDER  = "#E8D8CC";

/**
 * A grid of images with a full-width add button under it: pick one or several
 * photos at once, tap a thumbnail to open it full-size, ✕ to remove one. Uploads go one after the
 * other and the list is saved once at the end.
 */
export default function MultiImageUpload({ kind, ref: refId, value, onChange, label, addLabel = "เพิ่มรูป", max = 10 }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err,  setErr]  = useState("");

  const onFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).slice(0, Math.max(0, max - value.length));
    if (files.length === 0) return;
    setBusy(true); setErr("");
    const added: string[] = [];
    try {
      for (const file of files) {
        const resized = await resizeImageFile(file);
        const fd = new FormData();
        fd.append("file", resized);
        const res = await fetch(`/api/upload?kind=${kind}&ref=${encodeURIComponent(refId)}`, { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) { setErr(data.error ?? "อัปโหลดไม่สำเร็จ"); break; }
        added.push(data.url);
      }
      // Save whatever did upload, even if a later one failed.
      if (added.length > 0) await onChange([...value, ...added]);
    } catch {
      setErr("เกิดข้อผิดพลาด");
      if (added.length > 0) await onChange([...value, ...added]);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = (url: string) => onChange(value.filter(u => u !== url));
  const canAdd = value.length < max;

  return (
    <div>
      {label && (
        <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: MUTED }}>
          {label}{value.length > 0 ? ` · ${value.length} รูป` : ""}
        </p>
      )}
      <input ref={inputRef} type="file" accept="image/*" multiple onChange={onFiles} className="hidden" />

      {value.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {value.map((url, i) => (
            <div key={url} className="relative aspect-square rounded-xl overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
              <button type="button" onClick={() => window.open(url, "_blank")} className="block w-full h-full" aria-label={`เปิดรูปที่ ${i + 1}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`รูปที่ ${i + 1}`} className="w-full h-full object-cover" />
              </button>
              <button
                type="button"
                onClick={() => remove(url)}
                disabled={busy}
                className="absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center disabled:opacity-50"
                style={{ background: "rgba(0,0,0,0.55)", color: "white" }}
                aria-label={`ลบรูปที่ ${i + 1}`}
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Big, full-width add button — the old third-width tile was too small to hit. */}
      {canAdd && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className={`w-full rounded-2xl flex items-center justify-center gap-3 px-4 disabled:opacity-60 active:scale-[0.99] ${value.length === 0 ? "py-7" : "py-4 mt-2"}`}
          style={{ border: `2px dashed ${PRIMARY}`, background: "#FFF8F4", color: PRIMARY }}
        >
          {busy
            ? <Loader2 size={26} className="animate-spin" />
            : value.length === 0 ? <Camera size={28} /> : <Plus size={24} />}
          <span className="text-left leading-tight">
            <span className="block text-base font-semibold">
              {busy ? "กำลังอัปโหลด..." : addLabel}
            </span>
            {!busy && value.length === 0 && (
              <span className="block text-xs mt-0.5" style={{ color: MUTED }}>ถ่ายหรือเลือกรูป · เลือกได้หลายรูป</span>
            )}
          </span>
        </button>
      )}
      {err && <p className="text-xs text-red-600 mt-1.5">{err}</p>}
    </div>
  );
}
