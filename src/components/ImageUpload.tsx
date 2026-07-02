"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, X, ImageIcon } from "lucide-react";
import { resizeImageFile } from "@/lib/resize-image";

interface Props {
  /** Logical kind of upload — used for the storage path. */
  kind:    "receipt" | "profile";
  /** Reference id (booking id, customer id) — also used in the storage path. */
  ref:     string;
  /** Current image URL (if already uploaded). */
  value:   string | null;
  /** Called after successful upload OR after clearing. */
  onChange: (url: string | null) => void;
  /** Round/square preview shape. */
  shape?:  "circle" | "rect";
  /** Label shown above the preview. */
  label?:  string;
}

const PRIMARY = "#8B1D24";
const MUTED   = "#A08070";
const BORDER  = "#E8D8CC";

export default function ImageUpload({ kind, ref: refId, value, onChange, shape = "rect", label }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err,  setErr]  = useState("");

  const onPick = () => inputRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setErr("");
    try {
      const resized = await resizeImageFile(file);   // shrink to fit the 4.5MB upload limit
      const fd = new FormData();
      fd.append("file", resized);
      const res = await fetch(`/api/upload?kind=${kind}&ref=${encodeURIComponent(refId)}`, {
        method: "POST",
        body:   fd,
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error ?? "อัปโหลดไม่สำเร็จ"); return; }
      onChange(data.url);
    } catch {
      setErr("เกิดข้อผิดพลาด");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const previewClass = shape === "circle"
    ? "w-20 h-20 rounded-full"
    : "w-full aspect-[4/3] rounded-xl";

  return (
    <div>
      {label && <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: MUTED }}>{label}</p>}
      <input ref={inputRef} type="file" accept="image/*" onChange={onFile} className="hidden" />

      {value ? (
        <div className="relative inline-block w-full">
          <button
            type="button"
            onClick={() => window.open(value, "_blank")}
            className={`${previewClass} block overflow-hidden`}
            style={{ border: `1px solid ${BORDER}` }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="upload preview" className="w-full h-full object-cover" />
          </button>
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={onPick}
              disabled={busy}
              className="flex-1 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 disabled:opacity-50"
              style={{ background: "white", color: PRIMARY, border: `1px solid ${BORDER}` }}
            >
              {busy ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
              {busy ? "กำลังอัปโหลด..." : "เปลี่ยนรูป"}
            </button>
            <button
              type="button"
              onClick={() => onChange(null)}
              disabled={busy}
              className="px-3 py-2 rounded-lg text-xs disabled:opacity-50"
              style={{ background: "white", color: "#991B1B", border: `1px solid ${BORDER}` }}
            >
              <X size={12} />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={onPick}
          disabled={busy}
          className={`${previewClass} flex flex-col items-center justify-center gap-1 disabled:opacity-50`}
          style={{ border: `1.5px dashed ${BORDER}`, background: "white", color: MUTED }}
        >
          {busy ? <Loader2 size={20} className="animate-spin" style={{ color: PRIMARY }} /> : <ImageIcon size={20} />}
          <span className="text-xs">{busy ? "กำลังอัปโหลด..." : "แตะเพื่อถ่าย/เลือกรูป"}</span>
        </button>
      )}
      {err && <p className="text-xs text-red-600 mt-1">{err}</p>}
    </div>
  );
}
