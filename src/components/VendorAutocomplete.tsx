"use client";

/**
 * Free-text vendor input with a fuzzy-search dropdown of previously-used
 * vendors. Typing anything and submitting the form still works — the server
 * find-or-creates a Vendor record from whatever name is saved (see the
 * expense create/update API), so the registry builds itself without forcing
 * the user to explicitly "pick" an existing entry every time.
 *
 * Selecting a suggestion additionally prefills its default category, since
 * that's the whole point of "search and reuse" — one click restores the
 * usual vendor + category pairing instead of retyping both.
 */
import { useEffect, useRef, useState } from "react";

interface VendorHit { id: string; name: string; phone: string | null; category: string | null }

interface Props {
  value: string;
  onChange: (name: string) => void;
  onSelectCategory?: (category: string) => void;
  placeholder?: string;
  borderColor: string;
  textColor: string;
  mutedColor: string;
  inputClassName?: string;
}

export default function VendorAutocomplete({
  value, onChange, onSelectCategory, placeholder,
  borderColor, textColor, mutedColor, inputClassName,
}: Props) {
  const [hits, setHits]   = useState<VendorHit[]>([]);
  const [open, setOpen]   = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/vendors?q=${encodeURIComponent(value.trim())}&limit=6`);
        if (!res.ok) return;
        const data = await res.json();
        setHits(data.vendors ?? []);
      } catch { /* keep last good list */ }
    }, 200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [value]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div ref={wrapRef} className="relative">
      <input
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
        className={inputClassName}
        style={{ borderColor, color: textColor }}
      />
      {open && hits.length > 0 && (
        <div
          className="absolute z-20 left-0 right-0 mt-1 rounded-lg bg-white shadow-lg overflow-hidden max-h-56 overflow-y-auto"
          style={{ border: `1px solid ${borderColor}` }}
        >
          {hits.map(h => (
            <button
              key={h.id}
              type="button"
              onClick={() => {
                onChange(h.name);
                if (h.category && onSelectCategory) onSelectCategory(h.category);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-stone-50 flex items-center justify-between gap-2"
              style={{ color: textColor }}
            >
              <span className="truncate">{h.name}</span>
              {h.phone && <span className="text-xs flex-shrink-0" style={{ color: mutedColor }}>{h.phone}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
