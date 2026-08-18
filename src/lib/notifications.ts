/**
 * Customer notification senders.
 *
 * Each function:
 *   1. Loads the target record (booking / membership / package).
 *   2. Resolves the customer's LINE userId.
 *   3. Skips early if the customer has no LINE link, recording a SKIPPED
 *      log entry — so we don't keep retrying on every cron tick.
 *   4. Pushes the message via line-messaging.
 *   5. Records the outcome in NotificationLog.
 *
 * The `(kind, targetId)` unique index on NotificationLog means re-running a
 * sender after success is a no-op — DB throws P2002 and we swallow it.
 */

import { prisma } from "@/lib/prisma";
import { pushText, pushLine, multicastText } from "@/lib/line-messaging";
import { buildBookingFlex } from "@/lib/flex/booking";
import { buildEntitlementReceivedFlex, buildEntitlementActivatedFlex, promoHeroUrl } from "@/lib/flex/membership";
import { branchGroupId } from "@/lib/line-groups";
import { SALE_ONLY_SKUS } from "@/lib/capacity";
import { notifyAdmins } from "@/lib/notify-admin";
import { PACKAGE_SPECS } from "@/lib/packages";
import { startOfTodayUTC } from "@/lib/utils";

type Kind =
  | "BOOKING_CREATED"
  | "BOOKING_CONFIRMED"
  | "BOOKING_REMINDER_4H"
  | "MEMBERSHIP_ACTIVATED"
  | "MEMBERSHIP_EXPIRY_1D"
  | "PACKAGE_ACTIVATED"
  | "PACKAGE_EXPIRY_1D";

interface SendResult { kind: Kind; targetId: string; status: "SENT" | "FAILED" | "SKIPPED"; reason?: string; }

/** Format a Date as "พ. 30 เม.ย. 2569" in Thai local time. */
function formatDateTh(d: Date): string {
  return d.toLocaleDateString("th-TH", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });
}

/**
 * Insert a NotificationLog row. If a row already exists for (kind, targetId)
 * — typically because a previous run already sent it — silently swallow the
 * unique-violation and return `false`.
 */
async function recordLog(args: {
  kind:      Kind;
  targetId:  string;
  status:    "SENT" | "FAILED" | "SKIPPED";
  recipient?: string | null;
  error?:    string | null;
}): Promise<boolean> {
  try {
    // Upsert (not create): a prior SKIPPED (no LINE link yet) or FAILED
    // (transient) row must be promoted to SENT on success — otherwise the
    // create would hit the unique (kind,targetId) constraint, the row would
    // stay non-SENT, and alreadySent() would keep returning false → the
    // notification re-sends on every cron tick forever.
    await prisma.notificationLog.upsert({
      where:  { kind_targetId: { kind: args.kind, targetId: args.targetId } },
      create: {
        kind:      args.kind,
        targetId:  args.targetId,
        status:    args.status,
        recipient: args.recipient ?? null,
        error:     args.error ?? null,
      },
      update: {
        status:    args.status,
        recipient: args.recipient ?? null,
        error:     args.error ?? null,
        sentAt:    new Date(),
      },
    });
    return true;
  } catch (e) {
    console.error("[notifications] failed to record log", e);
    return false;
  }
}

/** Has this notification already been recorded as SENT? Skip if yes. */
async function alreadySent(kind: Kind, targetId: string): Promise<boolean> {
  const row = await prisma.notificationLog.findUnique({
    where: { kind_targetId: { kind, targetId } },
    select: { status: true },
  });
  return row?.status === "SENT";
}

// ── Staff alert on new booking (push to owner LINE accounts) ─────────────────

const STAFF_LINE_IDS = [
  "U91a73dcc35c56adc217c8afc361265ce", // Looklipair
  "U2548106b79ded01779f134727dc373d3", // Chatcharit
];

async function loadBookingNotification(bookingId: string) {
  return prisma.booking.findUnique({
    where:   { id: bookingId },
    include: { customer: { include: { membership: true } }, branch: true, service: true, staff: true },
  });
}

type BookingNotification = NonNullable<Awaited<ReturnType<typeof loadBookingNotification>>>;

export async function sendStaffBookingAlert(bookingId: string): Promise<void> {
  const b = await loadBookingNotification(bookingId);
  if (!b) return;
  await sendStaffBookingAlertLoaded(b);
}

async function sendStaffBookingAlertLoaded(b: BookingNotification): Promise<void> {

  // Strip "err.day " prefix for a cleaner alert header.
  const branchShort = b.branch.name.replace(/^err\.day\s*/i, "");
  const dateStr = b.date.toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short" });

  const m        = b.customer.membership;
  const now      = new Date();
  const isMember = m != null
    && !m.pendingActivation
    && (m.expiresAt == null || m.expiresAt > now)
    && (m.usagesAllowed === 0 || m.usagesUsed < m.usagesAllowed);

  const adminNotice = {
    type:  "BOOKING_NEW",
    title: `จองใหม่ · ${branchShort}`,
    body:
      `${b.customer.name}${b.customer.nickname ? ` (${b.customer.nickname})` : ""} · ${b.customer.phone}\n` +
      `${dateStr} ${b.startTime}–${b.endTime} · ${b.service.nameTh} · ${b.staff?.name ?? "ไม่ระบุช่าง"}` +
      (isMember ? " · 🎟️สมาชิก" : ""),
    href:     `/admin/m/${b.id}`,
    branchId: b.branchId,
  } as const;

  // Also DM the owners on LINE — kept as a reliable channel alongside in-app.
  const lineText =
`จองใหม่ - ${branchShort}

👤 ${b.customer.name}${b.customer.nickname ? ` (${b.customer.nickname})` : ""} · ${b.customer.phone}
📅 ${dateStr}
⏰ ${b.startTime}–${b.endTime}
💆 ${b.service.nameTh}
👤 ${b.staff?.name ?? "ไม่ระบุช่าง"}${isMember ? "\n🎟️ สมาชิก ✅" : ""}`;
  // In-app/Web Push and LINE are independent I/O, so overlap their wait time.
  const [adminResult, lineResult] = await Promise.allSettled([
    notifyAdmins(adminNotice),
    multicastText(STAFF_LINE_IDS, lineText),
  ]);
  if (adminResult.status === "rejected") {
    console.error("[notify] staff alert (admin) failed", adminResult.reason);
  }
  if (lineResult.status === "rejected") {
    console.error("[notify] staff alert (LINE) failed", lineResult.reason);
  } else if (!lineResult.value.ok) {
    console.error("[notify] staff alert (LINE) failed", lineResult.value.error);
  }
}

