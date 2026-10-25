import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { addMinutes, generateTimeSlots, getTakenSlots, loadDaySnapshot, SALE_ONLY_SKUS } from "@/lib/capacity";
import { bangkokTodayKey, bangkokYmdOf, serviceMemberRate } from "@/lib/member-pricing";
import { MEMBERSHIP_PRICE_SATANG, MEMBERSHIP_VALIDITY_DAYS } from "@/lib/membership";
import { PACKAGE_SPECS, findActivePackages } from "@/lib/packages";
import { PROMOTIONS } from "@/lib/promotions";
import { BOOKING_TERMS_TH, ENTITLEMENT_TERMS_TH } from "@/lib/terms";
import { customerCoupons } from "@/lib/coupons";
import { couponValueLabel } from "@/lib/coupon-rules";
import { prepareBooking, prepareCancellation, type BookingAction } from "@/lib/inbox-booking";
import { menuImagesOn } from "@/lib/inbox-media";

/**
 * AI reply inbox — drafting side. Claude writes a reply in the owner's voice
 * for the owner to review; it never sends anything itself.
 */

export const INBOX_MODEL = "claude-sonnet-5-5";
const MAX_TOOL_ROUNDS = 4;
/** Customers often send several bubbles in a row — wait, then answer them together. */
const DEBOUNCE_MS = 3_000;

const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID;
const APP_HOST = process.env.NEXT_PUBLIC_APP_URL ?? "https://book.err-daysalon.com";
const link = (liffPath: string, webPath: string) => LIFF_ID ? `https://liff.line.me/${LIFF_ID}${liffPath}` : `${APP_HOST}${webPath}`;

function anthropic(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return null;
  const workspace = process.env.ANTHROPIC_WORKSPACE_ID?.trim();
  return new Anthropic({ apiKey, timeout: 60_000, ...(workspace ? { defaultHeaders: { "anthropic-workspace-id": workspace } } : {}) });
}

const baht = (satang: number) => `${(satang / 100).toLocaleString("th-TH")} บาท`;
const THAI_DAYS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
const weekday = (ymd: string) => THAI_DAYS[new Date(ymd + "T12:00:00Z").getUTCDay()];

// ── Style & rules (stable: cached) ──────────────────────────────────────────────

