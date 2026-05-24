/**
 * Tool definitions for the err.day AI customer agent (Phase 3).
 *
 * Each tool is a pair: the schema Claude sees (name, description, input_schema)
 * and the local implementation that runs the actual Prisma query.
 *
 * Per-user tools (lookup_my_bookings, check_membership_status) DO NOT expose
 * lineUserId in their schema — the runner reads it from the passed context.
 * This prevents the agent from being tricked into querying other people's
 * data.
 */
import type Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { getTakenSlots, generateTimeSlots, addMinutes } from "@/lib/capacity";

export type ToolDef = Anthropic.Tool;
export interface ToolContext {
  /** LINE userId of the sender. Available for tools that need per-user scoping. */
  lineUserId?: string;
}
export type ToolResult = { name: string; result: unknown };

const SALE_ONLY_SKUS = ["svc-membership-30d", "svc-buffet", "svc-pkg5"];


// ── Tool 1: lookup_branches ───────────────────────────────────────────────────

const LOOKUP_BRANCHES: ToolDef = {
  name: "lookup_branches",
  description:
    "List currently-open err.day salon branches with name, address, phone, " +
    "and daily open/close hours. Use when the customer asks where the salon " +
    "is, what branches exist, hours, or contact info.",
  input_schema: { type: "object", properties: {}, required: [] },
};

async function runLookupBranches() {
  const branches = await prisma.branch.findMany({
    where: { isActive: true, bookingEnabled: true },
    orderBy: [{ name: "desc" }],   // ส (สุขุมวิท) before บ (บางนา)
    select: {
      id: true, name: true, address: true, phone: true,
      openTime: true, closeTime: true,
    },
  });
  return branches.map(b => ({
    branchId:      b.id,
    name:          b.name,
    address:       b.address,
    phone:         b.phone,
    hours_mon_sat: `${b.openTime ?? "08:00"}–${b.closeTime ?? "21:00"}`,
    hours_sunday:  `10:00–${b.closeTime ?? "21:00"}`,
  }));
}


// ── Tool 2: lookup_services ───────────────────────────────────────────────────

const LOOKUP_SERVICES: ToolDef = {
  name: "lookup_services",
  description:
    "List services offered at a specific branch with their price (THB) and " +
    "duration (minutes). Use when the customer asks 'what services do you " +
    "have', 'how much is X', 'how long does X take'. Membership and package " +
    "products are excluded — those aren't bookable as appointments.",
  input_schema: {
    type: "object",
    properties: {
      branchId: {
        type: "string",
        description: "Branch ID (e.g. 'branch-sukhumvit'). Call lookup_branches first if unknown.",
      },
    },
    required: ["branchId"],
  },
};

async function runLookupServices(input: { branchId: string }) {
  const rows = await prisma.branchService.findMany({
    where: {
      branchId: input.branchId,
      isActive: true,
      serviceId: { notIn: SALE_ONLY_SKUS },
    },
    select: {
      price: true,
      duration: true,
      service: {
        select: {
          nameTh: true,
          name: true,
          category: true,
          memberPrice: true,
          memberDiscountPercent: true,
          advanceBookingRequired: true,
        },
      },
    },
    orderBy: { service: { category: "asc" } },
  });
  return rows.map(r => ({
    name:                   r.service.nameTh || r.service.name,
    category:               r.service.category,
    price_baht:             Math.round(r.price / 100),
    duration_minutes:       r.duration,
    member_price_baht:      computeMemberPrice(r.price, r.service.memberPrice, r.service.memberDiscountPercent),
    requires_advance_booking: r.service.advanceBookingRequired,
  }));
}

function computeMemberPrice(price: number, memberPrice: number | null, discountPct: number): number | null {
  if (memberPrice != null && memberPrice > 0) return Math.round(memberPrice / 100);
  if (discountPct > 0) return Math.round((price * (1 - discountPct / 100)) / 100);
  return null;
}


// ── Tool 3: check_availability ────────────────────────────────────────────────

const CHECK_AVAILABILITY: ToolDef = {
  name: "check_availability",
  description:
    "Return the available time slots at a branch on a given date for a " +
    "service of the requested duration. Returns slots in 30-minute increments. " +
    "Honours all the same rules as the booking page: staff shifts, branch " +
    "capacity, blocked time, 30-min buffer before close, past slots filtered. " +
    "Call lookup_services first if you need to know the service duration.",
  input_schema: {
    type: "object",
    properties: {
      branchId: {
        type: "string",
        description: "Branch ID (e.g. 'branch-sukhumvit'). Call lookup_branches first if unknown.",
      },
      date: {
        type: "string",
        description: "Appointment date in YYYY-MM-DD format (Bangkok local time).",
      },
      duration_minutes: {
        type: "integer",
        description: "Service duration in minutes (e.g. 45 for สระไดร์). Defaults to 60 if unsure.",
      },
    },
    required: ["branchId", "date"],
  },
};

async function runCheckAvailability(input: { branchId: string; date: string; duration_minutes?: number }) {
  const duration = input.duration_minutes ?? 60;

  // Fetch branch open/close hours (Sunday gets the 10:00 override).
  const branch = await prisma.branch.findUnique({
    where:  { id: input.branchId },
    select: { name: true, openTime: true, closeTime: true },
  });
  if (!branch) return { error: `branch not found: ${input.branchId}` };

  const [yr, mo, dy] = input.date.split("-").map(Number);
  const isSunday = new Date(yr, mo - 1, dy).getDay() === 0;
  const openTime  = isSunday ? "10:00" : (branch.openTime ?? "08:00");
  const closeTime = branch.closeTime ?? "21:00";
  const lastClose = addMinutes(closeTime, -30);  // 30-min buffer

  const taken    = await getTakenSlots(input.branchId, input.date, duration, null, undefined, openTime, lastClose);
  const allSlots = generateTimeSlots(openTime, lastClose);
  const takenSet = new Set(taken);
  const available = allSlots.filter(s => !takenSet.has(s));

  return {
    branch_name:       branch.name,
    date:              input.date,
    duration_minutes:  duration,
    available_slots:   available,
    total_available:   available.length,
  };
}


