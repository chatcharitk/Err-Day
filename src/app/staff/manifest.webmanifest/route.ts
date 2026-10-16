/**
 * PWA manifest for the staff portal. Without it, "Add to Home Screen" from
 * /staff used the root manifest (start_url /admin/m), so the installed app
 * opened the admin side and bounced staff to the admin login. Linked from
 * staff/layout.tsx; `id` keeps it installable alongside the admin and desk apps.
 */
export const dynamic = "force-static";

export function GET() {
  return Response.json(
    {
      id:               "/staff",
      name:             "err.day — พนักงาน",
      short_name:       "err.day ทีม",
      description:      "ตารางงาน ค่าตอบแทน และสลิปเงินเดือนของพนักงาน err.day",
      start_url:        "/staff",
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
    },
    { headers: { "Content-Type": "application/manifest+json" } },
  );
}
