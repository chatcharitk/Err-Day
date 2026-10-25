import { prisma } from "@/lib/prisma";
import { addMinutes, SALE_ONLY_SKUS } from "@/lib/capacity";
import { bangkokTodayKey, bangkokYmdOf, hasMemberPricingOnDate, serviceMemberRate } from "@/lib/member-pricing";
import { resolveServicePrice } from "@/lib/promotions";
import { POST as createBookingRoute } from "@/app/api/bookings/route";
import { PATCH as updateBookingRoute } from "@/app/api/bookings/[id]/route";

/**
 * Bookings prepared from the AI inbox. The AI only PREPARES a booking or a
 * cancellation (validated against the real schedule); the owner applies it by
 * tapping "จอง + ส่ง" / "ยกเลิก + ส่ง".
 */

export interface BookingProposal {
  /** Absent on drafts saved before cancellations existed. */
  type?: "create";
  branchId: string; branchName: string;
  serviceId: string; serviceName: string;
  date: string; startTime: string; endTime: string; duration: number;
  priceSatang: number;
  customer: {
    id: string | null; name: string; phone: string;
    /** linked = the LINE chat's own customer; existing = found by the phone given; new = created on booking */
    kind: "linked" | "existing" | "new";
  };
  /** The customer gets the shop's booking card on this LINE when it's created. */
  cardOnLine?: boolean;
  /** Tight slot: only this many minutes fit (less than `duration`); the booking is saved this long. */
  tightMinutes?: number;
}

const digitsOf = (phone: string) => phone.replace(/\D/g, "").replace(/^66(?=\d{9}$)/, "0");

/** Customers are stored with or without dashes — try both forms. */
export async function findCustomerByPhone(phone: string) {
  const d = digitsOf(phone);
  if (!/^0\d{8,9}$/.test(d)) return null;
  const variants = [d, `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`, `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`];
  return prisma.customer.findFirst({ where: { phone: { in: variants } }, select: { id: true, name: true, nickname: true, phone: true, lineUserId: true } });
}

