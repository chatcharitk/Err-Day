/**
 * Cron-driven notification dispatcher.
 *
 * Fired by Vercel Cron (vercel.json) every 15 minutes. On each run:
 *
 *   1. Booking reminders (4 hours before): scan bookings whose
 *      [date + startTime] falls inside [now+3.5h, now+4.5h] window and have
 *      an active status.
 *   2. Membership expiry warnings (1 day before): scan memberships whose
 *      `expiresAt` is in [now+12h, now+36h].
 *   3. Package expiry warnings (1 day before): same window, on
 *      CustomerPackage rows that are still open and not used up.
 *
 * Idempotency is handled inside each `send*` function via NotificationLog's
 * unique (kind, targetId) constraint — the cron can run as often as it
 * likes without spamming customers.
 *
 * Auth: requires `Authorization: Bearer <CRON_SECRET>` header. Vercel Cron
 * sends this automatically when CRON_SECRET is set in env.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/admin-auth";
import {
  sendBookingReminder4h,
  sendMembershipExpiryWarning1d,
  sendPackageExpiryWarning1d,
  sendBranchDailySummary,
  sendStaffShiftSummary,
  sendOwnerPayrollSummary,
} from "@/lib/notifications";
import { branchesWithGroups } from "@/lib/line-groups";

export const dynamic = "force-dynamic";

/**
 * Combine a stored booking date (UTC noon of the Bangkok calendar day) with
 * a Bangkok-local "HH:mm" startTime, returning the actual UTC moment of the
 * booking. Server-side TZ is UTC; bookings store local "HH:mm" only.
 */
const TZ_OFFSET_HOURS = 7; // Asia/Bangkok
function bookingMomentUtc(date: Date, hhmm: string): Date {
  const y  = date.getUTCFullYear();
  const mo = date.getUTCMonth();
  const d  = date.getUTCDate();
  const [h, m] = hhmm.split(":").map(Number);
  // Build a "Bangkok wall-clock as if it were UTC", then shift back by +7h
  return new Date(Date.UTC(y, mo, d, h, m, 0, 0) - TZ_OFFSET_HOURS * 60 * 60 * 1000);
}

