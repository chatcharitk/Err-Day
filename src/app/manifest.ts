import type { MetadataRoute } from "next";

// PWA manifest (served at /manifest.webmanifest). Installing adds the admin app
// to the Home Screen — required for Web Push on iOS 16.4+. Opens the mobile
// admin home; unauthenticated users land on the admin login.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name:             "err.day — จัดการร้าน",
    short_name:       "err.day",
    description:      "ระบบจัดการร้านและการแจ้งเตือนสำหรับทีม err.day",
    start_url:        "/admin/m",
    scope:            "/",
    display:          "standalone",
    orientation:      "portrait",
    background_color: "#FDF8F3",
    theme_color:      "#8B1D24",
    icons: [
      { src: "/icons/icon-192.png",          sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png",          sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