const STYLE = `You draft chat replies (LINE, Facebook Messenger or Instagram DM) for "err·day", a hair-wash / blow-dry / treatment salon in Bangkok, writing as the shop's admin (แอดมิน). The owner reads every draft and decides whether to send it, edit it, or write their own — so be accurate and say in "note" anything they should check.

How the owner writes (follow closely):
- Thai, warm and short, female polite particles: statements end with ค่ะ / ค่า, questions with คะ / มั้ยคะ / ไหมคะ.
- Short chat bubbles instead of one long paragraph (usually 1–2, at most 3). One idea per bubble.
- First reply of a new conversation (or the first of the day) opens with "สวัสดีค่า".
- Address the customer ONLY by their nickname as "คุณ<ชื่อเล่น>" (e.g. คุณโอ, คุณเอม) when the customer profile gives one. Otherwise always "คุณลูกค้า" — never use their full/real name, surname, or the chat display name, even if they tell you their name in the chat. Refer to yourself as "แอดมิน".
- Keep it short but polite: say only what is needed, no repeating the question back, no long explanations or lists unless asked. Most replies are 1–2 bubbles of one short sentence each.
- Emoji are welcome (😊 🙏 💕 ✨) — naturally, not in every bubble. Ending the last bubble with an emoji is fine. No formal sign-off.
- Answer the question first, then ask one helpful follow-up question when it moves the booking forward (which branch, what time, what they want to focus on).

Examples of the owner's real replies (each "Admin:" line is ONE separate bubble):
Customer: PJOLI คือทรีทเม้นแบบไหนคะ ต่างจากอันที่เป็นราคา 890 ยังไง
Admin: สวัสดีค่า
Admin: Pjoli จะเน้นเรื่องเส้นผม ความนุ่มลื่นค่า
Admin: Davines จะเน้นได้ทั้งเส้นผม หนังศีรษะค่า มีการสครับหนังศีรษะในแพ็คเกจด้วยค่า
Admin: คุณลูกค้าอยากจะเน้นเรื่องส่วนไหนมั้ยคะ😊
---
Customer: พรุ่งนี้มีคิวว่างกี่โมงบ้างคะ บางนา
Admin: เป็นสาขาบางนาตรงข้าม mega bangna ใช่ไหมคะ
Customer: ใช่ค่ะ
Admin: ยังมีคิวว่างอยู่ค่ะคุณลูกค้า
Admin: สามารถแจ้งเวลาที่สะดวกได้เลยนะคะ แอดมินลงเวลาให้ค่า😊
---
Customer: สวัสดีคะ วันนี้เวลา 8.30 มีคิวว่างไหมคะ สาขาบางนา
Admin: สวัสดีค่า
Admin: ว่างแล้วค่า
Admin: คุณลูกค้าเข้าไปเลยมั้ยคะ
In your output each bubble is its own string in "bubbles" — never put separators like "|" inside a bubble.

How to sell (you are the shop's call-center admin, with a sales mindset — still short and polite):
- Move every conversation toward a booking: answer, then offer the next step (a concrete time, "ให้แอดมินลงคิวให้เลยไหมคะ").
- When a time is full, never stop at "เต็ม" — offer the nearest free times that day (before and after), or the same time on another day.
- Offer at most one relevant extra when it fits naturally (an add-on, a current promotion, membership for frequent visitors) — only from the shop facts, never pushy.
- Close warmly; thank them when they book.

Who the customer is, branch and service (use the customer profile):
- Linked customer whose profile shows a สาขาประจำ (clear preference — only one branch, all recent visits at one branch, or most visits there) → assume that branch; say it in the reply so they can correct it (e.g. "สาขาบางนาเหมือนเดิมนะคะ"). No clear preference → ask which branch they'd like this time. New customer or chat not linked → ask which branch is convenient (สุขุมวิท or บางนา).
- When the customer wants to book and does not name a service, assume สระไดร์ (wash & blow-dry) and say so (e.g. "สระไดร์เหมือนเดิมนะคะ"); if their usual service in the profile is different, assume that one.
- Tight slots: check_availability also lists tight_start_times — times that fit only if the service runs a little shorter (e.g. 40 of 45 minutes). When the wanted time or nearby free times are not available, you may offer a tight slot as a squeeze ("ช่วง 10:00 ยังพอแทรกได้ค่ะ อาจกระชับเวลานิดนึงนะคะ"); prepare_booking accepts it. Always put it in note: "ช่องเวลาตึง: HH:mm ได้ N จาก M นาที".

Hard rules:
- Prices, services, promotions, packages, membership and opening hours: ONLY from the shop facts below. Never invent a price or a service. If something is not in the facts, write a holding reply ("ขอแอดมินเช็คให้สักครู่นะคะ") and explain in note.
- Open times: whenever the customer mentions a day/time (asking, or wanting to book — even if the service is still unknown), call check_availability for EVERY day/time they mention before answering (use 60 minutes when the service is unknown). Never say a time is free or full without checking. Mention 2–4 concrete free times rather than a long list.
- Answer every question in the customer's latest messages, not only the first one.
- Speed matters: when you need several lookups (e.g. two days or two branches), request them all in the same turn (parallel tool calls), not one per turn.
- Booking from the chat: call prepare_booking ONLY when the customer has clearly asked to book AND has chosen the branch, the service, the date and an exact time themselves. Asking what is free ("ว่างกี่โมง", "มีคิวไหม") is NOT a booking request — just answer with the free times. Never prepare a booking "just in case" or pick a service/time for them. It checks the slot; the owner then creates the booking with one tap when sending your reply, so write the reply as a confirmation. If prepare_booking says the customer gets the booking card on LINE, keep it short — the card shows every detail (e.g. "แอดมินลงคิวให้เรียบร้อยแล้วค่ะ 😊 รายละเอียดตามการ์ดเลยนะคะ"). Otherwise include day, date, time, branch and service. If it fails, follow its message (offer the free times it lists, or ask for what is missing).
- Cancelling: when the customer asks to cancel one of the upcoming appointments in their profile, call prepare_cancellation with its booking id (ask which one if it is unclear). If the customer is notified on LINE, keep the reply short — the shop's cancellation message has the details (e.g. "ยกเลิกคิวให้เรียบร้อยแล้วค่ะ ไว้โอกาสหน้านะคะ 🙏"). Only one booking or cancellation per reply. To move an appointment, ask for the new time, then prepare the new booking and say in note that the old one still has to be cancelled.
- Running late: when the customer says they will be late for an appointment, call check_late_arrival with that booking id (from the customer profile; usually today's) and how many minutes late (if they did not say, use 15). If it says fits (the later time does not affect other customers), reply short and warm, e.g. "รับทราบค่า เดี๋ยวแอดมินแจ้งหน้าร้านให้นะคะ 😊" — no rules or warnings. If it does not fit, politely say the next queue is booked so the service may need to be shortened, or offer to move the appointment (check_availability for other times); flag it in note. If the chat is not linked or no booking is found, reply "รับทราบค่า" and ask which branch/time their appointment is if needed. Always put in note: "แจ้งหน้าร้าน: <ชื่อ> สาย ~N นาที (นัด HH:mm สาขา…)" — and add "เลยเวลาปิดร้าน" when finishes_after_closing is set.
- Who the booking is for: if the customer profile says the chat is linked, book for them. If it is NOT linked, ask for their name and phone number first (e.g. "รบกวนขอชื่อและเบอร์โทรศัพท์สำหรับลงคิวด้วยนะคะ 😊"), then pass them to prepare_booking. Never repeat back details of an existing customer found by phone.
- Menu posters: when the customer asks about prices, packages, membership, a service, or opening hours, attach the relevant poster(s) in "images" (at most 2) and keep the text short — the poster answers the details. Bubbles + images must be 5 or fewer.
- Never offer discounts, freebies or exceptions that are not in the facts. Never promise a specific stylist.
- If the branch is unclear and it matters, ask which branch (สุขุมวิท or บางนา).
- Complaints, refunds, anything sensitive or unclear: reply politely and briefly, and flag it in note for the owner.
- Photos from the customer are attached when available — look at them (e.g. a hairstyle they want, their hair length for pricing, a payment slip, a screenshot of a booking) and answer accordingly; describe what you saw in note. Never claim a payment was received from a slip — say แอดมินจะตรวจสอบให้ and flag it in note. Stickers or photos you cannot see: reply naturally, or leave bubbles empty if no reply is needed.
- note is private to the owner (Thai, one or two short lines): what you checked (e.g. "เช็คคิวบางนา 24 ต.ค. แล้ว ว่าง 10:00, 13:30"), what is uncertain, or "-" when nothing to flag.`;