// ── Booking time-change notification (customer) ───────────────────────────────

/**
 * Sent whenever an admin changes startTime / endTime on an existing booking.
 * No deduplication — the admin can reschedule multiple times and the customer
 * should receive a notification for each change.
 */
export async function sendBookingTimeChanged(
  bookingId: string,
  oldStart:  string,
  oldEnd:    string,
): Promise<void> {
  const b = await prisma.booking.findUnique({
    where:   { id: bookingId },
    include: { customer: { include: { membership: true } }, branch: true, service: true, staff: true },
  });
  if (!b || !b.customer.lineUserId) return;

  const dateStr = b.date.toLocaleDateString("th-TH", {
    weekday: "long", day: "numeric", month: "short", year: "numeric",
  });

  // Customer notification — rich Flex card with Map + Reschedule buttons
  const r = await pushLine(b.customer.lineUserId, [
    buildBookingFlex(b, "rescheduled", { oldStart, oldEnd }),
  ]);
  if (!r.ok) console.error("[notify] time changed (customer) failed", bookingId, r.error);
  else        console.log("[notify] time changed (customer) sent",    bookingId);

  // Staff / admin notification
  const branchShort  = b.branch.name.replace(/^err\.day\s*/i, "");
  const mc          = b.customer.membership;
  const nowR        = new Date();
  const isMemberR   = mc != null
    && !mc.pendingActivation
    && (mc.expiresAt == null || mc.expiresAt > nowR)
    && (mc.usagesAllowed === 0 || mc.usagesUsed < mc.usagesAllowed);
  const memberLineR = isMemberR
    ? `🎟️ สมาชิก: ✅ ใช้งานได้ (หมดอายุ ${mc!.expiresAt ? formatDateTh(mc!.expiresAt) : "ตลอดชีพ"})`
    : `🎟️ สมาชิก: ❌ ไม่ใช่สมาชิก`;

  const staffText =
`เปลี่ยนเวลานัด - ${branchShort}

👤 ${b.customer.name}${b.customer.nickname ? ` (${b.customer.nickname})` : ""} · ${b.customer.phone}
📅 ${dateStr}
⏰ ${oldStart}–${oldEnd} → ${b.startTime}–${b.endTime}
💆 ${b.service.nameTh}
👤 ${b.staff?.name ?? "ไม่ระบุช่าง"}
${memberLineR}`;

  const staffResult = await multicastText(STAFF_LINE_IDS, staffText);
  if (!staffResult.ok) console.error("[notify] time changed (staff) failed", staffResult.error);
  else                 console.log("[notify] time changed (staff) sent");
}

// ── Booking cancellation (customer + staff) ──────────────────────────────────

/**
 * Sent when a booking is cancelled — by the shop (admin) or by the customer
 * themselves. Notifies the customer (if LINE-linked) and always alerts staff
 * (STAFF_LINE_IDS). Fire-and-forget, no dedup: a booking is normally cancelled
 * once, and the callers already guard against re-firing on an already-cancelled
 * booking.
 */
export async function sendBookingCancelled(
  bookingId: string,
  opts?: { byCustomer?: boolean },
): Promise<void> {
  const b = await prisma.booking.findUnique({
    where:   { id: bookingId },
    include: { customer: true, branch: true, service: true, staff: true },
  });
  if (!b) return;

  const dateStr = b.date.toLocaleDateString("th-TH", {
    weekday: "long", day: "numeric", month: "short", year: "numeric",
  });

  // Customer notification (skipped silently if no LINE link)
  const customerLineUserId = b.customer.lineUserId;
  const customerTask = customerLineUserId ? (async () => {
    const text =
`❌ err·day — ยกเลิกการจองแล้วค่ะ

สวัสดีค่ะ คุณ${b.customer.nickname || b.customer.name}
การจองของคุณถูกยกเลิกเรียบร้อยแล้วนะคะ

📅 ${dateStr}
⏰ ${b.startTime} – ${b.endTime}
💆 ${b.service.nameTh}
📍 ${b.branch.name}

หากต้องการจองใหม่ ทักเราได้เลยนะคะ 🌸`;
    const r = await pushText(customerLineUserId, text);
    if (!r.ok) console.error("[notify] booking cancelled (customer) failed", bookingId, r.error);
    else        console.log("[notify] booking cancelled (customer) sent",    bookingId);
  })() : Promise.resolve();

  // Owner alert → in-app notification + Web Push.
  const branchShort = b.branch.name.replace(/^err\.day\s*/i, "");
  const who = opts?.byCustomer ? "ลูกค้ายกเลิกเอง" : "ยกเลิกโดยร้าน";
  const adminTask = notifyAdmins({
    type:  "BOOKING_CANCELLED",
    title: `ยกเลิกการจอง · ${branchShort}`,
    body:
      `(${who}) ${b.customer.name}${b.customer.nickname ? ` (${b.customer.nickname})` : ""} · ${b.customer.phone}\n` +
      `${dateStr} ${b.startTime}–${b.endTime} · ${b.service.nameTh} · ${b.staff?.name ?? "ไม่ระบุช่าง"}`,
    href:     `/admin/m/${b.id}`,
    branchId: b.branchId,
  });

  // Also DM the owners on LINE — kept as a reliable channel alongside in-app.
  const staffText =
`❌ ยกเลิกการจอง - ${branchShort}
(${who})

👤 ${b.customer.name}${b.customer.nickname ? ` (${b.customer.nickname})` : ""} · ${b.customer.phone}
📅 ${dateStr}
⏰ ${b.startTime}–${b.endTime}
💆 ${b.service.nameTh}
👤 ${b.staff?.name ?? "ไม่ระบุช่าง"}`;
  const staffTask = multicastText(STAFF_LINE_IDS, staffText).then((result) => {
    if (!result.ok) console.error("[notify] booking cancelled (LINE) failed", result.error);
  });

  // All channels are independent. Reuse the booking snapshot for the group
  // eligibility check instead of querying the booking a second time.
  const results = await Promise.allSettled([
    customerTask,
    adminTask,
    staffTask,
    sendGroupBookingNoticeLoaded(b, "cancelled"),
  ]);
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      const channel = ["customer", "admin", "staff", "group"][index];
      console.error(`[notify] booking cancelled ${channel} failed`, result.reason);
    }
  });
}

