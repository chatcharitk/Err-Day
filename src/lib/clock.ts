/**
 * Staff clock-in / clock-out by QR ("ลงเวลา").
 *
 * The desk shows a QR that changes every minute: `ERRDAY-CLOCK:<branchId>.<window>.<sig>`,
 * window = minutes since epoch, sig = HMAC(branchId.window). The server accepts
 * the current and the previous window, so a photo / screenshot stops working
 * within ~2 minutes. Staff scan it with the in-app scanner (their own login), so
 * the scan says WHO; the QR says WHERE and WHEN.
 *
 * First scan of the day = IN (a ClockPunch). The next scan = OUT (asks to
 * confirm) and writes the StaffAttendance row payroll reads (clockIn = IN punch).
 * Later scans move clockOut to the newest scan.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { personForStaff } from "@/lib/staff-person";
import { bangkokDayNoon, bangkokTodayStr } from "@/lib/payroll";

export const CLOCK_QR_PREFIX = "ERRDAY-CLOCK:";
export const CLOCK_WINDOW_MS = 60_000;
/** A second scan this soon after clocking in is treated as a double scan, not a clock-out. */
const DOUBLE_SCAN_MS = 3 * 60_000;

function secret(): string {
  const s = process.env.STAFF_SESSION_SECRET ?? process.env.CRON_SECRET;
  if (!s) throw new Error("STAFF_SESSION_SECRET (or CRON_SECRET fallback) is not set");
  return s;
}
const sign = (branchId: string, w: number) =>
  createHmac("sha256", secret()).update(`clock.${branchId}.${w}`).digest("base64url").slice(0, 22);

/** QR text for this branch right now, and when it stops being the newest one. */
export function mintClockQr(branchId: string, now = Date.now()): { text: string; refreshAt: number } {
  const w = Math.floor(now / CLOCK_WINDOW_MS);
  return { text: `${CLOCK_QR_PREFIX}${branchId}.${w}.${sign(branchId, w)}`, refreshAt: (w + 1) * CLOCK_WINDOW_MS };
}

/** Branch id from a scanned QR, or null if forged / older than the previous window. */
export function verifyClockQr(text: string, now = Date.now()): string | null {
  if (typeof text !== "string" || !text.startsWith(CLOCK_QR_PREFIX)) return null;
  const parts = text.slice(CLOCK_QR_PREFIX.length).split(".");
  if (parts.length !== 3) return null;
  const [branchId, wStr, sig] = parts;
  const w = Number(wStr);
  const cur = Math.floor(now / CLOCK_WINDOW_MS);
  if (!Number.isInteger(w) || w > cur || w < cur - 1) return null;
  const a = Buffer.from(sig), b = Buffer.from(sign(branchId, w));
  return a.length === b.length && timingSafeEqual(a, b) ? branchId : null;
}

export type PunchResult =
  | { ok: true; kind: "IN" | "OUT"; at: string; staffName: string; branchName: string; clockIn?: string; again?: boolean }
  | { ok: false; reason: "bad_qr" | "not_branch" | "paid" | "confirm_out" | "double_scan"; message: string; clockIn?: string; clockOut?: string | null };

const hm = (d: Date) => d.toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" });

