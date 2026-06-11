import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Serve modern formats; Next negotiates AVIF→WebP→original per browser.
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      // Vercel Blob — branch / service / staff / customer photos + receipts.
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
      // LINE profile pictures (LIFF avatars).
      { protocol: "https", hostname: "profile.line-scdn.net" },
    ],
  },
};

export default nextConfig;