// ── Branch LINE-group notifications (per-branch staff group chat) ────────────

type GroupBooking = {
  startTime: string;
  totalPrice: number;
  notes: string | null;
  date: Date;
  serviceId: string;
  addons: { price: number }[];
  customer: {
    name: string;
    nickname: string | null;
    packages: {
      packageSku:        string;
      usageLimit:        number;
      usagesUsed:        number;
      pendingActivation: boolean;
    }[];
  };
};

/**
 * Prisma select shared by both group-list queries — everything
 * `fmtGroupBookingLine` needs, including the package data used to show a
 * covered visit as ฿0.
 *
 * Built per call, not hoisted to a const: the package `expiresAt` filter is
 * relative to today, and a module-level constant would freeze it at whenever
 * the server process started.
 */
const groupBookingSelect = () => ({
  startTime:  true,
  totalPrice: true,
  notes:      true,
  date:       true,
  serviceId:  true,
  addons:     { select: { price: true } },
  customer:   {
    select: {
      name:     true,
      nickname: true,
      packages: {
        where:  { closedAt: null, pendingActivation: false, expiresAt: { gte: startOfTodayUTC() } },
        select: {
          packageSku:        true,
          usageLimit:        true,
          usagesUsed:        true,
          pendingActivation: true,
        },
      },
    },
  },
});

/** "วันที่ : พฤหัสบดี 7/6/2569" — date is stored as UTC-noon of the Bangkok day. */
function fmtGroupDate(date: Date): string {
  const weekday = date.toLocaleDateString("th-TH", { weekday: "long", timeZone: "UTC" });
  const d = date.getUTCDate();
  const m = date.getUTCMonth() + 1;
  const y = date.getUTCFullYear() + 543;   // Buddhist era
  return `วันที่ : ${weekday} ${d}/${m}/${y}`;
}

/**
 * "14:00 : ชื่อลูกค้า - ฿500 - โน้ต" (note appended only when present).
 *
 * A service covered by an active package (5-pack / buffet) with uses left is
 * redeemed for free at checkout, so the service portion shows as ฿0 and only
 * the add-ons remain — otherwise the group sees the sticker price for a visit
 * nobody is going to pay for. Mirrors the admin home list (admin/m/page.tsx)
 * and the POS redemption in packages.ts. Group lists only ever contain
 * PENDING/CONFIRMED bookings, so there is no completed-booking case to guard.
 */
function fmtGroupBookingLine(b: GroupBooking): string {
  const name = b.customer.nickname || b.customer.name;

  const coveredByPackage = b.customer.packages.some(p =>
    !p.pendingActivation
    && (PACKAGE_SPECS[p.packageSku]?.coversServiceIds.includes(b.serviceId) ?? false)
    && (p.usageLimit === 0 || p.usageLimit - p.usagesUsed > 0)
  );
  const addonsTotal = b.addons.reduce((s, a) => s + a.price, 0);
  const satang      = coveredByPackage ? addonsTotal : b.totalPrice;

  const price = `฿${(satang / 100).toLocaleString()}`;
  const note  = b.notes?.trim();
  return `${b.startTime} : ${name} - ${price}${note ? ` - ${note}` : ""}`;
}

/**
 * On a booking create/cancel, re-post the branch group's TODAY upcoming list
 * (the live same-day schedule). A new booking appears, a cancelled one drops off
 * (the cancel caller runs after status=CANCELLED, so the active query excludes it).
 *
 * Only fires for TODAY's bookings — create/cancel for any other day posts nothing
 * here (future bookings appear only in the 22:00 summary). No-op if the branch
 * has no group configured.
 */
export async function sendGroupBookingNotice(
  bookingId: string,
  action: "created" | "cancelled" | "changed",
): Promise<void> {
  const b = await prisma.booking.findUnique({
    where:  { id: bookingId },
    select: { branchId: true, date: true, startTime: true },
  });
  if (!b) return;
  await sendGroupBookingNoticeLoaded(b, action);
}

