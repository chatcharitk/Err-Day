"use client";

import { useLang } from "@/components/LanguageProvider";
import { useSeasonalTheme } from "@/hooks/useSeasonalTheme";

/* Decorative-only SVGs for the October Halloween skin (see seasonal-theme.ts). */

const BAT_PATH =
  "M32 11c-1.4 0-2.4 1-3 2.3L27.8 9.5l-.9 3.6C24.5 11 21.6 10 18.5 10 13 10 8.6 13 5 17c3.2-1 6.2-.4 7.6 1.6-3.1.2-5.2 2-6.3 4.2 3.2-1.1 6.3-.4 8.3 1.7 1.1-1.9 4.1-2.8 7.1-1.9 2.3.8 4.2 2.8 5.3 5 .9 1.3 1.8 2.4 5 2.4s4.1-1.1 5-2.4c1.1-2.2 3-4.2 5.3-5 3-.9 6-.1 7.1 1.9 2-2.1 5.1-2.8 8.3-1.7-1.1-2.2-3.2-4-6.3-4.2 1.4-2 4.4-2.6 7.6-1.6C55.4 13 51 10 45.5 10c-3.1 0-6 1-8.4 3.1l-.9-3.6L35 13.3c-.6-1.3-1.6-2.3-3-2.3z";

export function Bat({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 32" aria-hidden="true">
      <path d={BAT_PATH} fill="currentColor" />
    </svg>
  );
}

export function Pumpkin({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 60" aria-hidden="true">
      <path d="M31 12c0-5 1.5-8.5 5-10.5l2.6 2.6C36 6 35 8.6 35 12z" fill="#55722c" />
      <path d="M36 9c3-3 8-3.4 11-1.6-3 .4-6 2-8.2 4.2z" fill="#6f9138" />
      <ellipse cx="20" cy="35" rx="15" ry="21" fill="#d9601a" />
      <ellipse cx="44" cy="35" rx="15" ry="21" fill="#d9601a" />
      <ellipse cx="32" cy="35" rx="15" ry="22" fill="#f07c24" />
      <path d="M20 30l6-6 2 7zm24 0l-6-6-2 7zM17 40c5 6 10 8 15 8s10-2 15-8l-4.5 1-2 3.2-2.8-2.7L32 44l-3.7-2.5-2.8 2.7-2-3.2z" fill="#3b1b0c" />
    </svg>
  );
}

export function Cobweb({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 80 80" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true">
      <path d="M0 0l80 80M0 0l80 30M0 0l30 80M0 0l80 5M0 0l5 80" />
      <path d="M18 7q3 6 3 10 5 0 9 4 2-5 5-8M16 16q7 7 5 12M34 14q10 7 12 17 6 3 10 9M36 28q2 11 0 14 8 0 12 5M7 18q6 3 9 3M25 38q-4 5-10 5M44 49q-3 9-8 12 5 7 6 13M52 30q9 1 20 12" />
    </svg>
  );
}

/** Header flock: three bats drifting above the logo bar. */
export function HalloweenBats() {
  return (
    <span className="hw-bats" aria-hidden="true">
      <Bat className="hw-bat hw-bat-1" />
      <Bat className="hw-bat hw-bat-2" />
      <Bat className="hw-bat hw-bat-3" />
    </span>
  );
}

/**
 * Slim festive band for the standalone booking pages, which keep their normal
 * colours. Renders nothing outside the Halloween window.
 */
export function HalloweenStrip() {
  const theme = useSeasonalTheme();
  const { lang } = useLang();
  if (theme !== "halloween") return null;
  return (
    <div className="hw-strip" role="note">
      <Bat className="hw-strip-bat" />
      <Pumpkin className="hw-strip-pumpkin" />
      <span>{lang === "th" ? "Happy Halloween จาก err.day" : "Happy Halloween from err.day"}</span>
      <Bat className="hw-strip-bat flip" />
    </div>
  );
}
