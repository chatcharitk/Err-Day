/**
 * One-time migration: copy every Vercel Blob object to Cloudflare R2 (keeping
 * the same key/path), then rewrite the stored URLs in the DB from the Blob
 * origin to R2_PUBLIC_URL. Blob originals are left intact (backup + still serve
 * any URL uploaded during the migration window).
 *
 * Run: npx tsx --env-file=.env --env-file=.env.local scripts/migrate-blob-to-r2.ts
 */
import { list } from "@vercel/blob";
import { uploadToR2 } from "@/lib/r2";
import { prisma } from "@/lib/prisma";

const CONCURRENCY = 12;

async function main() {
  // ── Phase 1: enumerate every Blob ────────────────────────────────────────
  let cursor: string | undefined;
  let iters = 0;
  let blobOrigin: string | null = null;
  const jobs: { url: string; key: string }[] = [];
  do {
    const res = await list({ cursor, limit: 1000 });
    for (const b of res.blobs) {
      if (!blobOrigin) blobOrigin = new URL(b.url).origin;
      jobs.push({ url: b.url, key: b.pathname });
    }
    cursor = res.cursor;
    iters++;
  } while (cursor && iters < 60);
  console.log(`found ${jobs.length} blobs · origin ${blobOrigin}`);

  // ── Phase 2: copy each to R2 (batched) ───────────────────────────────────
  let copied = 0, failed = 0;
  for (let i = 0; i < jobs.length; i += CONCURRENCY) {
    await Promise.all(jobs.slice(i, i + CONCURRENCY).map(async (j) => {
      try {
        const r = await fetch(j.url);
        if (!r.ok) throw new Error(`fetch ${r.status}`);
        const ct = r.headers.get("content-type") || "application/octet-stream";
        const buf = Buffer.from(await r.arrayBuffer());
        await uploadToR2(j.key, buf, ct);
        copied++;
      } catch (e) {
        failed++;
        console.error("  FAIL", j.key, (e as Error).message);
      }
    }));
    if (i % 240 === 0) console.log(`  ${copied + failed}/${jobs.length} processed (${failed} failed)`);
  }
  console.log(`copy done: ${copied} copied, ${failed} failed`);

  // ── Phase 3: rewrite DB URLs (Blob origin → R2 public URL) ────────────────
  if (failed > 0) {
    console.log(`⚠️  ${failed} copy failure(s) — SKIPPING DB rewrite so nothing breaks. Re-run to retry (copies are idempotent).`);
    await prisma.$disconnect();
    return;
  }
  if (!blobOrigin) { console.log("no blobs — skipping DB rewrite"); await prisma.$disconnect(); return; }
  const r2 = (process.env.R2_PUBLIC_URL || "").replace(/\/$/, "");
  const cols: [string, string][] = [
    ["Branch", "imageUrl"],
    ["Service", "imageUrl"],
    ["Staff", "avatarUrl"],
    ["Customer", "pictureUrl"],
    ["Customer", "photoUrls"],
    ["Booking", "receiptUrl"],
    ["Expense", "receiptUrl"],
    ["PaymentSlip", "imageUrl"],
  ];
  for (const [table, col] of cols) {
    const n = await prisma.$executeRawUnsafe(
      `UPDATE "${table}" SET "${col}" = REPLACE("${col}", $1, $2) WHERE "${col}" LIKE $3`,
      blobOrigin, r2, `%${blobOrigin}%`,
    );
    console.log(`  ${table}.${col}: rewrote ${n} row(s)`);
  }
  console.log("DB rewrite done");
  await prisma.$disconnect();
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
