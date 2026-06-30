"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Bell, X, Check, BellRing, Loader2 } from "lucide-react";

const PRIMARY = "#8B1D24";
const TEXT    = "#3B2A24";
const MUTED   = "#A08070";
const BORDER  = "#E8D8CC";

interface Item {
  id: string; type: string; title: string; body: string;
  href: string | null; readAt: string | null; createdAt: string;
}

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function timeAgo(iso: string): string {
  const m = Math.floor((Date.now() - Date.parse(iso)) / 60000);
  if (m < 1) return "เมื่อสักครู่";
  if (m < 60) return `${m} นาทีที่แล้ว`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ชม.ที่แล้ว`;
  return `${Math.floor(h / 24)} วันที่แล้ว`;
}

type PushState = "unknown" | "unsupported" | NotificationPermission;

/** Bell + unread badge + dropdown inbox + "enable push" for the admin app.
 *  variant "light" = dark icon (light header); "dark" = light icon (dark sidebar). */
export default function NotificationBell({ variant = "light" }: { variant?: "light" | "dark" }) {
  const router = useRouter();
  const [open, setOpen]       = useState(false);
  const [items, setItems]     = useState<Item[]>([]);
  const [unread, setUnread]   = useState(0);
  const [push, setPush]       = useState<PushState>(() => {
    if (typeof window === "undefined" || typeof navigator === "undefined") return "unknown";
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
    return Notification.permission;
  });
  const [busy, setBusy]       = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/notifications/feed", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.items);
      setUnread(data.unread);
    } catch { /* keep last good */ }
  }, []);

  // Initial load + poll every 20s while visible; pause when hidden. The first
  // fetch is kicked via setTimeout so it isn't a synchronous setState-in-effect.
  useEffect(() => {
    const kick = setTimeout(refresh, 0);
    const id = setInterval(() => { if (document.visibilityState === "visible") refresh(); }, 20_000);
    const onVis = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearTimeout(kick); clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
  }, [refresh]);

  // Register the service worker once (side-effect only — no setState here; the
  // push permission state is seeded by the useState initializer above).
  useEffect(() => {
    if ("serviceWorker" in navigator && "PushManager" in window) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  async function enablePush() {
    if (busy) return;
    if (!VAPID) { alert("ยังไม่ได้ตั้งค่าคีย์การแจ้งเตือน (VAPID) บนเซิร์ฟเวอร์"); return; }
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const perm = await Notification.requestPermission();
      setPush(perm);
      if (perm !== "granted") return;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID) as BufferSource,
      });
      await fetch("/api/admin/push/subscribe", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub),
      });
    } catch (e) {
      console.error("[push] subscribe failed", e);
    } finally {
      setBusy(false);
    }
  }

  function openItem(it: Item) {
    if (!it.readAt) {
      setItems(prev => prev.map(x => (x.id === it.id ? { ...x, readAt: new Date().toISOString() } : x)));
      setUnread(u => Math.max(0, u - 1));
      fetch("/api/admin/notifications/read", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: it.id }),
      }).catch(() => {});
    }
    setOpen(false);
    if (it.href) router.push(it.href);
  }

  function markAll() {
    setItems(prev => prev.map(x => ({ ...x, readAt: x.readAt ?? new Date().toISOString() })));
    setUnread(0);
    fetch("/api/admin/notifications/read", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }),
    }).catch(() => {});
  }

  const iconColor = variant === "dark" ? "rgba(255,255,255,0.85)" : TEXT;

  return (
    <>
      <button onClick={() => { setOpen(true); refresh(); }} aria-label="การแจ้งเตือน"
        className="relative w-9 h-9 rounded-full flex items-center justify-center" style={{ color: iconColor }}>
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center"
            style={{ background: "#DC2626", color: "white" }}>
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} style={{ background: "rgba(0,0,0,0.3)" }}>
          <div onClick={e => e.stopPropagation()}
            className="absolute right-2 top-2 w-[92vw] max-w-sm rounded-2xl bg-white overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
            style={{ border: `1px solid ${BORDER}` }}>
            <div className="px-4 py-3 flex items-center justify-between" style={{ background: PRIMARY }}>
              <p className="text-white font-bold">การแจ้งเตือน</p>
              <div className="flex items-center gap-3">
                {unread > 0 && (
                  <button onClick={markAll} className="text-white/90 text-xs flex items-center gap-1">
                    <Check size={13} /> อ่านทั้งหมด
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="text-white/80" aria-label="ปิด"><X size={20} /></button>
              </div>
            </div>

            {push !== "granted" && push !== "unsupported" && push !== "unknown" && push !== "denied" && (
              <button onClick={enablePush} disabled={busy}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-left disabled:opacity-60"
                style={{ background: "#FFF8F4", color: PRIMARY, borderBottom: `1px solid ${BORDER}` }}>
                {busy ? <Loader2 size={15} className="animate-spin" /> : <BellRing size={15} />}
                เปิดการแจ้งเตือนแบบเด้งบนเครื่องนี้
              </button>
            )}
            {push === "denied" && (
              <p className="px-4 py-2 text-[11px]" style={{ color: "#991B1B", background: "#FEF2F2" }}>
                การแจ้งเตือนถูกปิดไว้ — เปิดได้ในการตั้งค่าของเบราว์เซอร์/เครื่อง
              </p>
            )}

            <div className="flex-1 overflow-y-auto">
              {items.length === 0 ? (
                <p className="text-sm text-center py-10" style={{ color: MUTED }}>ยังไม่มีการแจ้งเตือน</p>
              ) : (
                <ul>
                  {items.map(it => (
                    <li key={it.id}>
                      <button onClick={() => openItem(it)}
                        className="w-full text-left px-4 py-3 active:bg-black/5"
                        style={{ borderBottom: "1px solid #F5EFE9", background: it.readAt ? "white" : "#FFF8F4" }}>
                        <div className="flex items-start gap-2">
                          {!it.readAt && <span className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: PRIMARY }} />}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold" style={{ color: TEXT }}>{it.title}</p>
                            <p className="text-xs whitespace-pre-line mt-0.5" style={{ color: MUTED }}>{it.body}</p>
                            <p className="text-[10px] mt-1" style={{ color: MUTED }}>{timeAgo(it.createdAt)}</p>
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
