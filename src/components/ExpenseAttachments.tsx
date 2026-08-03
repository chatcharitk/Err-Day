"use client";

/**
 * Multi-file attachment uploader for the expense form — receipts, invoices,
 * transfer slips. Each file uploads independently to R2/Blob via the plain
 * (no-OCR) /api/upload endpoint as soon as it's picked; the parent form just
 * holds the resulting URL list and submits it as `attachments` on save.
 *
 * Files are uploaded immediately rather than deferred to submit-time so the
 * user gets per-file progress/error feedback instead of one opaque wait at
 * the very end.
 */
import { useRef, useState } from "react";
import { Paperclip, X, FileText, Loader2 } from "lucide-react";

export interface Attachment {
  url:      string;
  filename: string;
  fileType: string;
}

interface Props {
  attachments: Attachment[];
  onChange:    (next: Attachment[]) => void;
  borderColor: string;
  textColor:   string;
  mutedColor:  string;
  primaryColor: string;
}

const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,application/pdf";
const MAX_BYTES = 8 * 1024 * 1024;

export default function ExpenseAttachments({
  attachments, onChange, borderColor, textColor, mutedColor, primaryColor,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<string[]>([]); // local temp names being uploaded
  const [error, setError] = useState("");

  async function handleFiles(files: FileList) {
    setError("");
    const list = Array.from(files);
    for (const file of list) {
      if (file.size > MAX_BYTES) {
        setError(`${file.name} ใหญ่เกิน 8MB`);
        continue;
      }
      setUploading(prev => [...prev, file.name]);
      try {
        const form = new FormData();
        form.append("file", file);
        const ref = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const res = await fetch(`/api/upload?kind=receipt&ref=${ref}`, { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "upload failed");
        onChange([...attachments, { url: data.url, filename: file.name, fileType: file.type }]);
      } catch (e) {
        setError(e instanceof Error ? e.message : `อัปโหลด ${file.name} ไม่สำเร็จ`);
      } finally {
        setUploading(prev => prev.filter(n => n !== file.name));
      }
    }
  }

  function remove(idx: number) {
    onChange(attachments.filter((_, i) => i !== idx));
  }

  const isImage = (fileType: string) => fileType.startsWith("image/");

  return (
    <div>
      <label className="text-[10px] uppercase tracking-widest block mb-1.5" style={{ color: mutedColor }}>
        ไฟล์แนบ (ไม่บังคับ)
      </label>

      <div className="flex flex-wrap gap-2 mb-2">
        {attachments.map((a, idx) => (
          <div key={a.url + idx} className="relative group">
            {isImage(a.fileType) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.url} alt={a.filename} className="w-16 h-16 rounded-lg object-cover"
                style={{ border: `1px solid ${borderColor}` }} />
            ) : (
              <a href={a.url} target="_blank" rel="noreferrer"
                className="w-16 h-16 rounded-lg flex flex-col items-center justify-center gap-1"
                style={{ border: `1px solid ${borderColor}` }}>
                <FileText size={20} style={{ color: primaryColor }} />
                <span className="text-[8px] px-1 truncate w-full text-center" style={{ color: mutedColor }}>
                  {a.filename.slice(0, 10)}
                </span>
              </a>
            )}
            <button
              type="button"
              onClick={() => remove(idx)}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center bg-white shadow"
              style={{ border: `1px solid ${borderColor}` }}
              title="ลบไฟล์แนบ"
            >
              <X size={11} style={{ color: "#B91C1C" }} />
            </button>
          </div>
        ))}
        {uploading.map(name => (
          <div key={name} className="w-16 h-16 rounded-lg flex items-center justify-center"
            style={{ border: `1px dashed ${borderColor}` }}>
            <Loader2 size={16} className="animate-spin" style={{ color: mutedColor }} />
          </div>
        ))}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={e => { if (e.target.files?.length) handleFiles(e.target.files); e.target.value = ""; }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg"
        style={{ border: `1px solid ${borderColor}`, color: textColor }}
      >
        <Paperclip size={13} /> แนบไฟล์ (เลือกได้หลายไฟล์)
      </button>
      <p className="text-[10px] mt-1.5" style={{ color: mutedColor }}>รูปภาพหรือ PDF สูงสุด 8MB ต่อไฟล์</p>
      {error && <p className="text-xs mt-1.5 text-red-600">{error}</p>}
    </div>
  );
}
