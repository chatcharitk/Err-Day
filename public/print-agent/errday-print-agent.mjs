#!/usr/bin/env node
/**
 * err.day print helper — runs on the branch's iMac and sends receipts to the
 * shop's network thermal printer (Xprinter XP-C300H, port 9100).
 *
 * Needs only Node 18+. No packages to install. Settings come from the
 * environment (the installer sets them):
 *   ERRDAY_KEY      this branch's key (from the admin page)         [required]
 *   PRINTER_HOST    the printer's IP address on the shop network    [required]
 *   PRINTER_PORT    default 9100
 *   PRINT_WIDTH     dots across the paper, default 576 (80 mm)
 *   ERRDAY_URL      default https://book.err-daysalon.com
 *
 *   node errday-print-agent.mjs --check   # just test the printer connection
 */
import net from "node:net";

const BASE   = (process.env.ERRDAY_URL ?? "https://book.err-daysalon.com").replace(/\/+$/, "");
const KEY    = process.env.ERRDAY_KEY ?? "";
const HOST   = process.env.PRINTER_HOST ?? "";
const PORT   = Number(process.env.PRINTER_PORT ?? 9100);
const WIDTH  = Number(process.env.PRINT_WIDTH ?? 576);
const log = (...a) => console.log(new Date().toLocaleTimeString("en-GB"), ...a);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/** Send raw bytes to the printer; resolves when the printer's socket has closed cleanly. */
function sendToPrinter(bytes, tries = 3) {
  const once = () => new Promise((resolve, reject) => {
    const s = net.createConnection({ host: HOST, port: PORT });
    s.setTimeout(10_000);
    s.on("timeout", () => { s.destroy(); reject(new Error(`เครื่องพิมพ์ไม่ตอบสนอง (${HOST}:${PORT})`)); });
    s.on("error", (e) => reject(new Error(`เชื่อมต่อเครื่องพิมพ์ไม่ได้ (${HOST}:${PORT}) — ${e.code ?? e.message}`)));
    s.on("connect", () => s.end(bytes));
    s.on("close", (hadError) => { if (!hadError) resolve(); });
  });
  return (async () => {
    for (let i = 1; ; i++) {
      try { return await once(); }
      catch (e) { if (i >= tries) throw e; await sleep(1500); }
    }
  })();
}

if (process.argv.includes("--check")) {
  if (!HOST) { console.error("ตั้ง PRINTER_HOST ก่อน เช่น PRINTER_HOST=192.168.1.50"); process.exit(1); }
  const text = Buffer.from("\x1b@err.day printer OK\n\n\n\n", "ascii");
  const cut = Buffer.from([0x1d, 0x56, 0x42, 0x40]);
  sendToPrinter(Buffer.concat([text, cut])).then(() => { console.log("ส่งเข้าเครื่องพิมพ์แล้ว — ควรมีกระดาษออกมา"); process.exit(0); })
    .catch((e) => { console.error(e.message); process.exit(1); });
} else {
  main();
}

async function api(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
    body: JSON.stringify(body ?? {}),
    signal: AbortSignal.timeout(25_000),
  });
  if (res.status === 401) throw Object.assign(new Error("รหัสเครื่องพิมพ์ไม่ถูกต้อง หรือถูกเปลี่ยนแล้ว"), { fatal: true });
  if (!res.ok) throw new Error(`server ${res.status}`);
  return res.json();
}

async function main() {
  if (!KEY || !HOST) { console.error("ตั้ง ERRDAY_KEY และ PRINTER_HOST ก่อน"); process.exit(1); }
  log(`err.day print helper — printer ${HOST}:${PORT}, server ${BASE}`);

  let signalUrl = null;
  let lastSignal = null;
  let busy = false;

  /** Ask the server for jobs and print them. Never throws. */
  const claim = async () => {
    if (busy) return;
    busy = true;
    try {
      const r = await api("/api/print/agent/claim", { width: WIDTH });
      signalUrl = r.signalUrl ?? signalUrl;
      for (const job of r.jobs ?? []) {
        try {
          await sendToPrinter(Buffer.from(job.data, "base64"));
          await api("/api/print/agent/result", { id: job.id, ok: true });
          log(`พิมพ์แล้ว (${job.id})`);
        } catch (e) {
          log(`พิมพ์ไม่สำเร็จ: ${e.message}`);
          await api("/api/print/agent/result", { id: job.id, ok: false, error: e.message }).catch(() => {});
        }
      }
    } catch (e) {
      if (e.fatal) { console.error(e.message); process.exit(1); }
      log(`ติดต่อเซิร์ฟเวอร์ไม่ได้: ${e.message}`);
    } finally { busy = false; }
  };

  await claim();
  let lastClaim = Date.now();
  // Watch the tiny wake-up file (free, instant); also check in every minute so the
  // admin page shows "connected" and a missed wake-up is never lost for long.
  for (;;) {
    await sleep(2000);
    let wake = false;
    if (signalUrl) {
      try {
        const res = await fetch(`${signalUrl}?t=${Date.now()}`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
        if (res.ok) {
          const n = (await res.json()).n;
          if (lastSignal !== null && n !== lastSignal) wake = true;
          lastSignal = n;
        }
      } catch { /* offline or throttled — the timer below still covers us */ }
    }
    const every = signalUrl ? 60_000 : 10_000;
    if (wake || Date.now() - lastClaim >= every) { lastClaim = Date.now(); await claim(); }
  }
}
