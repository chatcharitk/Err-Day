/**
 * Shared data layer for the front-desk board (`/desk`) and the admin live
 * staff-load view (`/admin/live`).
 *
 * Time convention (see CLAUDE.md): a booking's `date` is stored at *noon* of the
 * Bangkok calendar day; the server runs in UTC, slot times are local "HH:mm".
 * We compute "today in Bangkok" by shifting now by +7h and reading UTC fields,
 * then query the `date` column with a UTC day-bounds range that always brackets
 * the noon-stored value regardless of the runtime timezone.
 */

import { prisma } from "@/lib/prisma";
import { SALE_ONLY_SKUS } from "@/lib/capacity";

const BKK_OFFSET_MS = 7 * 60 * 60 * 1000;

export function bangkokNow(): Date {
  return new Date(Date.now() + BKK_OFFSET_MS);
}

/** Bangkok calendar day as "YYYY-MM-DD". */
export function bangkokTodayYmd(): string {
  const d = bangkokNow();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** Current Bangkok local "HH:mm" (e.g. for walk-in start time). */
export function bangkokNowHm(): string {
  const d = bangkokNow();
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

/** The noon Date a booking on `ymd` is stored as (matches api/bookings create). */
export function bookingDateForYmd(ymd: string): Date {
  return new Date(ymd + "T12:00:00");
}

/** [gte, lt) UTC day bounds that bracket a noon-stored booking `date` for `ymd`. */
function dayRange(ymd: string): { gte: Date; lt: Date } {
  const gte = new Date(ymd + "T00:00:00.000Z");
  const lt  = new Date(gte.getTime() + 24 * 60 * 60 * 1000);
  return { gte, lt };
}

// ── Walk-in detection ────────────────────────────────────────────────────────
// Walk-ins booked without a phone get a synthetic phone `walkin-<ts>` and the
// placeholder name "Walk-in" (see api/bookings). Treat either as a walk-in for
// display so the board doesn't show a junk phone number.
function isWalkinCustomer(name: string, phone: string): boolean {
  return phone.startsWith("walkin-") || name.trim().toLowerCase() === "walk-in";
}

// ── Types ────────────────────────────────────────────────────────────────────

export type DeskStatus = "WAITING" | "IN_SERVICE" | "DONE";

export interface DeskBooking {
  id:               string;
  startTime:        string;
  endTime:          string;
  status:           string;       // raw BookingStatus
  deskStatus:       DeskStatus;
  staffId:          string | null;
  staffName:        string | null;
  checkedInAt:      string | null; // ISO
  customerName:     string;
  customerNickname: string | null;
  customerPhone:    string | null; // null for anonymous walk-ins
  isWalkin:         boolean;
  serviceName:      string;
  notes:            string | null;
}

export interface StaffLoad {
  staffId:   string;
  name:      string;
  taken:     number; // customers checked in to this staff today (in service + done)
  inService: number;
  done:      number;
}

export interface DeskBoardData {
  branchId: string;
  todayYmd: string;
  staff:    { id: string; name: string }[];
  bookings: DeskBooking[];
  load:     StaffLoad[];
}

// ── Derivation ───────────────────────────────────────────────────────────────

function deriveDeskStatus(status: string, checkedInAt: Date | null): DeskStatus {
  if (status === "COMPLETED") return "DONE";
  if (checkedInAt) return "IN_SERVICE";
  return "WAITING";
}

/** Pure: per-staff load from the day's board bookings (includes zero-count staff). */
export function computeLoad(
  staff: { id: string; name: string }[],
  bookings: DeskBooking[],
): StaffLoad[] {
  const map = new Map<string, StaffLoad>(
    staff.map(s => [s.id, { staffId: s.id, name: s.name, taken: 0, inService: 0, done: 0 }]),
  );
  for (const b of bookings) {
    if (!b.staffId) continue;
    // "Taken" = the customer actually showed up: checked in at the board, OR
    // completed through any path (POS/admin checkout sets no checkedInAt, but a
    // finished service still counts toward the stylist's load for the day).
    if (b.checkedInAt == null && b.deskStatus !== "DONE") continue;
    const row = map.get(b.staffId);
    if (!row) continue; // staff no longer active at the branch — skip
    row.taken += 1;
    if (b.deskStatus === "DONE") row.done += 1;
    else row.inService += 1;
  }
  return Array.from(map.values());
}

// ── Loaders ──────────────────────────────────────────────────────────────────

/** Today's board for one branch: active staff, today's bookings, per-staff load. */
export async function loadDeskBoard(branchId: string): Promise<DeskBoardData> {
  const ymd = bangkokTodayYmd();
  const { gte, lt } = dayRange(ymd);

  const [staff, rows] = await Promise.all([
    prisma.staff.findMany({
      where:   { branchId, isActive: true },
      orderBy: { name: "asc" },
      select:  { id: true, name: true },
    }),
    prisma.booking.findMany({
      where: {
        branchId,
        date:      { gte, lt },
        status:    { notIn: ["CANCELLED", "NO_SHOW"] },
        serviceId: { notIn: SALE_ONLY_SKUS },
      },
      orderBy: [{ startTime: "asc" }, { createdAt: "asc" }],
      select: {
        id: true, startTime: true, endTime: true, status: true,
        staffId: true, checkedInAt: true, notes: true,
        service:  { select: { name: true, nameTh: true } },
        customer: { select: { name: true, nickname: true, phone: true } },
        staff:    { select: { id: true, name: true } },
      },
    }),
  ]);

  const bookings: DeskBooking[] = rows.map(b => {
    const walkin = isWalkinCustomer(b.customer.name, b.customer.phone);
    return {
      id:               b.id,
      startTime:        b.startTime,
      endTime:          b.endTime,
      status:           b.status as string,
      deskStatus:       deriveDeskStatus(b.status as string, b.checkedInAt),
      staffId:          b.staffId,
      staffName:        b.staff?.name ?? null,
      checkedInAt:      b.checkedInAt ? b.checkedInAt.toISOString() : null,
      customerName:     walkin ? "ลูกค้าวอร์คอิน" : b.customer.name,
      customerNickname: walkin ? null : b.customer.nickname,
      customerPhone:    walkin ? null : b.customer.phone,
      isWalkin:         walkin,
      serviceName:      b.service.nameTh || b.service.name,
      notes:            b.notes,
    };
  });

  return { branchId, todayYmd: ymd, staff, bookings, load: computeLoad(staff, bookings) };
}
