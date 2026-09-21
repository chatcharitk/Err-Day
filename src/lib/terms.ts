/**
 * Customer-facing terms & conditions — the single source of truth for every
 * surface that shows or records them (booking confirm step, membership/package
 * signup, and the pre-appointment LINE card).
 *
 * Bump the matching *_VERSION whenever the wording changes. Each acceptance is
 * stamped with the version the customer actually saw, so an old booking stays
 * evidence of the terms in force that day rather than of today's wording.
 */

export const BOOKING_TERMS_VERSION = "2026-09-21";
export const ENTITLEMENT_TERMS_VERSION = "2026-09-21";

/** Late-arrival policy, agreed at the last step of booking. */
export const BOOKING_TERMS_TH = [
  "กรณีมาสายเกิน 10 นาที : ทางร้านขอสงวนสิทธิ์ในการปรับลดขั้นตอนการให้บริการ เพื่อให้บริการเสร็จทันเวลาและไม่กระทบคิวถัดไป",
  "กรณีมาสายเกิน 15 นาที : ทางร้านขอสงวนสิทธิ์ในการยกเลิกนัดหมายนี้",
];

export const BOOKING_TERMS_EN = [
  "If you arrive more than 10 minutes late, err.day reserves the right to shorten some steps of the service so it still finishes on time and the next appointment is not affected.",
  "If you arrive more than 15 minutes late, err.day reserves the right to cancel the appointment.",
];

/** Membership & package policy, agreed when applying for either. */
export const ENTITLEMENT_TERMS_TH = [
  "วันหมดอายุของสมาชิกและแพ็กเกจไม่สามารถเลื่อนหรือขยายออกไปได้ หากไม่ได้รับความยินยอมจากทางร้าน",
  "สมาชิกและแพ็กเกจไม่สามารถขอคืนเงิน หรือเปลี่ยนเป็นรายการอื่นได้",
  "สิทธิ์สมาชิกใช้ได้เฉพาะผู้ที่ลงทะเบียนไว้เท่านั้น หากตรวจพบการใช้สิทธิ์ผิดเงื่อนไข ทางร้านขอสงวนสิทธิ์ยกเลิกสมาชิกโดยไม่คืนเงิน",
];

export const ENTITLEMENT_TERMS_EN = [
  "Membership and package expiry dates cannot be postponed or extended without err.day's consent.",
  "Memberships and packages are non-refundable and cannot be exchanged for anything else.",
  "A membership may only be used by the person who registered it. Misuse entitles err.day to cancel the membership with no refund.",
];

/**
 * The same late-arrival rules, phrased gently for the LINE card that goes out
 * shortly before the appointment. A reminder should read as a helpful nudge,
 * not as the contract being waved at the customer — the binding wording already
 * lives in BOOKING_TERMS_TH, accepted at booking time.
 */
export const BOOKING_TERMS_REMINDER_TH = [
  "มาสายเกิน 10 นาที เราอาจต้องปรับลดบางขั้นตอนลง เพื่อให้เสร็จทันเวลาค่ะ",
  "มาสายเกิน 15 นาที อาจต้องขอเลื่อนหรือยกเลิกนัดนะคะ",
];