async function sendGroupBookingNoticeLoaded(
  b: Pick<BookingNotification, "branchId" | "date" | "startTime">,
  action: "created" | "cancelled" | "changed",
): Promise<void> {
  const groupId = branchGroupId(b.branchId);
  if (!groupId) return;

  const pad2 = (n: number) => String(n).padStart(2, "0");
  const Y = b.date.getUTCFullYear(), M = b.date.getUTCMonth(), D = b.date.getUTCDate();
  const bkkNow   = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const todayStr = `${bkkNow.getUTCFullYear()}-${pad2(bkkNow.getUTCMonth() + 1)}-${pad2(bkkNow.getUTCDate())}`;
  const dayStr   = `${Y}-${pad2(M + 1)}-${pad2(D)}`;

  // Only the same-day schedule is posted live; other days are silent here.
  if (dayStr !== todayStr) return;

  const dayStart = new Date(Date.UTC(Y, M, D, 0, 0, 0));
  const dayEnd   = new Date(Date.UTC(Y, M, D, 23, 59, 59));
  const nowHHmm  = `${pad2(bkkNow.getUTCHours())}:${pad2(bkkNow.getUTCMinutes())}`;

  // This booking's own slot is already in the past → nothing actionable for the
  // group (e.g. a back-filled walk-in, or a cancel/time-change on a slot that has
  // already happened). Skip the notification entirely.
  if (b.startTime < nowHHmm) return;

  const bookings = await prisma.booking.findMany({
    where:  { branchId: b.branchId, date: { gte: dayStart, lte: dayEnd }, status: { in: ["PENDING", "CONFIRMED"] }, serviceId: { notIn: SALE_ONLY_SKUS } },
    select: groupBookingSelect(),
    orderBy: { startTime: "asc" },
  });
  const list = bookings.filter(x => x.startTime >= nowHHmm);   // upcoming only

  const header = action === "created"   ? "🆕 จองใหม่"
               : action === "changed"   ? "🔄 เปลี่ยนเวลา"
               :                          "❌ ยกเลิกการจอง";
  const lines  = list.length ? list.map(fmtGroupBookingLine).join("\n") : "— ไม่มีคิวที่เหลือวันนี้ —";
  const text   = `${header}\n${fmtGroupDate(b.date)}\n\n${lines}`;

  const r = await pushLine(groupId, [{ type: "text", text }]);
  if (!r.ok) console.error("[notify] group booking list failed", b.branchId, r.error);
  else        console.log("[notify] group today-list sent", b.branchId, action, list.length);
}

interface SummaryResult { branchId: string; status: "SENT" | "FAILED" | "SKIPPED"; count?: number; reason?: string; }

/**
 * Post a branch's booking list for today or tomorrow to its LINE group — the
 * manual "push booking schedule to the group" button (and the 22:00 cron's
 * tomorrow summary, via sendBranchDailySummary). `day` resolves against the
 * Bangkok calendar day; the whole day's PENDING/CONFIRMED bookings are listed.
 */
export async function sendBranchBookingSchedule(
  branchId: string,
  day: "today" | "tomorrow",
): Promise<SummaryResult> {
  const groupId = branchGroupId(branchId);
  if (!groupId) return { branchId, status: "SKIPPED", reason: "no_group" };

  // Bookings store `date` as UTC-noon of the Bangkok calendar day. Compute the
  // target Bangkok day and match the whole UTC day around its noon.
  const bkk    = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const offset = day === "tomorrow" ? 1 : 0;
  const y = bkk.getUTCFullYear(), mo = bkk.getUTCMonth(), d = bkk.getUTCDate() + offset;
  const dayStart = new Date(Date.UTC(y, mo, d, 0, 0, 0));
  const dayEnd   = new Date(Date.UTC(y, mo, d, 23, 59, 59));
  const dayNoon  = new Date(Date.UTC(y, mo, d, 12, 0, 0));

  const bookings = await prisma.booking.findMany({
    where:  { branchId, date: { gte: dayStart, lte: dayEnd }, status: { in: ["PENDING", "CONFIRMED"] }, serviceId: { notIn: SALE_ONLY_SKUS } },
    select: groupBookingSelect(),
    orderBy: { startTime: "asc" },
  });

  const label = day === "tomorrow" ? "พรุ่งนี้" : "วันนี้";
  const lines = bookings.length
    ? bookings.map(fmtGroupBookingLine).join("\n")
    : `— ยังไม่มีการจองสำหรับ${label} —`;
  const text = `📋 สรุปการจอง${label}\n${fmtGroupDate(dayNoon)}\n\n${lines}`;

  const r = await pushLine(groupId, [{ type: "text", text }]);
  return { branchId, status: r.ok ? "SENT" : "FAILED", count: bookings.length, reason: r.error };
}

/**
 * Post tomorrow's booking list to a branch's LINE group (the 22:00 daily summary).
 */
export async function sendBranchDailySummary(branchId: string): Promise<SummaryResult> {
  return sendBranchBookingSchedule(branchId, "tomorrow");
}

/**
 * Post ONE branch's staff working schedule (shifts) for today or tomorrow to
 * that branch's LINE group — the manual "push schedule to the group" button.
 * `day` is resolved against the Bangkok calendar day.
 */
