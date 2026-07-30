/**
 * Shared constants + types for the Expense module.
 */

interface ExpenseCategoryDefinition {
  readonly value: string;
  readonly label: string;
}

interface ExpenseCategoryGroupDefinition {
  readonly label: string;
  readonly categories: readonly ExpenseCategoryDefinition[];
}

function defineExpenseCategoryGroups<const T extends readonly ExpenseCategoryGroupDefinition[]>(groups: T): T {
  return groups;
}

/**
 * Detailed salon expense categories. Values remain free strings in the DB,
 * which lets us add categories without a schema migration.
 *
 * Keep the three legacy values at the bottom: historical records already use
 * them and must continue to display with a friendly Thai label.
 */
export const EXPENSE_CATEGORY_GROUPS = defineExpenseCategoryGroups([
  {
    label: "สถานที่และสาธารณูปโภค",
    categories: [
      { value: "rent",              label: "ค่าเช่า" },
      { value: "electricity",       label: "ค่าไฟฟ้า" },
      { value: "water",             label: "ค่าน้ำ" },
      { value: "internet_phone",    label: "ค่าอินเทอร์เน็ต / โทรศัพท์" },
      { value: "maintenance",       label: "ค่าซ่อมแซม / บำรุงรักษา" },
    ],
  },
  {
    label: "ผลิตภัณฑ์และวัสดุสิ้นเปลือง",
    categories: [
      { value: "shampoo",           label: "แชมพู / ครีมนวด" },
      { value: "colour",            label: "สีผม / น้ำยาฟอก" },
      { value: "treatment",         label: "ทรีตเมนต์" },
      { value: "consumable_other",  label: "วัสดุสิ้นเปลืองอื่นๆ" },
    ],
  },
  {
    label: "พนักงาน",
    categories: [
      { value: "salary",            label: "เงินเดือน" },
      { value: "commission_bonus",  label: "คอมมิชชั่น / โบนัส" },
      { value: "freelance",         label: "ค่าจ้างชั่วคราว / ฟรีแลนซ์" },
    ],
  },
  {
    label: "การขายและการดำเนินงาน",
    categories: [
      { value: "marketing",         label: "การตลาด / โฆษณา" },
      { value: "equipment",         label: "อุปกรณ์ / เครื่องมือ" },
      { value: "software",          label: "ระบบ / ซอฟต์แวร์" },
      { value: "professional",      label: "บัญชี / ที่ปรึกษา" },
      { value: "tax_fee",           label: "ภาษี / ค่าธรรมเนียม" },
      { value: "other",             label: "อื่นๆ" },
    ],
  },
  {
    label: "หมวดเดิม (สำหรับรายการเก่า)",
    categories: [
      { value: "supplies",          label: "วัสดุสิ้นเปลือง (รวม)" },
      { value: "utilities",         label: "ค่าสาธารณูปโภค (รวม)" },
      { value: "labor",             label: "ค่าจ้าง (รวม)" },
    ],
  },
] as const);

export type ExpenseCategoryValue =
  typeof EXPENSE_CATEGORY_GROUPS[number]["categories"][number]["value"];

export const EXPENSE_CATEGORIES: readonly ExpenseCategoryDefinition[] =
  EXPENSE_CATEGORY_GROUPS.flatMap(
    (group): readonly ExpenseCategoryDefinition[] => group.categories,
  );

/** The eight most-used buttons on the expense landing page. */
export const EXPENSE_QUICK_CATEGORIES = [
  "rent",
  "electricity",
  "water",
  "shampoo",
  "colour",
  "treatment",
  "salary",
  "marketing",
] as const;

export function isExpenseCategory(value: string | undefined): value is ExpenseCategoryValue {
  return !!value && EXPENSE_CATEGORIES.some(category => category.value === value);
}

export const PAYMENT_METHODS = [
  { value: "CASH",     label: "เงินสด" },
  { value: "TRANSFER", label: "โอนเงิน" },
  { value: "CARD",     label: "บัตรเครดิต / เดบิต" },
  { value: "OTHER",    label: "อื่นๆ" },
] as const;