// ── Tool 4: lookup_my_bookings ───────────────────────────────────────────────

const LOOKUP_MY_BOOKINGS: ToolDef = {
  name: "lookup_my_bookings",
  description:
    "Return the SENDER's upcoming bookings (PENDING or CONFIRMED, today or " +
    "later). Use when the customer asks 'what bookings do I have', 'when is " +
    "my next appointment', 'do I have an appointment'. The customer's identity " +
    "comes from their LINE userId — they cannot query other people's bookings.",
  input_schema: { type: "object", properties: {}, required: [] },
};

async function runLookupMyBookings(_input: unknown, ctx: ToolContext) {
  if (!ctx.lineUserId) {
    return { error: "ลูกค้ายังไม่ได้เชื่อม LINE — โปรดจองผ่านเว็บ /book สักครั้งเพื่อเชื่อมบัญชี" };
  }
  const customer = await prisma.customer.findFirst({
    where:  { lineUserId: ctx.lineUserId },
    select: { id: true, name: true },
  });
  if (!customer) {
    return { customer_known: false, message: "ลูกค้ายังไม่มีในระบบ" };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const bookings = await prisma.booking.findMany({
    where: {
      customerId: customer.id,
      date:       { gte: today },
      status:     { in: ["PENDING", "CONFIRMED"] },
    },
    select: {
      date: true, startTime: true, endTime: true, status: true,
      branch:  { select: { name: true } },
      service: { select: { nameTh: true, name: true } },
      staff:   { select: { name: true } },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    take: 10,
  });

  return {
    customer_known: true,
    name:           customer.name,
    bookings: bookings.map(b => ({
      date:       b.date.toISOString().slice(0, 10),
      start_time: b.startTime,
      end_time:   b.endTime,
      status:     b.status,
      branch:     b.branch.name,
      service:    b.service.nameTh || b.service.name,
      staff:      b.staff?.name ?? null,
    })),
  };
}


// ── Tool 5: check_membership_status ──────────────────────────────────────────

const CHECK_MEMBERSHIP_STATUS: ToolDef = {
  name: "check_membership_status",
  description:
    "Return the SENDER's membership status: active vs expired, expiry date, " +
    "usages remaining (if any). Use when the customer asks 'am I a member', " +
    "'when does my membership expire', 'how many uses left'. Membership belongs " +
    "to the LINE-linked customer — no enumeration of others.",
  input_schema: { type: "object", properties: {}, required: [] },
};

async function runCheckMembershipStatus(_input: unknown, ctx: ToolContext) {
  if (!ctx.lineUserId) {
    return { error: "ลูกค้ายังไม่ได้เชื่อม LINE" };
  }
  const customer = await prisma.customer.findFirst({
    where: { lineUserId: ctx.lineUserId },
    select: {
      name: true,
      membership: {
        select: { expiresAt: true, usagesUsed: true, usagesAllowed: true, pendingActivation: true, label: true },
      },
    },
  });
  if (!customer) return { customer_known: false, is_member: false };
  if (!customer.membership) return { customer_known: true, name: customer.name, is_member: false };

  const m = customer.membership;
  const now = new Date();
  const expired = m.expiresAt != null && m.expiresAt < now;
  const usedUp  = m.usagesAllowed > 0 && m.usagesUsed >= m.usagesAllowed;
  const isActive = !m.pendingActivation && !expired && !usedUp;

  return {
    customer_known: true,
    name:           customer.name,
    is_member:      isActive,
    label:          m.label,
    pending_activation: m.pendingActivation,
    expires_at:     m.expiresAt?.toISOString().slice(0, 10) ?? null,
    usages_used:    m.usagesUsed,
    usages_allowed: m.usagesAllowed,        // 0 = unlimited
    usages_left:    m.usagesAllowed > 0 ? Math.max(0, m.usagesAllowed - m.usagesUsed) : null,
  };
}


// ── Registry + Dispatcher ─────────────────────────────────────────────────────

export const TOOL_DEFS: ToolDef[] = [
  LOOKUP_BRANCHES,
  LOOKUP_SERVICES,
  CHECK_AVAILABILITY,
  LOOKUP_MY_BOOKINGS,
  CHECK_MEMBERSHIP_STATUS,
];

export async function executeTool(
  name: string,
  input: unknown,
  ctx: ToolContext,
): Promise<ToolResult> {
  switch (name) {
    case "lookup_branches":
      return { name, result: await runLookupBranches() };
    case "lookup_services":
      return { name, result: await runLookupServices(input as { branchId: string }) };
    case "check_availability":
      return { name, result: await runCheckAvailability(input as { branchId: string; date: string; duration_minutes?: number }) };
    case "lookup_my_bookings":
      return { name, result: await runLookupMyBookings(input, ctx) };
    case "check_membership_status":
      return { name, result: await runCheckMembershipStatus(input, ctx) };
    default:
      return { name, result: { error: `unknown tool: ${name}` } };
  }
}
