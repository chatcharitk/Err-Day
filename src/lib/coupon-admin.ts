import { normalizeCode } from "@/lib/coupon-rules";

/** Validated CouponCampaign fields from an admin form body (baht in, satang out). */
export function parseCampaignInput(b: Record<string, unknown>, partial = false):
  { data: Record<string, unknown> } | { error: string } {
  const data: Record<string, unknown> = {};
  const has = (k: string) => b[k] !== undefined;
  const ymd = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(v + "T12:00:00Z") : null;
  const bahtToSatang = (v: unknown) => {
    if (v === null || v === "" || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : NaN;
  };

  if (!partial || has("code")) {
    const code = normalizeCode(b.code);
    if (!/^[A-Z0-9_-]{3,24}$/.test(code)) return { error: "โค้ดต้องเป็น A–Z / 0–9 ยาว 3–24 ตัว" };
    data.code = code;
  }
  if (!partial || has("name")) {
    const name = typeof b.name === "string" ? b.name.trim().slice(0, 80) : "";
    if (!name) return { error: "กรุณาใส่ชื่อคูปอง" };
    data.name = name;
  }
  if (has("description")) data.description = typeof b.description === "string" && b.description.trim() ? b.description.trim().slice(0, 300) : null;

  const type = has("discountType") ? b.discountType : partial ? undefined : "PERCENT";
  if (type !== undefined) {
    if (type !== "PERCENT" && type !== "AMOUNT") return { error: "ประเภทส่วนลดไม่ถูกต้อง" };
    data.discountType = type;
  }
  if (has("discountValue") && type === undefined) return { error: "ต้องระบุประเภทส่วนลดคู่กับมูลค่า" };
  if (!partial || has("discountValue")) {
    const v = Number(b.discountValue);
    if (!Number.isFinite(v) || v <= 0) return { error: "กรุณาใส่มูลค่าส่วนลด" };
    if (type === "PERCENT" && v > 100) return { error: "ส่วนลดเกิน 100%" };
    // PERCENT keeps the number; AMOUNT arrives in baht.
    data.discountValue = type === "AMOUNT" ? Math.round(v * 100) : Math.round(v);
  }
  if (has("maxDiscountBaht")) {
    const s = bahtToSatang(b.maxDiscountBaht);
    if (Number.isNaN(s)) return { error: "ส่วนลดสูงสุดไม่ถูกต้อง" };
    data.maxDiscountSatang = s && s > 0 ? s : null;
  }
  if (has("minSpendBaht")) {
    const s = bahtToSatang(b.minSpendBaht);
    if (Number.isNaN(s)) return { error: "ยอดขั้นต่ำไม่ถูกต้อง" };
    data.minSpendSatang = s ?? 0;
  }
  if (has("categories")) {
    data.categories = Array.isArray(b.categories) ? b.categories.filter((c): c is string => typeof c === "string" && !!c.trim()) : [];
  }
  if (!partial || has("validFrom")) {
    const d = ymd(b.validFrom);
    if (!d) return { error: "กรุณาเลือกวันเริ่ม" };
    data.validFrom = d;
  }
  if (!partial || has("validUntil")) {
    const d = ymd(b.validUntil);
    if (!d) return { error: "กรุณาเลือกวันหมดอายุ" };
    data.validUntil = d;
  }
  if (data.validFrom && data.validUntil && (data.validUntil as Date) < (data.validFrom as Date)) {
    return { error: "วันหมดอายุต้องไม่ก่อนวันเริ่ม" };
  }
  if (has("claimMode") || !partial) {
    const m = b.claimMode ?? "CODE";
    if (m !== "OPEN" && m !== "CODE" && m !== "ISSUED") return { error: "วิธีรับคูปองไม่ถูกต้อง" };
    data.claimMode = m;
  }
  if (has("usesPerCoupon")) {
    const n = Math.round(Number(b.usesPerCoupon));
    if (!Number.isFinite(n) || n < 1 || n > 99) return { error: "จำนวนครั้งที่ใช้ได้ต้อง 1–99" };
    data.usesPerCoupon = n;
  }
  if (has("maxClaims")) {
    const n = b.maxClaims === null || b.maxClaims === "" ? null : Math.round(Number(b.maxClaims));
    if (n !== null && (!Number.isFinite(n) || n < 1)) return { error: "จำนวนคูปองทั้งหมดไม่ถูกต้อง" };
    data.maxClaims = n;
  }
  if (typeof b.isActive === "boolean") data.isActive = b.isActive;
  return { data };
}