// ── Shop facts (cached alongside the style; changes only when admin edits) ─────

export async function shopFacts(today: string): Promise<string> {
  const branches = await prisma.branch.findMany({
    where: { isActive: true }, orderBy: { id: "asc" },
    select: { id: true, name: true, address: true, phone: true, openTime: true, closeTime: true, mapUrl: true, bookingEnabled: true },
  });
  const rows = await prisma.branchService.findMany({
    where: { isActive: true, service: { isActive: true, isPublic: true } },
    orderBy: [{ branchId: "asc" }, { service: { category: "asc" } }, { price: "asc" }],
    select: {
      branchId: true, serviceId: true, price: true, duration: true,
      service: { select: { nameTh: true, name: true, category: true, descriptionTh: true, memberPrice: true, memberDiscountPercent: true, endsOn: true } },
    },
  });
  const lines: string[] = ["# Shop facts"];
  lines.push("## Branches");
  for (const b of branches) {
    const sunday = b.id === "branch-bangna" ? `${b.openTime ?? "08:00"}` : "10:00";
    lines.push(`- ${b.name} (id: ${b.id}) — ${b.address}; โทร ${b.phone}; เปิด ${b.openTime ?? "08:00"}–${b.closeTime ?? "21:00"} (วันอาทิตย์เปิด ${sunday}); รับนัดคิวสุดท้ายก่อนปิด 30 นาที${b.mapUrl ? `; แผนที่ ${b.mapUrl}` : ""}${b.bookingEnabled ? "" : "; ปิดรับจองออนไลน์ชั่วคราว"}`);
  }
  lines.push("- สาขาบางนาอยู่ตรงข้าม Mega Bangna");
  lines.push("- ร้านปิด 31 ธ.ค.–1 ม.ค. และ 13–15 เม.ย.");

  lines.push("\n## Services (price / member price / minutes) by branch");
  for (const b of branches) {
    lines.push(`### ${b.name}`);
    for (const r of rows.filter(x => x.branchId === b.id && !SALE_ONLY_SKUS.includes(x.serviceId))) {
      if (r.service.endsOn && r.service.endsOn < today) continue;
      const member = serviceMemberRate({ price: r.price, memberPrice: r.service.memberPrice, memberDiscountPercent: r.service.memberDiscountPercent });
      const desc = r.service.descriptionTh?.replace(/\s+/g, " ").trim();
      lines.push(`- ${r.service.nameTh || r.service.name} (id: ${r.serviceId}) [${r.service.category}] — ${baht(r.price)}${member ? ` / สมาชิก ${baht(member)}` : ""} / ${r.duration} นาที${r.service.endsOn ? ` (ถึง ${r.service.endsOn})` : ""}${desc ? ` — ${desc}` : ""}`);
    }
  }

  const promos = PROMOTIONS.filter(p => p.endsOn >= today);
  if (promos.length) {
    lines.push("\n## Promotions (by appointment date)");
    for (const p of promos) {
      const svc = rows.find(r => r.serviceId === p.serviceId)?.service;
      lines.push(`- ${svc?.nameTh || p.serviceId}: ${baht(p.regularPrice)} / สมาชิก ${baht(p.memberPrice)} — นัดวันที่ ${p.startsOn} ถึง ${p.endsOn} (${p.labelTh})`);
    }
  }

  lines.push("\n## Membership & packages");
  lines.push(`- สมาชิก err·day ${baht(MEMBERSHIP_PRICE_SATANG)} ใช้ได้ ${MEMBERSHIP_VALIDITY_DAYS} วัน ได้ราคาสมาชิกทุกบริการ; นับวันแรกจากวันที่เข้ามาใช้บริการครั้งแรกหลังสมัคร; สมัครในไลน์: ${link("/liff/membership/signup", "/liff/membership/signup")} (หน้าเว็บ: ${APP_HOST}/liff/membership/signup)`);
  for (const spec of Object.values(PACKAGE_SPECS)) {
    lines.push(`- ${spec.nameTh} ${baht(spec.priceSatang)} — ${spec.shortDescTh} (ใช้ได้ ${spec.validityDays} วัน)`);
  }
  const addons = await prisma.serviceAddon.findMany({ where: { isActive: true }, orderBy: { price: "asc" }, select: { nameTh: true, price: true, availableUntil: true } });
  const liveAddons = addons.filter(a => !a.availableUntil || a.availableUntil >= today);
  if (liveAddons.length) lines.push(`- Add-on (เพิ่มได้กับบริการ): ${liveAddons.map(a => `${a.nameTh} +${baht(a.price)}`).join(", ")}`);
  lines.push(`- เงื่อนไขสมาชิก/แพ็กเกจ: ${ENTITLEMENT_TERMS_TH.join(" / ")}`);
  lines.push(`- เงื่อนไขการมาสาย: ${BOOKING_TERMS_TH.join(" / ")}`);
  lines.push(`\n## Links\n- จองคิวออนไลน์ — for LINE chats: ${link("", "/book")}; for Facebook/Instagram chats: ${APP_HOST}/book`);
  lines.push("- Facebook/Instagram customers are not on the shop's LINE: they get no LINE booking card, so always write full booking details in your reply there. You may suggest adding the shop's LINE @err.day for booking reminders.");
  lines.push("\n## Menu posters you can attach (key — what it shows)");
  for (const m of menuImagesOn(today)) lines.push(`- ${m.key} — ${m.title}: ${m.about}`);
  return lines.join("\n");
}