export async function sendBranchShiftSchedule(
  branchId: string,
  day: "today" | "tomorrow",
): Promise<SummaryResult> {
  const groupId = branchGroupId(branchId);
  if (!groupId) return { branchId, status: "SKIPPED", reason: "no_group" };

  const bkk    = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const offset = day === "tomorrow" ? 1 : 0;
  const y = bkk.getUTCFullYear(), mo = bkk.getUTCMonth(), d = bkk.getUTCDate() + offset;
  const dayStart = new Date(Date.UTC(y, mo, d, 0, 0, 0));
  const dayEnd   = new Date(Date.UTC(y, mo, d, 23, 59, 59));
  const dayNoon  = new Date(Date.UTC(y, mo, d, 12, 0, 0));

  const shifts = await prisma.staffShift.findMany({
    // Only active staff at this branch (removed staff soft-delete leaves shift rows).
    where:  { date: { gte: dayStart, lte: dayEnd }, staff: { isActive: true, branchId } },
    select: { startTime: true, endTime: true, staff: { select: { name: true } } },
    orderBy: [{ startTime: "asc" }],
  });

  const lines = shifts.length
    ? shifts.map(s => `${s.startTime}–${s.endTime} : ${s.staff.name}`).join("\n")
    : "— ยังไม่มีตารางงาน —";
  const label = day === "tomorrow" ? "พรุ่งนี้" : "วันนี้";
  const text  = `👥 ตารางงาน${label}\n${fmtGroupDate(dayNoon)}\n\n${lines}`;

  const r = await pushLine(groupId, [{ type: "text", text }]);
  return { branchId, status: r.ok ? "SENT" : "FAILED", count: shifts.length, reason: r.error };
}

/**
 * DM the owners (STAFF_LINE_IDS = Looklipair + Chatcharit) tomorrow's staff
 * shift schedule, grouped by branch. Fired from the 22:00 cron.
 */
export async function sendStaffShiftSummary(): Promise<{ status: string; count: number }> {
  const bkk = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const y = bkk.getUTCFullYear(), mo = bkk.getUTCMonth(), d = bkk.getUTCDate() + 1;
  const dayStart     = new Date(Date.UTC(y, mo, d, 0, 0, 0));
  const dayEnd       = new Date(Date.UTC(y, mo, d, 23, 59, 59));
  const tomorrowNoon = new Date(Date.UTC(y, mo, d, 12, 0, 0));

  const shifts = await prisma.staffShift.findMany({
    // Only active staff. Removing staff is a soft delete (isActive=false) and
    // does not clear their future shift rows, so without this filter a removed
    // staff member still appears in tomorrow's schedule.
    where:  { date: { gte: dayStart, lte: dayEnd }, staff: { isActive: true } },
    select: { startTime: true, endTime: true, staff: { select: { name: true, branch: { select: { name: true } } } } },
    orderBy: [{ startTime: "asc" }],
  });

  // Group lines by branch name
  const byBranch = new Map<string, string[]>();
  for (const s of shifts) {
    const bn   = s.staff.branch?.name ?? "ไม่ระบุสาขา";
    const line = `${s.startTime}–${s.endTime} : ${s.staff.name}`;
    const arr  = byBranch.get(bn);
    if (arr) arr.push(line); else byBranch.set(bn, [line]);
  }

  const body = shifts.length === 0
    ? "— ยังไม่มีตารางงานสำหรับวันพรุ่งนี้ —"
    : [...byBranch.entries()].map(([bn, lines]) => `📍 ${bn}\n${lines.join("\n")}`).join("\n\n");

  await notifyAdmins({
    type:  "SUMMARY",
    title: "👥 ตารางงานพรุ่งนี้",
    body:  `${fmtGroupDate(tomorrowNoon)}\n\n${body}`,
    href:  "/admin/m/shifts",
  });
  return { status: "SENT", count: shifts.length };
}

// ── Booking confirmation (sent immediately on creation) ────────────────────

export async function sendBookingCreated(bookingId: string): Promise<SendResult> {
  const kind: Kind = "BOOKING_CREATED";
  const [sent, b] = await Promise.all([
    alreadySent(kind, bookingId),
    loadBookingNotification(bookingId),
  ]);
  if (sent) return { kind, targetId: bookingId, status: "SENT", reason: "already" };
  if (!b) return { kind, targetId: bookingId, status: "FAILED", reason: "not_found" };
  return sendBookingCreatedLoaded(b);
}

async function sendBookingCreatedLoaded(b: BookingNotification): Promise<SendResult> {
  const kind: Kind = "BOOKING_CREATED";
  const bookingId = b.id;

  if (!b.customer.lineUserId) {
    await recordLog({ kind, targetId: bookingId, status: "SKIPPED", error: "no_line_link" });
    return { kind, targetId: bookingId, status: "SKIPPED", reason: "no_line_link" };
  }

  const r = await pushLine(b.customer.lineUserId, [buildBookingFlex(b, "created")]);
  if (r.ok) {
    await recordLog({ kind, targetId: bookingId, status: "SENT", recipient: b.customer.lineUserId });
    return { kind, targetId: bookingId, status: "SENT" };
  }
  await recordLog({ kind, targetId: bookingId, status: "FAILED", recipient: b.customer.lineUserId, error: r.error });
  return { kind, targetId: bookingId, status: "FAILED", reason: r.error };
}

/**
 * New-booking coordinator: one booking read feeds every notification channel.
 * Channels run concurrently because they are independent external I/O.
 */
export async function sendNewBookingNotifications(bookingId: string): Promise<void> {
  const kind: Kind = "BOOKING_CREATED";
  const [sent, b] = await Promise.all([
    alreadySent(kind, bookingId),
    loadBookingNotification(bookingId),
  ]);
  if (!b) return;

  const customerTask = sent
    ? Promise.resolve<SendResult>({ kind, targetId: bookingId, status: "SENT", reason: "already" })
    : sendBookingCreatedLoaded(b);

  const results = await Promise.allSettled([
    customerTask,
    sendStaffBookingAlertLoaded(b),
    sendGroupBookingNoticeLoaded(b, "created"),
  ]);
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      const channel = ["customer", "staff", "group"][index];
      console.error(`[notify] new booking ${channel} failed`, result.reason);
    }
  });
}

// ── Booking confirmed by admin ─────────────────────────────────────────────

