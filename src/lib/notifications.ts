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
import { pushText, pushLine } from "@/lib/line-messaging";
import { buildBookingFlex } from "@/lib/flex/booking";
import { buildEntitlementReceivedFlex, buildEntitlementActivatedFlex, promoHeroUrl } from "@/lib/flex/membership";
import { branchGroupId } from "@/lib/line-groups";

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
    await prisma.notificationLog.create({
      data: {
        kind:      args.kind,
        targetId:  args.targetId,
        status:    args.status,
        recipient: args.recipient ?? null,
        error:     args.error ?? null,
      },
    });
    return true;
  } catch (e) {
    // P2002 = unique constraint violation → already logged, no-op
    const code = (e as { code?: string }).code;
    if (code === "P2002") return false;
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

export async function sendStaffBookingAlert(bookingId: string): Promise<void> {
  const b = await prisma.booking.findUnique({
    where:   { id: bookingId },
    include: { customer: { include: { membership: true } }, branch: true, service: true, staff: true },
  });
  if (!b) return;

  // Strip "err.day " prefix from branch name for a cleaner alert header
  const branchShort = b.branch.name.replace(/^err\.day\s*/i, "");
  const dateStr = b.date.toLocaleDateString("th-TH", {
    weekday: "long", day: "numeric", month: "short", year: "numeric",
  });

  const m           = b.customer.membership;
  const now         = new Date();
  const isMember    = m != null
    && !m.pendingActivation
    && (m.expiresAt == null || m.expiresAt > now)
    && (m.usagesAllowed === 0 || m.usagesUsed < m.usagesAllowed);
  const memberLine  = isMember
    ? `🎟️ สมาชิก: ✅ ใช้งานได้ (หมดอายุ ${m!.expiresAt ? formatDateTh(m!.expiresAt) : "ตลอดชีพ"})`
    : `🎟️ สมาชิก: ❌ ไม่ใช่สมาชิก`;

  const text =
`จองใหม่ - ${branchShort}

👤 ${b.customer.name}${b.customer.nickname ? ` (${b.customer.nickname})` : ""} · ${b.customer.phone}
📅 ${dateStr}
⏰ ${b.startTime}–${b.endTime}
💆 ${b.service.nameTh}
👤 ${b.staff?.name ?? "ไม่ระบุช่าง"}
${memberLine}`;

  await Promise.all(
    STAFF_LINE_IDS.map(async uid => {
      const r = await pushText(uid, text);
      if (!r.ok) console.error("[notify] staff alert failed", uid, r.error);
      else console.log("[notify] staff alert sent", uid);
    })
  );
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

  await Promise.all(
    STAFF_LINE_IDS.map(async uid => {
      const rs = await pushText(uid, staffText);
      if (!rs.ok) console.error("[notify] time changed (staff) failed", uid, rs.error);
      else        console.log("[notify] time changed (staff) sent",    uid);
    })
  );
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
  if (b.customer.lineUserId) {
    const text =
`❌ err·day — ยกเลิกการจองแล้วค่ะ

สวัสดีค่ะ คุณ${b.customer.nickname || b.customer.name}
การจองของคุณถูกยกเลิกเรียบร้อยแล้วนะคะ

📅 ${dateStr}
⏰ ${b.startTime} – ${b.endTime}
💆 ${b.service.nameTh}
📍 ${b.branch.name}

หากต้องการจองใหม่ ทักเราได้เลยนะคะ 🌸`;
    const r = await pushText(b.customer.lineUserId, text);
    if (!r.ok) console.error("[notify] booking cancelled (customer) failed", bookingId, r.error);
    else        console.log("[notify] booking cancelled (customer) sent",    bookingId);
  }

  // Staff alert
  const branchShort = b.branch.name.replace(/^err\.day\s*/i, "");
  const who = opts?.byCustomer ? "ลูกค้ายกเลิกเอง" : "ยกเลิกโดยร้าน";
  const staffText =
`❌ ยกเลิกการจอง - ${branchShort}
(${who})

👤 ${b.customer.name}${b.customer.nickname ? ` (${b.customer.nickname})` : ""} · ${b.customer.phone}
📅 ${dateStr}
⏰ ${b.startTime}–${b.endTime}
💆 ${b.service.nameTh}
👤 ${b.staff?.name ?? "ไม่ระบุช่าง"}`;

  await Promise.all(
    STAFF_LINE_IDS.map(async uid => {
      const rs = await pushText(uid, staffText);
      if (!rs.ok) console.error("[notify] booking cancelled (staff) failed", uid, rs.error);
      else        console.log("[notify] booking cancelled (staff) sent",    uid);
    })
  );

  // Post to the branch's LINE group too (no-op if group not configured).
  await sendGroupBookingNotice(bookingId, "cancelled").catch(e => console.error("[notify] group cancel failed", e));
}

// ── Branch LINE-group notifications (per-branch staff group chat) ────────────

type GroupBooking = {
  startTime: string;
  totalPrice: number;
  notes: string | null;
  date: Date;
  customer: { name: string; nickname: string | null };
};

/** "วันที่ : พฤหัสบดี 7/6/2569" — date is stored as UTC-noon of the Bangkok day. */
function fmtGroupDate(date: Date): string {
  const weekday = date.toLocaleDateString("th-TH", { weekday: "long", timeZone: "UTC" });
  const d = date.getUTCDate();
  const m = date.getUTCMonth() + 1;
  const y = date.getUTCFullYear() + 543;   // Buddhist era
  return `วันที่ : ${weekday} ${d}/${m}/${y}`;
}

/** "14:00 : ชื่อลูกค้า - ฿500 - โน้ต" (note appended only when present). */
function fmtGroupBookingLine(b: GroupBooking): string {
  const name  = b.customer.nickname || b.customer.name;
  const price = `฿${(b.totalPrice / 100).toLocaleString()}`;
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
  action: "created" | "cancelled",
): Promise<void> {
  const b = await prisma.booking.findUnique({
    where:  { id: bookingId },
    select: { branchId: true, date: true },
  });
  if (!b) return;
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

  const bookings = await prisma.booking.findMany({
    where:  { branchId: b.branchId, date: { gte: dayStart, lte: dayEnd }, status: { in: ["PENDING", "CONFIRMED"] } },
    select: { startTime: true, totalPrice: true, notes: true, date: true, customer: { select: { name: true, nickname: true } } },
    orderBy: { startTime: "asc" },
  });
  const list = bookings.filter(x => x.startTime >= nowHHmm);   // upcoming only

  const header = action === "created" ? "🆕 จองใหม่" : "❌ ยกเลิกการจอง";
  const lines  = list.length ? list.map(fmtGroupBookingLine).join("\n") : "— ไม่มีคิวที่เหลือวันนี้ —";
  const text   = `${header}\n${fmtGroupDate(b.date)}\n\n${lines}`;

  const r = await pushLine(groupId, [{ type: "text", text }]);
  if (!r.ok) console.error("[notify] group booking list failed", b.branchId, r.error);
  else        console.log("[notify] group today-list sent", b.branchId, action, list.length);
}

interface SummaryResult { branchId: string; status: "SENT" | "FAILED" | "SKIPPED"; count?: number; reason?: string; }

/**
 * Post tomorrow's booking list to a branch's LINE group (the 22:00 daily summary).
 * Tomorrow = the Bangkok calendar day after "now".
 */
export async function sendBranchDailySummary(branchId: string): Promise<SummaryResult> {
  const groupId = branchGroupId(branchId);
  if (!groupId) return { branchId, status: "SKIPPED", reason: "no_group" };

  // Bookings store `date` as UTC-noon of the Bangkok calendar day. Compute the
  // Bangkok "tomorrow" and match the whole UTC day around its noon.
  const bkk = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const y = bkk.getUTCFullYear(), mo = bkk.getUTCMonth(), d = bkk.getUTCDate() + 1;
  const dayStart    = new Date(Date.UTC(y, mo, d, 0, 0, 0));
  const dayEnd      = new Date(Date.UTC(y, mo, d, 23, 59, 59));
  const tomorrowNoon = new Date(Date.UTC(y, mo, d, 12, 0, 0));

  const bookings = await prisma.booking.findMany({
    where:  { branchId, date: { gte: dayStart, lte: dayEnd }, status: { in: ["PENDING", "CONFIRMED"] } },
    select: { startTime: true, totalPrice: true, notes: true, date: true, customer: { select: { name: true, nickname: true } } },
    orderBy: { startTime: "asc" },
  });

  const lines = bookings.length
    ? bookings.map(fmtGroupBookingLine).join("\n")
    : "— ยังไม่มีการจองสำหรับวันพรุ่งนี้ —";
  const text = `📋 สรุปการจองพรุ่งนี้\n${fmtGroupDate(tomorrowNoon)}\n\n${lines}`;

  const r = await pushLine(groupId, [{ type: "text", text }]);
  return { branchId, status: r.ok ? "SENT" : "FAILED", count: bookings.length, reason: r.error };
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

  const text = `👥 ตารางงานพรุ่งนี้\n${fmtGroupDate(tomorrowNoon)}\n\n${body}`;

  await Promise.all(
    STAFF_LINE_IDS.map(async uid => {
      const r = await pushText(uid, text);
      if (!r.ok) console.error("[notify] shift summary failed", uid, r.error);
      else        console.log("[notify] shift summary sent", uid);
    })
  );
  return { status: "SENT", count: shifts.length };
}

// ── Booking confirmation (sent immediately on creation) ────────────────────

export async function sendBookingCreated(bookingId: string): Promise<SendResult> {
  const kind: Kind = "BOOKING_CREATED";
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

  const r = await pushLine(b.customer.lineUserId, [buildBookingFlex(b, "created")]);
  if (r.ok) {
    await recordLog({ kind, targetId: bookingId, status: "SENT", recipient: b.customer.lineUserId });
    return { kind, targetId: bookingId, status: "SENT" };
  }
  await recordLog({ kind, targetId: bookingId, status: "FAILED", recipient: b.customer.lineUserId, error: r.error });
  return { kind, targetId: bookingId, status: "FAILED", reason: r.error };
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

  await Promise.all(
    STAFF_LINE_IDS.map(async uid => {
      const r = await pushText(uid, text);
      if (!r.ok) console.error("[notify] staff membership alert failed", uid, r.error);
    })
  );
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
