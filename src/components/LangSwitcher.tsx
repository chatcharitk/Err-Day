"use client";

import { useLang } from "./LanguageProvider";

export function LangSwitcher({ className, tone = "dark" }: { className?: string; /** "light" = for pages with a light background. */ tone?: "dark" | "light" }) {
  const { lang, toggle } = useLang();
  const light = tone === "light";

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
        border: light ? "1.5px solid #EADDD4" : "1.5px solid rgba(255,255,255,0.35)",
        color: light ? "#45352F" : "rgba(255,255,255,0.85)",
        background: light ? "white" : "transparent",
        cursor: "pointer",
        transition: "all 0.15s",
      }}
    >
      {lang === "th" ? "EN" : "TH"}
    </button>
  );
}
