"use client";

import { useLang } from "./LanguageProvider";

export function LangSwitcher({ className }: { className?: string }) {
  const { lang, toggle } = useLang();

  return (
    <button
      onClick={toggle}
      className={className}
      style={{
        fontSize: "0.75rem",
        fontWeight: 500,
        letterSpacing: "0.05em",
        padding: "2px 10px",
        borderRadius: "999px",
        border: "1.5px solid rgba(255,255,255,0.35)",
        color: "rgba(255,255,255,0.85)",
        background: "transparent",
        cursor: "pointer",
        transition: "all 0.15s",
      }}
    >
      {lang === "th" ? "EN" : "TH"}
    </button>
  );
}
