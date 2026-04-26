"use client";

import { createContext, useContext, useState, useEffect } from "react";

export type Lang = "th" | "en";

const LangCtx = createContext<{ lang: Lang; toggle: () => void }>({
  lang: "th",
  toggle: () => {},
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>("th");

  useEffect(() => {
    const saved = localStorage.getItem("errday_lang") as Lang | null;
    if (saved === "en") setLang("en");
  }, []);

  const toggle = () =>
    setLang((l) => {
      const next: Lang = l === "th" ? "en" : "th";
      localStorage.setItem("errday_lang", next);
      return next;
    });

  return <LangCtx.Provider value={{ lang, toggle }}>{children}</LangCtx.Provider>;
}

export function useLang() {
  return useContext(LangCtx);
}