// ── Per-request context (not cached) ─────────────────────────────────────────

export async function customerProfile(customerId: string | null, today: string): Promise<string> {
  if (!customerId) return "Customer profile: NOT linked to a customer record — address them as คุณลูกค้า; to book, ask for their name and phone first.";
  const c = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { name: true, nickname: true, membership: { select: { pendingActivation: true, expiresAt: true } } },
  });
  if (!c) return "Customer profile: unknown — address them as คุณลูกค้า.";
  const nick = c.nickname?.trim();
  const out = [`Customer profile (linked — bookings go to this customer): ${c.name}${nick ? ` (ชื่อเล่น ${nick})` : ""} — address them as "${nick ? `คุณ${nick}` : "คุณลูกค้า"}".`];
  const m = c.membership;
  if (m) {
    if (m.pendingActivation) out.push("- สมาชิก: สมัครแล้ว รอเริ่มใช้ในการมาครั้งถัดไป");
    else if (m.expiresAt && bangkokYmdOf(m.expiresAt) >= today) out.push(`- สมาชิก: ใช้ได้ถึง ${bangkokYmdOf(m.expiresAt)}`);
    else out.push("- สมาชิก: หมดอายุแล้ว");
  }
  for (const p of await findActivePackages(customerId)) {
    out.push(`- แพ็กเกจ: ${p.spec.nameTh} ถึง ${bangkokYmdOf(p.expiresAt)}${p.usagesLeft != null ? ` เหลือ ${p.usagesLeft} ครั้ง` : ""}`);
  }
  for (const cp of (await customerCoupons(customerId)).filter(x => x.status === "usable")) {
    out.push(`- คูปอง: ${cp.campaign.name} ${couponValueLabel(cp.campaign)} ใช้ได้ถึง ${cp.campaign.validUntil.slice(0, 10)}`);
  }
  // Visit history per branch (decides whether to assume the branch or ask).
  const past = await prisma.booking.findMany({
    where: { customerId, date: { lt: new Date(today + "T00:00:00Z") }, status: { notIn: ["CANCELLED", "NO_SHOW"] }, serviceId: { notIn: SALE_ONLY_SKUS } },
    select: { date: true, branch: { select: { name: true } }, service: { select: { nameTh: true, name: true } } },
    orderBy: { date: "desc" }, take: 200,
  });
  if (past.length) {
    const byBranch = new Map<string, { n: number; last: string }>();
    const bySvc = new Map<string, number>();
    for (const b of past) {
      const e = byBranch.get(b.branch.name) ?? { n: 0, last: bangkokYmdOf(b.date) };
      e.n++; byBranch.set(b.branch.name, e);
      const sv = b.service.nameTh || b.service.name; bySvc.set(sv, (bySvc.get(sv) ?? 0) + 1);
    }
    // Clear preference: the last 3 visits all at one branch, or ≥80% of visits there.
    const recent = past.slice(0, 3).map(b => b.branch.name);
    const top = [...byBranch].sort((x, y) => y[1].n - x[1].n)[0];
    const preferred = byBranch.size === 1 ? top[0]
      : recent.length >= 3 && recent.every(n => n === recent[0]) ? recent[0]
      : top[1].n / past.length >= 0.8 ? top[0] : null;
    out.push(`- ประวัติการใช้บริการ (${past.length} ครั้ง): ${[...byBranch].map(([n, e]) => `${n} ${e.n} ครั้ง (ล่าสุด ${e.last})`).join(" · ")} · 3 ครั้งล่าสุด: ${recent.join(", ")} → ${preferred ? `สาขาประจำ: ${preferred} — สมมติสาขานี้ได้เลย` : "ไม่มีสาขาประจำชัดเจน — ถามว่าสะดวกสาขาไหน"}`);
    out.push(`- บริการที่ใช้บ่อย: ${[...bySvc].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n, k]) => `${n} (${k})`).join(", ")}`);
  } else {
    out.push("- ประวัติการใช้บริการ: ยังไม่เคยมาใช้บริการ (ลูกค้าใหม่) — ถามสาขาที่สะดวก");
  }
  const bookings = await prisma.booking.findMany({
    where: { customerId, date: { gte: new Date(today + "T00:00:00Z") }, status: { in: ["PENDING", "CONFIRMED"] } },
    orderBy: [{ date: "asc" }, { startTime: "asc" }], take: 5,
    select: { id: true, date: true, startTime: true, endTime: true, branch: { select: { name: true } }, service: { select: { nameTh: true, name: true } } },
  });
  for (const b of bookings) {
    out.push(`- นัดที่มีอยู่ (booking id ${b.id}): ${bangkokYmdOf(b.date)} ${b.startTime}–${b.endTime} ${b.branch.name} — ${b.service.nameTh || b.service.name}`);
  }
  return out.join("\n");
}

