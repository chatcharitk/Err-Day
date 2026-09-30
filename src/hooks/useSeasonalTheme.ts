"use client";

import { useEffect, useState } from "react";
import { isSeasonalTheme, seasonalThemeAt, type SeasonalTheme } from "@/lib/seasonal-theme";

const PREVIEW_KEY = "errday-theme-preview";

/**
 * The seasonal theme for the customer app, resolved on the client from the
 * device clock so ISR-cached pages still switch exactly at Bangkok midnight.
 * Starts null (normal) to match the server render, then updates after mount.
 *
 * Preview before launch with `?theme=halloween` (or `?theme=normal` to force
 * the regular look); the choice sticks for the browser tab via sessionStorage.
 */
export function useSeasonalTheme(): SeasonalTheme | null {
  const [theme, setTheme] = useState<SeasonalTheme | null>(null);

  useEffect(() => {
    let preview: string | null = null;
    try {
      const param = new URLSearchParams(window.location.search).get("theme");
      if (param) sessionStorage.setItem(PREVIEW_KEY, param);
      preview = param ?? sessionStorage.getItem(PREVIEW_KEY);
    } catch { /* storage blocked — fall back to the calendar */ }

    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only clock/URL read; server renders normal
    setTheme(preview === "normal" ? null : isSeasonalTheme(preview) ? preview : seasonalThemeAt(new Date()));
  }, []);

  return theme;
}