export async function sendBookingConfirmed(bookingId: string): Promise<SendResult> {
  const kind: Kind = "BOOKING_CONFIRMED";
  if (await alreadySent(kind, bookingId)) return { kind, targetId: bookingId, status: "SENT", reason: "already" };

  const b = await prisma.booking.findUnique({
    where:   { id: bookingId },
    include: { customer: true, branch: true, service: true, staff: true },
  });
  if (!b) return { kind, targetId: bookingId, status: "FAILED", reason: "not_found" };

  if (!b.customer.lineUserId) {
    await recordLog({ kind, targetId: bookingId, status: "SKIPPED", error: "no_line_link" });
    return { kind, targetId: bookingId, status: "SKIPPED", reason: "no_line_link" };
  }

  const r = await pushLine(b.customer.lineUserId, [buildBookingFlex(b, "confirmed")]);
  if (r.ok) {
    await recordLog({ kind, targetId: bookingId, status: "SENT", recipient: b.customer.lineUserId });
    return { kind, targetId: bookingId, status: "SENT" };
  }
  await recordLog({ kind, targetId: bookingId, status: "FAILED", recipient: b.customer.lineUserId, error: r.error });
  return { kind, targetId: bookingId, status: "FAILED", reason: r.error };
}

// ── Booking 4-hour reminder ──────────────────────────────────────────────────

export async function sendBookingReminder4h(bookingId: string): Promise<SendResult> {
  const kind: Kind = "BOOKING_REMINDER_4H";
  if (await alreadySent(kind, bookingId)) return { kind, targetId: bookingId, status: "SENT", reason: "already" };

  const b = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { customer: true, branch: true, service: true, staff: true },
  });
  if (!b) return { kind, targetId: bookingId, status: "FAILED", reason: "not_found" };

  if (!b.customer.lineUserId) {
    await recordLog({ kind, targetId: bookingId, status: "SKIPPED", error: "no_line_link" });
    return { kind, targetId: bookingId, status: "SKIPPED", reason: "no_line_link" };
  }
  if (b.status === "CANCELLED" || b.status === "COMPLETED" || b.status === "NO_SHOW") {
    await recordLog({ kind, targetId: bookingId, status: "SKIPPED", error: `status_${b.status}` });
    return { kind, targetId: bookingId, status: "SKIPPED", reason: "non_active_status" };
  }

  const r = await pushLine(b.customer.lineUserId, [buildBookingFlex(b, "reminder")]);
  if (r.ok) {
    await recordLog({ kind, targetId: bookingId, status: "SENT", recipient: b.customer.lineUserId });
    return { kind, targetId: bookingId, status: "SENT" };
  }
  await recordLog({ kind, targetId: bookingId, status: "FAILED", recipient: b.customer.lineUserId, error: r.error });
  return { kind, targetId: bookingId, status: "FAILED", reason: r.error };
}

// ── Staff alert when a customer activates / renews membership ────────────────

export async function sendStaffMembershipAlert(membershipId: string): Promise<void> {
  const m = await prisma.membership.findUnique({
    where:   { id: membershipId },
    include: { customer: true, tier: true },
  });
  if (!m) return;

  const customerLabel = [m.customer.name, m.customer.nickname && `(${m.customer.nickname})`]
    .filter(Boolean).join(" ");

  const now       = new Date();
  const expired   = m.expiresAt != null && m.expiresAt < now;
  const usedUp    = m.usagesAllowed > 0 && m.usagesUsed >= m.usagesAllowed;
  const statusStr = m.pendingActivation ? "⏳ รอเปิดใช้งาน"
                  : (expired || usedUp)  ? "❌ หมดอายุ / ใช้ครบ"
                  :                        "✅ ใช้งานได้";

  const expiryStr     = m.expiresAt ? formatDateTh(m.expiresAt) : "ไม่มีวันหมดอายุ";
  const activatedStr  = formatDateTh(m.activatedAt);
  const usageStr      = m.usagesAllowed > 0
    ? `ใช้แล้ว ${m.usagesUsed}/${m.usagesAllowed} ครั้ง`
    : "ไม่จำกัดครั้ง";

  const text =
`🎟️ สมาชิกใหม่ / ต่ออายุ

👤 ${customerLabel}
📞 ${m.customer.phone}
✨ ${m.label ?? m.tier?.nameTh ?? "สมาชิกรายเดือน"}
📊 สถานะ: ${statusStr}
📅 เริ่มต้น: ${activatedStr}
📅 หมดอายุ: ${expiryStr}
🔢 ${usageStr}`;

  const lineResult = await multicastText(STAFF_LINE_IDS, text);
  if (!lineResult.ok) console.error("[notify] staff membership alert failed", lineResult.error);
}

// ── Membership activated ─────────────────────────────────────────────────────