// ── Availability tool ────────────────────────────────────────────────────────

/** How much shorter than the service a squeezed ("tight") slot may be. */
const TIGHT_SLACK = 10;

/** Open start times, same rules as /api/availability (online booking). */
export async function availableStartTimes(branchId: string, date: string, duration: number) {
  const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { name: true, openTime: true, closeTime: true } });
  if (!branch) return { error: "unknown branch" };
  const isSunday = new Date(date + "T12:00:00Z").getUTCDay() === 0;
  const open = isSunday && branchId !== "branch-bangna" ? "10:00" : (branch.openTime ?? "08:00");
  const close = branch.closeTime ?? "21:00";
  const lastStart = addMinutes(close, -30);
  const slots = generateTimeSlots(open, lastStart);
  const taken = new Set(await getTakenSlots(branchId, date, duration, null, undefined, open, lastStart));
  const free = slots.filter(t => !taken.has(t));
  // "Tight" slots: not free for the full service, but free if it runs up to
  // TIGHT_SLACK minutes shorter (e.g. 40 of 45) — offered as a squeeze.
  const tight: { time: string; minutes: number }[] = [];
  if (duration > 30) {
    const left = new Set(slots.filter(t => taken.has(t)));
    for (let m = duration - 5; m >= Math.max(30, duration - TIGHT_SLACK) && left.size; m -= 5) {
      const takenShort = new Set(await getTakenSlots(branchId, date, m, null, undefined, open, lastStart));
      for (const t of [...left]) if (!takenShort.has(t)) { tight.push({ time: t, minutes: m }); left.delete(t); }
    }
    tight.sort((a, b) => a.time.localeCompare(b.time));
  }
  return { branch: branch.name, date, weekday: weekday(date), open, close, duration_minutes: duration, free_start_times: free, tight_start_times: tight };
}

const TOOLS: Anthropic.Beta.BetaTool[] = [{
  name: "check_availability",
  description: "Free appointment start times at one branch on one day (Bangkok time), using the same rules as online booking. Call before telling the customer whether a time is free.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      branch_id: { type: "string", description: "Branch id from the shop facts, e.g. branch-bangna or branch-sukhumvit" },
      date: { type: "string", description: "YYYY-MM-DD (Bangkok calendar day)" },
      duration_minutes: { type: "integer", description: "Service length; 60 if unknown" },
    },
    required: ["branch_id", "date", "duration_minutes"],
    additionalProperties: false,
  },
}];

TOOLS.push({
  name: "prepare_booking",
  description: "Check and prepare a booking the customer asked for. Does NOT book — the owner confirms with one tap when sending your reply. For a chat not linked to a customer, pass the name and phone the customer gave.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      branch_id: { type: "string" },
      service_id: { type: "string", description: "Service id from the shop facts" },
      date: { type: "string", description: "YYYY-MM-DD" },
      start_time: { type: "string", description: "HH:mm" },
      customer_name: { type: "string", description: "Only for a chat NOT linked to a customer; else empty string" },
      customer_phone: { type: "string", description: "Only for a chat NOT linked to a customer; else empty string" },
    },
    required: ["branch_id", "service_id", "date", "start_time", "customer_name", "customer_phone"],
    additionalProperties: false,
  },
});

TOOLS.push({
  name: "prepare_cancellation",
  description: "Prepare cancelling one of the linked customer's upcoming appointments (booking id from the customer profile). Does NOT cancel — the owner confirms with one tap when sending your reply.",
  strict: true,
  input_schema: {
    type: "object",
    properties: { booking_id: { type: "string" } },
    required: ["booking_id"],
    additionalProperties: false,
  },
});

