/**
 * Shared constants + types for the Expense module.
 */

/** Predefined expense categories shown in the UI dropdown. Stored as free
 * strings in the DB so admins can add custom ones later without a migration. */
export const EXPENSE_CATEGORIES = [
  { value: "supplies",   label: "วัสดุสิ้นเปลือง" },   // shampoo, dye, towels
  { value: "rent",       label: "ค่าเช่า" },
  { value: "utilities",  label: "ค่าสาธารณูปโภค" },     // electricity, water, internet
  { value: "marketing",  label: "การตลาด" },           // ads, flyers
  { value: "equipment",  label: "อุปกรณ์" },           // dryers, chairs, tools
  { value: "labor",      label: "ค่าจ้าง" },           // staff bonuses, contractors
  { value: "other",      label: "อื่นๆ" },
] as const;

export type ExpenseCategoryValue = typeof EXPENSE_CATEGORIES[number]["value"];

export const PAYMENT_METHODS = [
  { value: "CASH",     label: "เงินสด" },
  { value: "TRANSFER", label: "โอนเงิน" },
  { value: "CARD",     label: "บัตรเครดิต / เดบิต" },
  { value: "OTHER",    label: "อื่นๆ" },
] as const;
