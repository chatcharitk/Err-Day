import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // WebP only. AVIF compresses ~20% better but its encoder costs seconds of
    // CPU per image versus WebP's tens of milliseconds, and on Fluid that lands
    // straight on the CPU bill. Payment slips arrive from LINE continuously, so
    // this is a steady stream of first-encodes, not a one-off at build time.
    formats: ["image/webp"],
    remotePatterns: [
      // Vercel Blob — branch / service / staff / customer photos + receipts.
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
      // LINE profile pictures (LIFF avatars).
      { protocol: "https", hostname: "profile.line-scdn.net" },
    ],
  },
};

export default nextConfig;
