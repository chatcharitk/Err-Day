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
import { pushText } from "@/lib/line-messaging";

type Kind =
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

  const text =
`🌸 err·day reminder

สวัสดีคุณ ${b.customer.nickname || b.customer.name}
นัดของคุณกำลังจะมาถึงในอีกประมาณ 4 ชั่วโมง

📅 ${formatDateTh(b.date)}
⏰ ${b.startTime} – ${b.endTime}
💆 ${b.service.nameTh}
👤 ช่าง: ${b.staff?.name ?? "ที่ว่างให้บริการ"}
📍 ${b.branch.name}

หากต้องการเปลี่ยนแปลงหรือยกเลิก กรุณาแจ้งล่วงหน้า ขอบคุณค่ะ 🙏`;

  const r = await pushText(b.customer.lineUserId, text);
  if (r.ok) {
    await recordLog({ kind, targetId: bookingId, status: "SENT", recipient: b.customer.lineUserId });
    return { kind, targetId: bookingId, status: "SENT" };
  }
  await recordLog({ kind, targetId: bookingId, status: "FAILED", recipient: b.customer.lineUserId, error: r.error });
  return { kind, targetId: bookingId, status: "FAILED", reason: r.error };
}

// ── Membership activated ─────────────────────────────────────────────────────

export async function sendMembershipActivated(membershipId: string): Promise<SendResult> {
  const kind: Kind = "MEMBERSHIP_ACTIVATED";
  if (await alreadySent(kind, membershipId)) return { kind, targetId: membershipId, status: "SENT", reason: "already" };

  const m = await prisma.membership.findUnique({
    where:   { id: membershipId },
    include: { customer: true, tier: true },
  });
  if (!m) return { kind, targetId: membershipId, status: "FAILED", reason: "not_found" };
  if (!m.customer.lineUserId) {
    await recordLog({ kind, targetId: membershipId, status: "SKIPPED", error: "no_line_link" });
    return { kind, targetId: membershipId, status: "SKIPPED", reason: "no_line_link" };
  }

  const text =
`🎉 ยินดีต้อนรับสู่ครอบครัว err·day!

คุณ${m.customer.nickname || m.customer.name} สมาชิก${m.tier?.nameTh ?? "รายเดือน"} ของคุณเริ่มต้นแล้ว

📅 ใช้ได้ถึง: ${m.expiresAt ? formatDateTh(m.expiresAt) : "ตลอดชีพ"}
✨ สิทธิ์: ราคาพิเศษทุกบริการ — สระไดร์เริ่ม ฿100

ทางทีมงานพร้อมต้อนรับคุณค่ะ 🌸`;

  const r = await pushText(m.customer.lineUserId, text);
  if (r.ok) {
    await recordLog({ kind, targetId: membershipId, status: "SENT", recipient: m.customer.lineUserId });
    return { kind, targetId: membershipId, status: "SENT" };
  }
  await recordLog({ kind, targetId: membershipId, status: "FAILED", recipient: m.customer.lineUserId, error: r.error });
  return { kind, targetId: membershipId, status: "FAILED", reason: r.error };
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
`⏰ แจ้งเตือนสมาชิกใกล้หมดอายุ

คุณ${m.customer.nickname || m.customer.name} สมาชิก${m.tier?.nameTh ?? "รายเดือน"} ของคุณจะหมดอายุในอีก 1 วัน

📅 หมดอายุ: ${formatDateTh(m.expiresAt)}
🔄 ต่ออายุได้ที่หน้าร้านทุกสาขา

ขอบคุณที่ใช้บริการกับเรา 🌸`;

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
  const usagesNote  = p.usageLimit > 0 ? `🎟 ใช้ได้ ${p.usageLimit} ครั้ง\n` : "🎟 ไม่จำกัดจำนวนครั้ง\n";

  const text =
`🎉 ยินดีต้อนรับสู่ครอบครัว err·day!

คุณ${p.customer.nickname || p.customer.name} ${productName} ของคุณเริ่มต้นแล้ว

📅 ใช้ได้ถึง: ${formatDateTh(p.expiresAt)}
${usagesNote}
ทางทีมงานพร้อมต้อนรับคุณค่ะ 🌸`;

  const r = await pushText(p.customer.lineUserId, text);
  if (r.ok) {
    await recordLog({ kind, targetId: packageId, status: "SENT", recipient: p.customer.lineUserId });
    return { kind, targetId: packageId, status: "SENT" };
  }
  await recordLog({ kind, targetId: packageId, status: "FAILED", recipient: p.customer.lineUserId, error: r.error });
  return { kind, targetId: packageId, status: "FAILED", reason: r.error };
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
`⏰ แจ้งเตือนแพ็กเกจใกล้หมดอายุ

คุณ${p.customer.nickname || p.customer.name} ${productName} ของคุณจะหมดอายุในอีก 1 วัน

📅 หมดอายุ: ${formatDateTh(p.expiresAt)}
${usagesNote}🔄 ต่ออายุได้ที่หน้าร้านทุกสาขา

ขอบคุณที่ใช้บริการกับเรา 🌸`;

  const r = await pushText(p.customer.lineUserId, text);
  if (r.ok) {
    await recordLog({ kind, targetId: packageId, status: "SENT", recipient: p.customer.lineUserId });
    return { kind, targetId: packageId, status: "SENT" };
  }
  await recordLog({ kind, targetId: packageId, status: "FAILED", recipient: p.customer.lineUserId, error: r.error });
  return { kind, targetId: packageId, status: "FAILED", reason: r.error };
}