/** Handle one scan by the logged-in staff member `meStaffId`. */
export async function punch(meStaffId: string, qrText: string, confirm: boolean): Promise<PunchResult> {
  const branchId = verifyClockQr(qrText);
  if (!branchId) return { ok: false, reason: "bad_qr", message: "QR หมดอายุหรือไม่ถูกต้อง — สแกน QR ที่หน้าจอเคาน์เตอร์ตอนนี้" };

  // One person can have a Staff row per branch — stamp the row for the QR's branch.
  const person = await personForStaff(meStaffId);
  const staff = await prisma.staff.findFirst({
    where: { id: { in: person?.staffIds ?? [meStaffId] }, branchId, isActive: true },
    select: { id: true, name: true, branch: { select: { name: true } } },
  });
  if (!staff) return { ok: false, reason: "not_branch", message: "คุณไม่มีชื่ออยู่ในสาขานี้ — ติดต่อแอดมิน" };

  const day = bangkokTodayStr();
  const date = bangkokDayNoon(day);
  // Whole minutes — payroll's workMinutes() only accepts whole-minute spans (like admin entry).
  const now = new Date(Math.floor(Date.now() / 60_000) * 60_000);
  const [att, punches, payout] = await Promise.all([
    prisma.staffAttendance.findUnique({ where: { staffId_date: { staffId: staff.id, date } } }),
    prisma.clockPunch.findMany({ where: { staffId: staff.id, date }, orderBy: { at: "asc" } }),
    prisma.staffDailyPayout.findFirst({ where: { staffId: staff.id, branchId, date }, select: { status: true } }),
  ]);
  const base = { staffName: staff.name, branchName: staff.branch.name };
  const firstIn = punches.find(p => p.kind === "IN");

  // ── Clock in ────────────────────────────────────────────────────────────────
  if (!firstIn && !att) {
    await prisma.clockPunch.create({ data: { staffId: staff.id, branchId, date, kind: "IN", at: now } });
    return { ok: true, kind: "IN", at: now.toISOString(), ...base };
  }

  // ── Clock out (or move the out time) ────────────────────────────────────────
  const clockIn = att?.clockIn ?? firstIn!.at;
  if (now.getTime() - clockIn.getTime() < DOUBLE_SCAN_MS) {
    return { ok: false, reason: "double_scan", message: `ลงเวลาเข้าแล้วตอน ${hm(clockIn)}`, clockIn: clockIn.toISOString() };
  }
  if (payout?.status === "PAID") {
    return { ok: false, reason: "paid", message: "ค่าตอบแทนวันนี้จ่ายแล้ว — แก้เวลาได้ที่แอดมินเท่านั้น" };
  }
  if (!confirm) {
    return { ok: false, reason: "confirm_out", message: att ? "ลงเวลาออกใหม่เป็นตอนนี้?" : "ลงเวลาออกตอนนี้?",
      clockIn: clockIn.toISOString(), clockOut: att?.clockOut.toISOString() ?? null };
  }
  await prisma.$transaction([
    prisma.clockPunch.create({ data: { staffId: staff.id, branchId, date, kind: "OUT", at: now } }),
    att
      ? prisma.staffAttendance.update({ where: { id: att.id }, data: { clockOut: now } })
      : prisma.staffAttendance.create({
          data: { staffId: staff.id, date, clockIn, clockOut: now, breakMinutes: 0, confirmedBy: "QR", notes: "" },
        }),
  ]);
  return { ok: true, kind: "OUT", at: now.toISOString(), clockIn: clockIn.toISOString(), again: !!att, ...base };
}

/** Today's clock state for one logged-in staff member, across all their branch rows. */
export async function myClockToday(meStaffId: string) {
  const person = await personForStaff(meStaffId);
  const ids = person?.staffIds ?? [meStaffId];
  const date = bangkokDayNoon(bangkokTodayStr());
  const [att, punches] = await Promise.all([
    prisma.staffAttendance.findFirst({ where: { staffId: { in: ids }, date }, orderBy: { clockIn: "asc" } }),
    prisma.clockPunch.findMany({ where: { staffId: { in: ids }, date }, orderBy: { at: "asc" } }),
  ]);
  const firstIn = punches.find(p => p.kind === "IN");
  return {
    clockIn: (att?.clockIn ?? firstIn?.at)?.toISOString() ?? null,
    clockOut: att?.clockOut.toISOString() ?? null,
  };
}

/** Today's scans at a branch, newest first (for the desk's live list). */
export async function branchPunchesToday(branchId: string) {
  const date = bangkokDayNoon(bangkokTodayStr());
  const punches = await prisma.clockPunch.findMany({ where: { branchId, date }, orderBy: { at: "desc" }, take: 30 });
  const staff = await prisma.staff.findMany({
    where: { id: { in: [...new Set(punches.map(p => p.staffId))] } },
    select: { id: true, name: true, avatarUrl: true },
  });
  const byId = new Map(staff.map(s => [s.id, s]));
  return punches.map(p => ({
    id: p.id, kind: p.kind, at: p.at.toISOString(),
    name: byId.get(p.staffId)?.name ?? "?", avatarUrl: byId.get(p.staffId)?.avatarUrl ?? null,
  }));
}
