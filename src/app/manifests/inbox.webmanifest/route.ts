/**
 * PWA manifest for the AI chat inbox. "Add to Home Screen" from /admin/m/inbox
 * used the root manifest (start_url /admin/m), so the installed icon opened the
 * schedule instead of the chat. Served outside /admin because the browser
 * fetches manifests without cookies and the /admin proxy would redirect it to
 * the login page. Linked from admin/m/inbox/layout.tsx; its own `id` lets it
 * sit on the Home Screen next to the main admin app.
 */
export const dynamic = "force-static";

export function GET() {
  return Response.json(
    {
      id:               "/admin/m/inbox",
      name:             "err.day — แชทลูกค้า",
      short_name:       "แชท err.day",
      description:      "ตอบแชทลูกค้า LINE / Facebook / Instagram พร้อมร่างคำตอบจาก AI",
      start_url:        "/admin/m/inbox",
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