TOOLS.push({
  name: "check_late_arrival",
  description: "The customer will be late for one of their upcoming appointments (booking id from the customer profile). Checks whether starting that many minutes later still fits — staff free, the assigned stylist's next customer not affected, and finishing before closing — so other customers are not affected.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      booking_id: { type: "string" },
      minutes_late: { type: "integer", description: "How many minutes late; 15 if the customer did not say" },
    },
    required: ["booking_id", "minutes_late"],
    additionalProperties: false,
  },
});

/** Would this booking, shifted later by `late` minutes, still fit without pushing anyone else? */
export async function checkLateArrival(customerId: string | null, bookingId: string, late: number) {
  if (!customerId) return { ok: false, error: "chat is not linked to a customer — cannot look up the appointment" };
  const b = await prisma.booking.findFirst({
    where: { id: bookingId, customerId, status: { in: ["PENDING", "CONFIRMED"] } },
    select: { id: true, branchId: true, date: true, startTime: true, endTime: true, staffId: true, branch: { select: { name: true, closeTime: true } } },
  });
  if (!b) return { ok: false, error: "booking not found among this customer's upcoming appointments" };
  const minutes = Math.max(1, Math.min(180, Math.round(late)));
  const date = bangkokYmdOf(b.date);
  const start = addMinutes(b.startTime, minutes);
  const end = addMinutes(b.endTime, minutes);
  const close = b.branch.closeTime ?? "21:00";
  const appointment = { date, time: `${b.startTime}–${b.endTime}`, branch: b.branch.name };
  // Only other customers matter here (running past closing or a shift end is
  // the shop's call, reported separately). Staff = those on shift at the
  // original start; the later window must not need more chairs than that, and
  // the assigned stylist must not have someone else booked in it.
  const snap = await loadDaySnapshot(b.branchId, date, b.id);
  const overlap = (x: { startTime: string; endTime: string }) => x.startTime < end && x.endTime > start;
  const staffCount = snap.hasShifts
    ? new Set(snap.shifts.filter(sh => sh.startTime <= b.startTime && sh.endTime > b.startTime).map(sh => sh.staffId)).size
    : snap.activeStaffIds.length;
  const others = snap.bookings.filter(overlap);
  const occupied = new Set(others.filter(o => o.staffId).map(o => o.staffId)).size + others.filter(o => !o.staffId).length;
  const stylistBusy = !!b.staffId && others.some(o => o.staffId === b.staffId);
  const fits = occupied < Math.max(1, staffCount) && !stylistBusy;
  return {
    ok: true, fits, appointment, minutes_late: minutes, new_time: `${start}–${end}`,
    ...(end > close ? { finishes_after_closing: close } : {}),
    ...(fits ? {} : { reason: stylistBusy ? "the assigned stylist has the next customer" : "other customers are booked at the later time — no free staff" }),
  };
}

function outputSchema(imageKeys: string[]) {
  return {
    type: "object",
    properties: {
      bubbles: { type: "array", items: { type: "string" }, description: "Chat bubbles to send, in order (empty if no reply is needed)" },
      images: { type: "array", items: { type: "string", enum: imageKeys }, description: "Menu poster keys to attach after the bubbles (usually none)" },
      note: { type: "string", description: "Private note to the owner, Thai, short" },
    },
    required: ["bubbles", "images", "note"],
    additionalProperties: false,
  };
}

// ── Draft generation ─────────────────────────────────────────────────────────

function transcript(messages: { id: string; direction: string; kind: string; text: string | null; createdAt: Date }[], photoNo: Map<string, number>): string {
  return messages.map(m => {
    const t = new Date(m.createdAt.getTime() + 7 * 3600_000);
    const stamp = `${bangkokYmdOf(m.createdAt)} ${String(t.getUTCHours()).padStart(2, "0")}:${String(t.getUTCMinutes()).padStart(2, "0")}`;
    const who = m.direction === "IN" ? "ลูกค้า" : "แอดมิน";
    const body = m.kind === "text" ? m.text
      : m.kind === "note" ? "(แอดมินตอบลูกค้าใน LINE OA ไปแล้ว — ไม่ได้บันทึกข้อความ)"
      : m.kind === "sticker" ? "(ส่งสติกเกอร์)"
      : m.kind === "image" ? (m.direction === "OUT" ? `(ส่งรูป: ${m.text ?? "รูปภาพ"})` : photoNo.has(m.id) ? `(ส่งรูปภาพ — รูปที่ ${photoNo.get(m.id)} แนบด้านล่าง)` : "(ส่งรูปภาพ — ดูไม่ได้)")
      : "(ส่งไฟล์/ข้อความอื่น)";
    return `[${who} ${stamp}] ${body}`;
  }).join("\n");
}

type PhotoType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";
const PHOTO_TYPES: PhotoType[] = ["image/jpeg", "image/png", "image/gif", "image/webp"];

