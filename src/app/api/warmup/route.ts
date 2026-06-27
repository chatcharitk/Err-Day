import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/warmup — keep the serverless function (and its Neon connection) warm.
 *
 * A Vercel function spins down after inactivity; the next request then pays a
 * cold start (~1.5–3s), which on this stack also includes establishing the Neon
 * WebSocket connection. Pinging this every few minutes keeps a warm instance —
 * and its Prisma/Neon connection — alive, so real visitors hit a hot path.
 *
 * The `SELECT 1` warms the DB connection (not just the JS function). Cheap,
 * public, returns no data. Never cached so it always actually executes.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const t0 = Date.now();
  let dbMs = -1;
  try {
    const s = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbMs = Date.now() - s;
  } catch (e) {
    console.error("[warmup] db ping failed", e);
  }
  return NextResponse.json(
    { ok: true, dbMs, totalMs: Date.now() - t0 },
    { headers: { "Cache-Control": "no-store" } },
  );
}

// Some uptime pingers send HEAD/POST.
export const POST = GET;
export const HEAD = GET;
