import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { isR2Configured, uploadToR2 } from "@/lib/r2";

/** A branch's print helper counts as connected if it checked in within this long. */
export const AGENT_ONLINE_MS = 150_000;
/** A job nobody picked up in this long is dropped, so an iMac waking up hours later doesn't spit out old slips. */
export const JOB_EXPIRE_MS = 10 * 60_000;
/** Claimed but no result reported in this long → the helper probably died mid-print. */
export const JOB_STUCK_MS = 2 * 60_000;

/** Whether a helper that last checked in at `seenAt` still counts as connected. */
export const isAgentOnline = (seenAt: Date | null | undefined) => !!seenAt && Date.now() - seenAt.getTime() < AGENT_ONLINE_MS;

export const hashKey = (key: string) => createHash("sha256").update(key).digest("hex");
export const newAgentKey = () => "epk_" + randomBytes(24).toString("hex");

/** The branch whose helper sent `Authorization: Bearer <key>`, or null. */
export async function agentBranch(request: Request) {
  const m = (request.headers.get("authorization") ?? "").match(/^Bearer\s+(epk_[0-9a-f]{48})$/);
  if (!m) return null;
  return prisma.branch.findFirst({ where: { printAgentKeyHash: hashKey(m[1]) }, select: { id: true, name: true } });
}

export function signalKey(branchId: string) { return `print-signal/${branchId}.json`; }
export function signalUrl(branchId: string): string | null {
  const base = (process.env.R2_PUBLIC_URL ?? "").trim().replace(/\/+$/, "");
  return isR2Configured() && base ? `${base}/${signalKey(branchId)}` : null;
}

/**
 * Wake the branch's helper: it polls this tiny public file (Cloudflare, not our
 * functions or database) and only calls the server when the number changes.
 * Best effort — the helper also checks in on a timer, so a missed write is
 * just a few seconds' delay.
 */
export async function pingAgent(branchId: string): Promise<void> {
  if (!isR2Configured()) return;
  try {
    await uploadToR2(signalKey(branchId), Buffer.from(JSON.stringify({ n: Date.now() })), "application/json", { cacheControl: "no-store, max-age=0" });
  } catch (e) {
    console.error("[print] signal write failed", e);
  }
}

/** Origin of the request (for the receipt QR), same rule as the receipt page. */
export function originOf(request: Request): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_APP_URL ?? "");
}