/** Validate what the AI wants to book. Returns a proposal or a reason the AI can act on. */
export async function prepareBooking(
  thread: { customerId: string | null; externalUserId: string; channel: string },
  input: { branch_id: string; service_id: string; date: string; start_time: string; customer_name?: string; customer_phone?: string },
  freeStartTimes: (branchId: string, date: string, duration: number) => Promise<{ free_start_times?: string[]; tight_start_times?: { time: string; minutes: number }[]; error?: string }>,
): Promise<{ ok: true; proposal: BookingProposal } | { ok: false; error: string }> {
  const today = bangkokTodayKey();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || input.date < today) return { ok: false, error: "date must be today or later (YYYY-MM-DD)" };
  if (!/^\d{2}:\d{2}$/.test(input.start_time)) return { ok: false, error: "start_time must be HH:mm" };
  if (SALE_ONLY_SKUS.includes(input.service_id)) return { ok: false, error: "membership/packages are sold at the counter, not booked" };

  const bs = await prisma.branchService.findUnique({
    where: { branchId_serviceId: { branchId: input.branch_id, serviceId: input.service_id } },
    select: { price: true, duration: true, isActive: true, branch: { select: { name: true } },
      service: { select: { nameTh: true, name: true, isActive: true, isPublic: true, endsOn: true, memberPrice: true, memberDiscountPercent: true } } },
  });
  if (!bs || !bs.isActive || !bs.service.isActive || !bs.service.isPublic) return { ok: false, error: "this service is not offered at this branch — use a service id from the shop facts" };
  if (bs.service.endsOn && input.date > bs.service.endsOn) return { ok: false, error: `this service is only offered until ${bs.service.endsOn}` };

  const free = await freeStartTimes(input.branch_id, input.date, bs.duration);
  if (free.error) return { ok: false, error: free.error };
  const tight = free.free_start_times?.includes(input.start_time) ? undefined : free.tight_start_times?.find(t => t.time === input.start_time);
  if (!free.free_start_times?.includes(input.start_time) && !tight) {
    const tl = (free.tight_start_times ?? []).map(t => `${t.time} (${t.minutes} min)`).join(", ");
    return { ok: false, error: `${input.start_time} is not free for this ${bs.duration}-minute service. Free start times: ${(free.free_start_times ?? []).join(", ") || "none"}${tl ? `. Tight start times (a little shorter): ${tl}` : ""}` };
  }

  // Who is it for?
  let customer: BookingProposal["customer"];
  let cardOnLine: boolean;
  if (thread.customerId) {
    const c = await prisma.customer.findUnique({ where: { id: thread.customerId }, select: { id: true, name: true, phone: true, lineUserId: true } });
    if (!c) return { ok: false, error: "linked customer not found" };
    customer = { id: c.id, name: c.name, phone: c.phone, kind: "linked" };
    // The shop's booking card goes to the customer's LINE — only "in this chat" when this chat is that LINE.
    cardOnLine = thread.channel === "LINE" && c.lineUserId === thread.externalUserId;
  } else {
    const name = input.customer_name?.trim();
    const phone = input.customer_phone ? digitsOf(input.customer_phone) : "";
    if (!name || !/^0\d{8,9}$/.test(phone)) return { ok: false, error: "this chat is not linked to a customer — ask for their name and a valid Thai phone number first" };
    const existing = await findCustomerByPhone(phone);
    customer = existing
      ? { id: existing.id, name: existing.name, phone: existing.phone, kind: "existing" }
      : { id: null, name, phone, kind: "new" };
    cardOnLine = thread.channel !== "LINE" ? false
      : existing
      ? existing.lineUserId === thread.externalUserId
      // A new customer gets this LINE linked unless another customer already has it.
      : !(await prisma.customer.findUnique({ where: { lineUserId: thread.externalUserId }, select: { id: true } }));
  }

  const isMember = customer.id ? await hasMemberPricingOnDate(prisma, customer.id, input.date) : false;
  const priceSatang = resolveServicePrice({
    serviceId: input.service_id, appointmentDate: input.date, listPrice: bs.price,
    memberPrice: serviceMemberRate({ price: bs.price, ...bs.service }), isMember,
  });
  return {
    ok: true,
    proposal: {
      type: "create",
      branchId: input.branch_id, branchName: bs.branch.name,
      serviceId: input.service_id, serviceName: bs.service.nameTh || bs.service.name,
      date: input.date, startTime: input.start_time, endTime: addMinutes(input.start_time, tight?.minutes ?? bs.duration), duration: bs.duration,
      ...(tight ? { tightMinutes: tight.minutes } : {}),
      priceSatang, customer, cardOnLine,
    },
  };
}

export interface CancelProposal {
  type: "cancel";
  bookingId: string;
  branchName: string; serviceName: string;
  date: string; startTime: string; endTime: string;
  customer: { id: string; name: string; phone: string };
  /** The customer gets the shop's own cancellation message on LINE. */
  notifiedOnLine: boolean;
}

export type BookingAction = BookingProposal | CancelProposal;

/** Only an upcoming booking of the chat's own linked customer can be cancelled from a chat. */
export async function prepareCancellation(thread: { customerId: string | null; channel: string }, bookingId: string): Promise<{ ok: true; proposal: CancelProposal } | { ok: false; error: string }> {
  if (!thread.customerId) return { ok: false, error: "this chat is not linked to a customer — the owner must cancel it by hand; ask for name, date and time and flag it in note" };
  const b = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, customerId: true, status: true, date: true, startTime: true, endTime: true,
      branch: { select: { name: true } }, service: { select: { nameTh: true, name: true } },
      customer: { select: { id: true, name: true, phone: true, lineUserId: true } } },
  });
  if (!b || b.customerId !== thread.customerId) return { ok: false, error: "booking not found for this customer — use a booking id from the customer profile" };
  if (b.status !== "PENDING" && b.status !== "CONFIRMED") return { ok: false, error: `this booking is already ${b.status}` };
  const date = bangkokYmdOf(b.date);
  if (date < bangkokTodayKey()) return { ok: false, error: "this booking is in the past" };
  return {
    ok: true,
    proposal: {
      type: "cancel", bookingId: b.id, branchName: b.branch.name, serviceName: b.service.nameTh || b.service.name,
      date, startTime: b.startTime, endTime: b.endTime,
      customer: { id: b.customer.id, name: b.customer.name, phone: b.customer.phone },
      // The shop's cancellation message goes to their LINE — "in this chat" only for a LINE chat.
      notifiedOnLine: thread.channel === "LINE" && !!b.customer.lineUserId,
    },
  };
}