export async function GET(request: Request) {
  // Auth: accept any of
  //   1. `Authorization: Bearer ${CRON_SECRET}` (Vercel Cron)
  //   2. `?secret=${CRON_SECRET}` (manual curl)
  //   3. valid admin session cookie (manual run from /admin/notifications)
  const expected = process.env.CRON_SECRET;
  let authed = false;

  if (expected) {
    const auth = request.headers.get("authorization") ?? "";
    const url  = new URL(request.url);
    const qs   = url.searchParams.get("secret");
    if (auth === `Bearer ${expected}` || qs === expected) authed = true;
  } else {
    // No CRON_SECRET configured — fall back to admin auth only
    authed = false;
  }

  if (!authed) {
    const admin = await getCurrentAdmin();
    if (admin) authed = true;
  }

  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // ── 1) Booking reminders (~4h before) ────────────────────────────────────
  // Window: bookings starting between now+3h and now+5h. Widened from the
  // original ±0.5h band because the cron is scheduled every 15 min but actually
  // fires only every ~2–3h (GitHub Actions / Vercel Hobby both drop ticks). A 2h
  // window means a sparse tick still catches each booking; NotificationLog's
  // unique (kind,targetId) guarantees it's sent exactly once. The customer copy
  // ("ในอีกประมาณ 4 ชั่วโมง") stays apt for anything 3–5h out.
  const windowStart = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  const windowEnd   = new Date(now.getTime() + 5 * 60 * 60 * 1000);

  // Bookings store `date` as UTC noon of the local calendar day, so for any
  // window crossing midnight we must include both today and tomorrow.
  const dayWindowStart = new Date(now);  dayWindowStart.setUTCHours(0, 0, 0, 0);
  const dayWindowEnd   = new Date(now);  dayWindowEnd.setUTCHours(23, 59, 59, 999);
  dayWindowEnd.setUTCDate(dayWindowEnd.getUTCDate() + 1);

  const candidateBookings = await prisma.booking.findMany({
    where: {
      date:   { gte: dayWindowStart, lte: dayWindowEnd },
      status: { in: ["PENDING", "CONFIRMED"] },
      customer: { lineUserId: { not: null } },
    },
    select: { id: true, date: true, startTime: true },
  });

  const dueBookings = candidateBookings.filter((b) => {
    const dt = bookingMomentUtc(b.date, b.startTime);
    return dt >= windowStart && dt <= windowEnd;
  });

  // ── 2) Memberships expiring in ~1 day ────────────────────────────────────
  const expiryWindowStart = new Date(now.getTime() + 12 * 60 * 60 * 1000); // 0.5d
  const expiryWindowEnd   = new Date(now.getTime() + 36 * 60 * 60 * 1000); // 1.5d

  const dueMemberships = await prisma.membership.findMany({
    where: {
      expiresAt: { gte: expiryWindowStart, lte: expiryWindowEnd },
      customer:  { lineUserId: { not: null } },
    },
    select: { id: true },
  });

  // ── 3) Packages expiring in ~1 day ───────────────────────────────────────
  const duePackages = await prisma.customerPackage.findMany({
    where: {
      expiresAt: { gte: expiryWindowStart, lte: expiryWindowEnd },
      closedAt:  null,
      customer:  { lineUserId: { not: null } },
    },
    select: { id: true },
  });

  // ── Send all (sequentially to keep LINE rate-limit-friendly) ─────────────
  const results: { kind: string; targetId: string; status: string; reason?: string }[] = [];

  for (const b of dueBookings) {
    results.push(await sendBookingReminder4h(b.id));
  }
  for (const m of dueMemberships) {
    results.push(await sendMembershipExpiryWarning1d(m.id));
  }
  for (const p of duePackages) {
    results.push(await sendPackageExpiryWarning1d(p.id));
  }

  // ── 4) Branch daily summary — fires in the 20:00–23:59 Bangkok window ──
  // Lists TOMORROW's bookings to each branch's LINE group. The window was
  // widened from 2h (22:00–23:59) to 4h (20:00–23:59) because the cron actually
  // fires only every ~2–3h on this stack (GitHub Actions + Vercel Hobby both
  // drop ticks) — a 4h window all but guarantees at least one qualifying tick.
  // The NotificationLog row keyed by the target (tomorrow) date means only the
  // FIRST qualifying tick of the evening actually sends — the rest no-op, so the
  // wider window never double-sends.
  const summaryResults: { branchId: string; status: string; count?: number; reason?: string }[] = [];
  const bkkHour = new Date(now.getTime() + 7 * 60 * 60 * 1000).getUTCHours();
  if (bkkHour >= 20) {
    const bkk = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    const tomorrow = new Date(Date.UTC(bkk.getUTCFullYear(), bkk.getUTCMonth(), bkk.getUTCDate() + 1));
    const dstr = tomorrow.toISOString().slice(0, 10);
    for (const branchId of branchesWithGroups()) {
      try {
        // dedup marker — unique (kind,targetId). Reuses an existing kind value.
        await prisma.notificationLog.create({
          data: { kind: "BOOKING_REMINDER_4H", targetId: `dsum:${branchId}:${dstr}`, status: "SENT" },
        });
      } catch (e) {
        if ((e as { code?: string }).code === "P2002") continue; // already sent today
        throw e;
      }
      summaryResults.push(await sendBranchDailySummary(branchId));
    }

    // Staff shift schedule → DM the owners (Looklipair + Chatcharit), once/day.
    try {
      await prisma.notificationLog.create({
        data: { kind: "BOOKING_REMINDER_4H", targetId: `shiftsum:${dstr}`, status: "SENT" },
      });
      const sh = await sendStaffShiftSummary();
      summaryResults.push({ branchId: "shifts", status: sh.status, count: sh.count });
    } catch (e) {
      if ((e as { code?: string }).code !== "P2002") throw e; // P2002 = already sent today
    }

    // Owner payroll summary — today's commission + OT to pay, DM'd to owners.
    // Uses TODAY (the day that just finished) rather than tomorrow.
    try {
      await prisma.notificationLog.create({
        data: { kind: "BOOKING_REMINDER_4H", targetId: `payroll:${bkk.toISOString().slice(0, 10)}`, status: "SENT" },
      });
      const pr = await sendOwnerPayrollSummary();
      summaryResults.push({ branchId: "payroll", status: pr.status });
    } catch (e) {
      if ((e as { code?: string }).code !== "P2002") throw e; // already sent today
    }
  }

  const stats = {
    bookings:    dueBookings.length,
    memberships: dueMemberships.length,
    packages:    duePackages.length,
    sent:    results.filter((r) => r.status === "SENT" && r.reason !== "already").length,
    skipped: results.filter((r) => r.status === "SKIPPED").length,
    failed:  results.filter((r) => r.status === "FAILED").length,
    already: results.filter((r) => r.reason === "already").length,
    ranAt:   now.toISOString(),
  };

  return NextResponse.json({ ok: true, stats, results, summaryResults });
}

// Allow POST too — some cron services send POST instead of GET
export const POST = GET;
