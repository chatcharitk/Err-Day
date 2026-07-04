/**
 * PWA manifest for the front-desk check-in board. The file-convention
 * app/manifest.ts only works at the app root in this Next version, so the desk
 * gets its manifest from a plain route handler, linked by desk/layout.tsx.
 *
 * `id` keeps this installable side-by-side with the admin app (which is
 * identified by its start_url /admin/m). `scope: "/"` so the one-time
 * setup flow (/desk/setup → /admin/login) stays inside the app window.
 * No `orientation` — the iPad board is used in landscape.
 */
export const dynamic = "force-static";

export function GET() {
  return Response.json(
    {
      id:               "/desk",
      name:             "err.day — หน้าร้าน",
      short_name:       "หน้าร้าน",
      description:      "บอร์ดเช็คอินหน้าร้านสำหรับสาขา err.day",
      start_url:        "/desk",
      scope:            "/",
      display:          "standalone",
      background_color: "#FDF8F3",
      theme_color:      "#8B1D24",
      icons: [
        { src: "/icons/icon-192.png",          sizes: "192x192", type: "image/png" },
        { src: "/icons/icon-512.png",          sizes: "512x512", type: "image/png" },
        { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json" } },
  );
}