export class InboxBookingError extends Error {}

/**
 * Create the booking a draft prepared — through the same booking API the admin
 * screens use (capacity check, pricing, staff/group notifications). Idempotent.
 */
export async function bookFromDraft(draftId: string, threadId: string): Promise<{ bookingId: string }> {
  const draft = await prisma.inboxDraft.findUnique({ where: { id: draftId }, include: { thread: true } });
  if (!draft || draft.threadId !== threadId) throw new InboxBookingError("ไม่พบร่างนี้");
  if (draft.bookingId) return { bookingId: draft.bookingId };
  const action = draft.booking as unknown as BookingAction | null;
  if (!action) throw new InboxBookingError("ร่างนี้ไม่มีการจอง");

  if (action.type === "cancel") {
    // Same admin path as the booking screen: status change + the shop's cancellation notices.
    const check = await prepareCancellation(draft.thread, action.bookingId);
    if (!check.ok) throw new InboxBookingError("คิวนี้ยกเลิกไม่ได้แล้ว (อาจถูกยกเลิกหรือเปลี่ยนไปแล้ว)");
    const res = await updateBookingRoute(
      new Request(`http://internal/api/bookings/${action.bookingId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "CANCELLED" }),
      }),
      { params: Promise.resolve({ id: action.bookingId }) },
    );
    if (!res.ok) throw new InboxBookingError("ยกเลิกไม่สำเร็จ");
    await prisma.inboxDraft.update({ where: { id: draftId }, data: { bookingId: action.bookingId } });
    return { bookingId: action.bookingId };
  }
  const p = action;

  // Re-resolve the customer now (they may have been created/linked since).
  let name = p.customer.name, phone = p.customer.phone, linkLine = false;
  if (p.customer.kind === "linked" && draft.thread.customerId) {
    const c = await prisma.customer.findUnique({ where: { id: draft.thread.customerId }, select: { name: true, phone: true } });
    if (c) { name = c.name; phone = c.phone; }
  } else {
    const existing = await findCustomerByPhone(p.customer.phone);
    if (existing) {
      // Never rename an existing customer with what was typed in a chat.
      name = existing.name; phone = existing.phone;
    } else if (draft.thread.channel === "LINE") {
      // New customer from this LINE chat: link the LINE account unless another customer already has it.
      linkLine = !(await prisma.customer.findUnique({ where: { lineUserId: draft.thread.externalUserId }, select: { id: true } }));
    }
  }

  const res = await createBookingRoute(new Request("http://internal/api/bookings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      branchId: p.branchId, serviceId: p.serviceId, date: p.date, startTime: p.startTime, endTime: p.endTime,
      // An admin booking with no total is treated as a deliberate ฿0 — send the
      // prepared price; the booking API still lowers it if a member rate applies.
      totalPrice: p.priceSatang,
      name, phone, isWalkin: true, status: "CONFIRMED",
      internalNotes: p.tightMinutes ? `จองผ่านแชท (AI inbox) · ช่องเวลาตึง ได้ ${p.tightMinutes} จาก ${p.duration} นาที` : "จองผ่านแชท LINE (AI inbox)",
      ...(linkLine ? { lineUserId: draft.thread.externalUserId, ...(draft.thread.displayName ? { lineDisplayName: draft.thread.displayName } : {}) } : {}),
    }),
  }));
  const body = await res.json().catch(() => ({}));
  if (res.status === 409) throw new InboxBookingError("คิวนี้เพิ่งเต็ม — ให้ AI ร่างใหม่เพื่อเสนอเวลาอื่น");
  if (!res.ok || !body?.id) throw new InboxBookingError(body?.error ?? "จองไม่สำเร็จ");

  await prisma.inboxDraft.update({ where: { id: draftId }, data: { bookingId: body.id } });
  // A brand-new customer made from this chat is the chat's customer from now on.
  // A Facebook/Instagram chat has no LINE to link, but a customer created from it is still this chat's customer.
  const createdHere = p.customer.kind === "new" && draft.thread.channel !== "LINE";
  if (!draft.thread.customerId && (linkLine || createdHere)) {
    await prisma.inboxThread.update({ where: { id: threadId }, data: { customerId: body.customerId } });
  }
  return { bookingId: body.id };
}
