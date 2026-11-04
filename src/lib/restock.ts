/**
 * The branch restock checklist ("เช็กลิสต์ของนำไปเติมที่ร้าน") — same groups and
 * items as the paper form. Requests store the labels, so renaming an item here
 * only affects new requests.
 */
export const RESTOCK_GROUPS: { title: string; items: string[] }[] = [
  { title: "ผลิตภัณฑ์สำหรับบริการลูกค้า", items: ["แชมพู", "ครีมนวด", "สเปรย์ใส่ผมก่อนไดร์", "ออยใส่ผม"] },
  { title: "ผ้าสำหรับบริการลูกค้า",       items: ["ผ้าเช็ดผม", "ผ้ารองสระ", "ผ้าห่ม"] },
  { title: "ของรับรองลูกค้า",             items: ["ขนมเสิร์ฟลูกค้า", "คุกกี้", "ทิชชู่ลูกค้า", "ไพ่ทาโร่"] },
  { title: "ของใช้ส่วนกลางในร้าน",        items: ["กระดาษเช็ดมือ", "สเปรย์ร้าน", "สเปรย์มือ", "อโรม่าใส่น้ำ", "ผ้าเช็ดเท้า"] },
  { title: "ของใช้พนักงาน",               items: ["ทิชชู่พนักงาน"] },
  { title: "ของที่ต้องรับกลับ",           items: ["รับผ้าใช้แล้วกลับไปซัก"] },
];

const ALL = new Set(RESTOCK_GROUPS.flatMap(g => g.items));
export const isRestockItem = (s: string) => ALL.has(s);