export async function sendMembershipActivated(
  membershipId: string,
  opts: { cycleId?: string; renewed?: boolean } = {},
): Promise<SendResult> {
  const kind: Kind = "MEMBERSHIP_ACTIVATED";
  // Dedupe per cycle so each renewal sends its own confirmation flex. Falls back
  // to the membership id when no cycle is supplied (legacy callers).
  const targetId = opts.cycleId ?? membershipId;
  if (await alreadySent(kind, targetId)) return { kind, targetId, status: "SENT", reason: "already" };

  const m = await prisma.membership.findUnique({
    where:   { id: membershipId },
    include: { customer: true, tier: true },
  });
  if (!m) return { kind, targetId, status: "FAILED", reason: "not_found" };
  if (!m.customer.lineUserId) {
    await recordLog({ kind, targetId, status: "SKIPPED", error: "no_line_link" });
    return { kind, targetId, status: "SKIPPED", reason: "no_line_link" };
  }

  const flex = buildEntitlementActivatedFlex({
    greetName:   m.customer.nickname || m.customer.name,
    productName: m.label || m.tier?.nameTh || "สมาชิกรายเดือน",
    startedAt:   m.activatedAt,
    expiresAt:   m.expiresAt,
    usageText:   m.usagesAllowed > 0
      ? `${m.usagesAllowed} ครั้ง`
      : "ราคาสมาชิกทุกบริการ (ไม่จำกัดครั้ง)",
    heroUrl:     promoHeroUrl("membership"),
    renewed:     opts.renewed,
  });

  const r = await pushLine(m.customer.lineUserId, [flex]);
  if (r.ok) {
    await recordLog({ kind, targetId, status: "SENT", recipient: m.customer.lineUserId });
    return { kind, targetId, status: "SENT" };
  }
  await recordLog({ kind, targetId, status: "FAILED", recipient: m.customer.lineUserId, error: r.error });
  return { kind, targetId, status: "FAILED", reason: r.error };
}

/**
 * Push the customer's current membership card to their LINE. Used right after an
 * account-link so a member who was registered offline (no LINE) gets their
 * details. Direct push — no activation dedupe — since it's triggered by an
 * explicit one-off action. No-op if they have no active membership or no LINE.
 */
export async function sendMembershipDetails(customerId: string): Promise<SendResult> {
  const kind: Kind = "MEMBERSHIP_ACTIVATED";
  const m = await prisma.membership.findUnique({
    where:   { customerId },
    include: { customer: true, tier: true },
  });
  if (!m)                                 return { kind, targetId: customerId, status: "SKIPPED", reason: "no_membership" };
  if (m.pendingActivation)                return { kind, targetId: customerId, status: "SKIPPED", reason: "pending" };
  if (!m.customer.lineUserId)             return { kind, targetId: customerId, status: "SKIPPED", reason: "no_line_link" };

  const flex = buildEntitlementActivatedFlex({
    greetName:   m.customer.nickname || m.customer.name,
    productName: m.label || m.tier?.nameTh || "สมาชิกรายเดือน",
    startedAt:   m.activatedAt,
    expiresAt:   m.expiresAt,
    usageText:   m.usagesAllowed > 0
      ? `${m.usagesAllowed} ครั้ง`
      : "ราคาสมาชิกทุกบริการ (ไม่จำกัดครั้ง)",
    heroUrl:     promoHeroUrl("membership"),
  });

  const r = await pushLine(m.customer.lineUserId, [flex]);
  return { kind, targetId: customerId, status: r.ok ? "SENT" : "FAILED", reason: r.error };
}

// ── Membership expiry warning (1 day) ────────────────────────────────────────

export async function sendMembershipExpiryWarning1d(membershipId: string): Promise<SendResult> {
  const kind: Kind = "MEMBERSHIP_EXPIRY_1D";
  if (await alreadySent(kind, membershipId)) return { kind, targetId: membershipId, status: "SENT", reason: "already" };

  const m = await prisma.membership.findUnique({
    where:   { id: membershipId },
    include: { customer: true, tier: true },
  });
  if (!m || !m.expiresAt) return { kind, targetId: membershipId, status: "FAILED", reason: "no_expiry" };
  if (!m.customer.lineUserId) {
    await recordLog({ kind, targetId: membershipId, status: "SKIPPED", error: "no_line_link" });
    return { kind, targetId: membershipId, status: "SKIPPED", reason: "no_line_link" };
  }

  const text =
`⏰ แจ้งเตือนสมาชิกใกล้หมดอายุค่ะ

คุณ${m.customer.nickname || m.customer.name} สมาชิก${m.tier?.nameTh ?? "รายเดือน"} ของคุณจะหมดอายุในอีก 1 วันนะคะ

📅 หมดอายุ: ${formatDateTh(m.expiresAt)}
🔄 ต่ออายุได้ที่หน้าร้านทุกสาขา

ขอบคุณที่ใช้บริการกับเรานะคะ 🌸`;

  const r = await pushText(m.customer.lineUserId, text);
  if (r.ok) {
    await recordLog({ kind, targetId: membershipId, status: "SENT", recipient: m.customer.lineUserId });
    return { kind, targetId: membershipId, status: "SENT" };
  }
  await recordLog({ kind, targetId: membershipId, status: "FAILED", recipient: m.customer.lineUserId, error: r.error });
  return { kind, targetId: membershipId, status: "FAILED", reason: r.error };
}

// ── Package activated ────────────────────────────────────────────────────────

const PACKAGE_NAME_TH: Record<string, string> = {
  "svc-buffet":   "Buffet 30 วัน",
  "svc-pkg5":     "แพ็กเกจ 5 ครั้ง",
};

export async function sendPackageActivated(packageId: string): Promise<SendResult> {
  const kind: Kind = "PACKAGE_ACTIVATED";
  if (await alreadySent(kind, packageId)) return { kind, targetId: packageId, status: "SENT", reason: "already" };

  const p = await prisma.customerPackage.findUnique({
    where:   { id: packageId },
    include: { customer: true },
  });
  if (!p) return { kind, targetId: packageId, status: "FAILED", reason: "not_found" };
  if (!p.customer.lineUserId) {
    await recordLog({ kind, targetId: packageId, status: "SKIPPED", error: "no_line_link" });
    return { kind, targetId: packageId, status: "SKIPPED", reason: "no_line_link" };
  }

  const productName = PACKAGE_NAME_TH[p.packageSku] ?? p.packageSku;

  const flex = buildEntitlementActivatedFlex({
    greetName:   p.customer.nickname || p.customer.name,
    productName,
    startedAt:   p.startedAt,
    expiresAt:   p.expiresAt,
    usageText:   p.usageLimit > 0 ? `${p.usageLimit} ครั้ง` : "ไม่จำกัดจำนวนครั้ง",
    heroUrl:     promoHeroUrl(p.packageSku),
  });

  const r = await pushLine(p.customer.lineUserId, [flex]);
  if (r.ok) {
    await recordLog({ kind, targetId: packageId, status: "SENT", recipient: p.customer.lineUserId });
    return { kind, targetId: packageId, status: "SENT" };
  }
  await recordLog({ kind, targetId: packageId, status: "FAILED", recipient: p.customer.lineUserId, error: r.error });
  return { kind, targetId: packageId, status: "FAILED", reason: r.error };
}

