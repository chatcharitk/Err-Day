/**
 * BrandLogo — renders the err·day logo.
 *
 * Props:
 *   light  — white text version (for use on dark/red backgrounds)
 *            The actual logo image has a white background so it can only
 *            be used on light backgrounds; on red/dark backgrounds the
 *            white text variant is rendered instead.
 *   size   — "sm" | "md" | "lg" | "xl"  (default "md")
 *   className — extra tailwind / style classes
 */

import Image from "next/image";

interface BrandLogoProps {
  light?:     boolean;
  size?:      "sm" | "md" | "lg" | "xl";
  className?: string;
}

// Height in pixels for each size — width auto-scales to preserve aspect ratio
const HEIGHT_MAP = {
  sm: 22,
  md: 32,
  lg: 48,
  xl: 64,
};

// Fallback text sizes when rendering the white variant
const TEXT_SIZE_MAP = {
  sm: "text-lg",
  md: "text-2xl",
  lg: "text-4xl",
  xl: "text-5xl",
};

export default function BrandLogo({ light = false, size = "md", className = "" }: BrandLogoProps) {
  const h = HEIGHT_MAP[size];

  // On red/dark backgrounds use white text (image has white bg so can't be used here)
  if (light) {
    return (
      <span
        className={`${TEXT_SIZE_MAP[size]} font-[family-name:var(--font-brand)] font-[500] tracking-tight leading-none select-none ${className}`}
        style={{ color: "#ffffff" }}
        aria-label="err.day"
      >
        err<span style={{ letterSpacing: "0.05em", opacity: 0.8 }}>·</span>day
      </span>
    );
  }

  // On white/cream backgrounds use the actual logo image
  return (
    <Image
      src="/logo.jpg"
      alt="err.day"
      height={h}
      width={h * 4.2}        // logo aspect ratio ≈ 4.2 : 1
      className={`object-contain select-none ${className}`}
      priority
    />
  );
}