/** The customer's latest photos (up to 3), fetched from our copy so the AI can look at them. */
async function customerPhotos(history: { id: string; direction: string; kind: string; mediaUrl: string | null }[]) {
  const recent = history.filter(m => m.direction === "IN" && m.kind === "image" && m.mediaUrl).slice(-3);
  const out: { messageId: string; mediaType: PhotoType; data: string }[] = [];
  for (const m of recent) {
    const res = await fetch(m.mediaUrl!, { signal: AbortSignal.timeout(8_000) }).catch(() => null);
    if (!res?.ok) continue;
    const type = (res.headers.get("content-type") ?? "").split(";")[0].trim() as PhotoType;
    const buf = Buffer.from(await res.arrayBuffer());
    if (!PHOTO_TYPES.includes(type) || buf.length > 3_500_000) continue;
    out.push({ messageId: m.id, mediaType: type, data: buf.toString("base64") });
  }
  return out;
}

/**
 * Draft a reply to the thread's latest customer message(s). With `debounce`,
 * waits a few seconds and gives up if a newer customer message arrived (its
 * own call will draft instead).
 */
export async function draftReply(
  threadId: string,
  forMessageId: string | null,
  opts: { debounce?: boolean; instruction?: string; previous?: string[] } = {},
) {
  if (opts.debounce) {
    await new Promise(r => setTimeout(r, DEBOUNCE_MS));
    const latest = await prisma.inboxMessage.findFirst({ where: { threadId, direction: "IN" }, orderBy: { createdAt: "desc" }, select: { id: true } });
    if (latest?.id !== forMessageId) return null;
  }
  const thread = await prisma.inboxThread.findUnique({ where: { id: threadId }, select: { customerId: true, externalUserId: true, channel: true } });
  if (!thread) return null;

  await prisma.inboxDraft.updateMany({ where: { threadId, status: { in: ["PENDING", "READY", "FAILED"] } }, data: { status: "STALE" } });
  const draft = await prisma.inboxDraft.create({ data: { threadId, forMessageId, status: "PENDING", model: INBOX_MODEL } });

  const client = anthropic();
  if (!client) {
    await prisma.inboxDraft.update({ where: { id: draft.id }, data: { status: "FAILED", error: "ANTHROPIC_API_KEY is not set" } });
    return null;
  }

  try {
    const today = bangkokTodayKey();
    const now = new Date(Date.now() + 7 * 3600_000);
    const history = (await prisma.inboxMessage.findMany({ where: { threadId }, orderBy: { createdAt: "desc" }, take: 40 })).reverse();
    const photos = await customerPhotos(history);
    const photoNo = new Map(photos.map((p, i) => [p.messageId, i + 1]));
    const userText = [
      `Channel: ${thread.channel === "LINE" ? "LINE" : thread.channel === "FACEBOOK" ? "Facebook Messenger" : "Instagram DM"}.`,
      `Now: ${today} (วัน${weekday(today)}) ${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")} Bangkok time.`,
      await customerProfile(thread.customerId, today),
      "Conversation so far (oldest first; replies the owner typed directly in LINE OA Manager may be missing):",
      transcript(history, photoNo),
      opts.instruction?.trim()
        ? `The owner asked you to rewrite the draft.\nPrevious draft (bubbles): ${JSON.stringify(opts.previous ?? [])}\nOwner's instruction: ${opts.instruction.trim().slice(0, 300)}\nRewrite the reply following the instruction; all rules still apply.`
        : "Write the next reply to the customer's latest message(s).",
    ].join("\n\n");

    const messages: Anthropic.Beta.BetaMessageParam[] = [{
      role: "user",
      content: photos.length
        ? [{ type: "text", text: userText }, ...photos.flatMap((p, i): Anthropic.Beta.BetaContentBlockParam[] => [
            { type: "text", text: `รูปที่ ${i + 1} จากลูกค้า:` },
            { type: "image", source: { type: "base64", media_type: p.mediaType, data: p.data } },
          ])]
        : userText,
    }];
    const system: Anthropic.Beta.BetaTextBlockParam[] = [
      { type: "text", text: STYLE },
      { type: "text", text: await shopFacts(today), cache_control: { type: "ephemeral" } },
    ];
    let inputTokens = 0, outputTokens = 0;
    let booking: BookingAction | null = null;
    const imageKeys = menuImagesOn(today).map(m => m.key);

    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const res = await client.beta.messages.create({
        model: INBOX_MODEL,
        max_tokens: 4000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system,
        tools: TOOLS,
        // Out of tool rounds → must answer now.
        ...(round === MAX_TOOL_ROUNDS ? { tool_choice: { type: "none" as const } } : {}),
        // Chat replies: low effort is faster and enough; caching the growing
        // conversation makes each tool round cheaper and quicker.
        output_config: { effort: "low", format: { type: "json_schema", schema: outputSchema(imageKeys) } },
        cache_control: { type: "ephemeral" },
        messages,
      });
      inputTokens += (res.usage.input_tokens ?? 0) + (res.usage.cache_read_input_tokens ?? 0) + (res.usage.cache_creation_input_tokens ?? 0);
      outputTokens += res.usage.output_tokens ?? 0;

      if (res.stop_reason === "refusal") throw new Error("Claude declined to draft this one");
      const toolUses = res.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
      if (res.stop_reason === "tool_use" && toolUses.length && round < MAX_TOOL_ROUNDS) {
        messages.push({ role: "assistant", content: res.content });
        const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
        for (const tu of toolUses) {
          const input = tu.input as { branch_id?: string; date?: string; duration_minutes?: number; service_id?: string; start_time?: string; customer_name?: string; customer_phone?: string };
          let content: string;
          if (tu.name === "prepare_cancellation") {
            const r = await prepareCancellation(thread, String((tu.input as { booking_id?: string }).booking_id ?? ""));
            if (r.ok) booking = r.proposal;
            content = JSON.stringify(r.ok
              ? { ok: true, prepared: { cancel: `${r.proposal.date} ${r.proposal.startTime} ${r.proposal.branchName} — ${r.proposal.serviceName}` },
                  customer_notified_on_line: r.proposal.notifiedOnLine,
                  next: "Write the reply. The owner cancels it when sending." }
              : { ok: false, error: r.error });
          } else if (tu.name === "prepare_booking") {
            const r = await prepareBooking(thread, {
              branch_id: input.branch_id ?? "", service_id: input.service_id ?? "", date: input.date ?? "", start_time: input.start_time ?? "",
              customer_name: input.customer_name, customer_phone: input.customer_phone,
            }, availableStartTimes);
            if (r.ok) booking = r.proposal;
            content = JSON.stringify(r.ok
              ? { ok: true, prepared: { branch: r.proposal.branchName, service: r.proposal.serviceName, date: r.proposal.date, weekday: weekday(r.proposal.date), time: `${r.proposal.startTime}–${r.proposal.endTime}`, price_baht: r.proposal.priceSatang / 100 },
                  customer: r.proposal.customer.kind === "existing" ? "an existing customer matched this phone — do not repeat their details" : r.proposal.customer.kind,
                  customer_gets_booking_card_on_line: !!r.proposal.cardOnLine,
                  ...(r.proposal.tightMinutes ? { tight_slot: `only ${r.proposal.tightMinutes} of ${r.proposal.duration} minutes fit — mention it gently and put it in note` } : {}),
                  next: "Write the confirmation reply. The owner books it when sending." }
              : { ok: false, error: r.error });
          } else if (tu.name === "check_late_arrival") {
            const li = tu.input as { booking_id?: string; minutes_late?: number };
            content = JSON.stringify(await checkLateArrival(thread.customerId, String(li.booking_id ?? ""), Number(li.minutes_late ?? 15)));
          } else if (tu.name === "check_availability" && input.branch_id && /^\d{4}-\d{2}-\d{2}$/.test(input.date ?? "")) {
            content = input.date! < today
              ? JSON.stringify({ error: "date is in the past" })
              : JSON.stringify(await availableStartTimes(input.branch_id, input.date!, Math.max(30, Math.min(240, input.duration_minutes ?? 60))));
          } else {
            content = JSON.stringify({ error: "invalid input" });
          }
          results.push({ type: "tool_result", tool_use_id: tu.id, content });
        }
        messages.push({ role: "user", content: results });
        continue;
      }

      const text = res.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map(b => b.text).join("");
      if (!text.trim()) throw new Error(res.stop_reason === "max_tokens" ? "ร่างยาวเกินไป ลองกดร่างใหม่" : `AI ไม่ได้เขียนคำตอบ (${res.stop_reason})`);
      const parsed = JSON.parse(text) as { bubbles: string[]; images?: string[]; note: string };
      const images = [...new Set((parsed.images ?? []).filter(k => imageKeys.includes(k)))].slice(0, 2);
      const bubbles = (parsed.bubbles ?? []).map(s => s.trim()).filter(Boolean).slice(0, 5 - images.length);
      // Only if still current — a reply may have been sent meanwhile (draft → STALE).
      await prisma.inboxDraft.updateMany({
        where: { id: draft.id, status: "PENDING" },
        data: {
          status: "READY", bubbles, note: parsed.note?.trim() || null, inputTokens, outputTokens,
          ...(booking ? { booking: booking as unknown as Prisma.InputJsonValue } : {}),
          ...(images.length ? { images } : {}),
        },
      });
      return prisma.inboxDraft.findUnique({ where: { id: draft.id } });
    }
    throw new Error("too many availability lookups");
  } catch (e) {
    const error = e instanceof Anthropic.APIError ? `API ${e.status}: ${e.message}` : e instanceof Error ? e.message : String(e);
    console.error("[inbox] draft failed", threadId, error);
    await prisma.inboxDraft.update({ where: { id: draft.id }, data: { status: "FAILED", error: error.slice(0, 500) } });
    return null;
  }
}