// ── Entitlement "application received" (sent on LIFF self-signup, pre-payment) ──

/**
 * Fire-and-forget "we received your application, please pay at the counter"
 * push. No NotificationLog/dedup — the signup route only calls this when a
 * pending entitlement is newly created, so it won't double-send on its own.
 */
export async function sendEntitlementReceived(args: {
  lineUserId:  string;
  greetName:   string;
  productName: string;
  priceTh:     string;
  heroUrl?:    string;
}): Promise<void> {
  const flex = buildEntitlementReceivedFlex({
    greetName:   args.greetName,
    productName: args.productName,
    priceTh:     args.priceTh,
    heroUrl:     args.heroUrl,
  });
  const r = await pushLine(args.lineUserId, [flex]);
  if (!r.ok) console.error("[notify] entitlement received failed", r.error);
}

// ── Package expiry warning (1 day) ───────────────────────────────────────────

export async function sendPackageExpiryWarning1d(packageId: string): Promise<SendResult> {
  const kind: Kind = "PACKAGE_EXPIRY_1D";
  if (await alreadySent(kind, packageId)) return { kind, targetId: packageId, status: "SENT", reason: "already" };

  const p = await prisma.customerPackage.findUnique({
    where:   { id: packageId },
    include: { customer: true },
  });
  if (!p) return { kind, targetId: packageId, status: "FAILED", reason: "not_found" };
  if (!p.customer.lineUserId) {
    await recordLog({ kind, targetId: packageId, status: "SKIPPED", error: "no_line_link" });
    return { kind, targetId: packageId, status: "SKIPPED", reason: "no_line_link" };
  }

  const productName = PACKAGE_NAME_TH[p.packageSku] ?? p.packageSku;
  const usagesLeft  = p.usageLimit > 0 ? Math.max(0, p.usageLimit - p.usagesUsed) : null;
  const usagesNote  = usagesLeft !== null ? `🎟 เหลือใช้ได้ ${usagesLeft} ครั้ง\n` : "";

  const text =
`⏰ แจ้งเตือนแพ็กเกจใกล้หมดอายุค่ะ

คุณ${p.customer.nickname || p.customer.name} ${productName} ของคุณจะหมดอายุในอีก 1 วันนะคะ

📅 หมดอายุ: ${formatDateTh(p.expiresAt)}
${usagesNote}🔄 ต่ออายุได้ที่หน้าร้านทุกสาขา

ขอบคุณที่ใช้บริการกับเรานะคะ 🌸`;

  const r = await pushText(p.customer.lineUserId, text);
  if (r.ok) {
    await recordLog({ kind, targetId: packageId, status: "SENT", recipient: p.customer.lineUserId });
    return { kind, targetId: packageId, status: "SENT" };
  }
  await recordLog({ kind, targetId: packageId, status: "FAILED", recipient: p.customer.lineUserId, error: r.error });
  return { kind, targetId: packageId, status: "FAILED", reason: r.error };
}

// ── Owner daily payroll summary (commission + OT to pay today) ───────────────

/**
 * DM the owners (STAFF_LINE_IDS) today's per-staff cash-out: service commission
 * earned + OT, per branch. Owner-only; never posted to staff groups. Called from
 * the nightly cron (deduped there). Money is satang → display in baht.
 */
export async function sendOwnerPayrollSummary(): Promise<{ status: string; total: number }> {
  const { computeBranchDailyPayout, bangkokTodayStr } = await import("@/lib/payroll");
  const today = bangkokTodayStr();
  const baht = (s: number) => `฿${(s / 100).toLocaleString("th-TH", { maximumFractionDigits: 2 })}`;

  const branches = await prisma.branch.findMany({
    where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true },
  });

  const sections: string[] = [];
  let grand = 0;
  for (const b of branches) {
    const rows = (await computeBranchDailyPayout(b.id, today)).filter(r => r.totalSatang > 0);
    if (rows.length === 0) continue;
    const branchTotal = rows.reduce((s, r) => s + r.totalSatang, 0);
    grand += branchTotal;
    const lines = rows.map(r => {
      const parts = [`ค่ามือ ${baht(r.commissionSatang)}`];
      if (r.otSatang > 0) parts.push(`OT ${baht(r.otSatang)} (${r.otHours} ชม.)`);
      return `• ${r.name}: ${baht(r.totalSatang)}  (${parts.join(" + ")})`;
    });
    sections.push(`📍 ${b.name.replace(/^err\.day\s*/i, "")} — ${baht(branchTotal)}\n${lines.join("\n")}`);
  }

  const body = sections.length === 0 ? "— วันนี้ยังไม่มีค่ามือ/OT —" : sections.join("\n\n");

  await notifyAdmins({
    type:  "PAYROLL",
    title: `💰 ค่าตอบแทนวันนี้ · รวม ${baht(grand)}`,
    body:  `วันที่ ${today}\n\n${body}`,
    href:  "/admin/m/payroll",
  });
  return { status: "SENT", total: grand };
}
