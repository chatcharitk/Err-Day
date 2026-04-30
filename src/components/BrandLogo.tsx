/**
 * BrandLogo — renders the err·day logotype in the brand serif font.
 *
 * Props:
 *   light  — white version (for use on dark/red backgrounds)
 *   size   — "sm" | "md" | "lg" | "xl"  (default "md")
 *   className — extra tailwind / style classes
 */

interface BrandLogoProps {
  light?:     boolean;
  size?:      "sm" | "md" | "lg" | "xl";
  className?: string;
}

const SIZE_MAP = {
  sm: "text-lg",
  md: "text-2xl",
  lg: "text-4xl",
  xl: "text-5xl",
};

export default function BrandLogo({ light = false, size = "md", className = "" }: BrandLogoProps) {
  const color = light ? "#ffffff" : "#8B1D24";

  return (
    <span
      className={`${SIZE_MAP[size]} font-[family-name:var(--font-brand)] font-[500] tracking-tight leading-none select-none ${className}`}
      style={{ color }}
      aria-label="err.day"
    >
      err<span style={{ letterSpacing: "0.05em", opacity: 0.8 }}>·</span>day
    </span>
  );
}
