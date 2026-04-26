import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import "dotenv/config";

neonConfig.webSocketConstructor = ws;

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  // ─── Remove old placeholder branches ───────────────────────────────────────
  await prisma.branch.updateMany({
    where: { id: { in: ["branch-silom", "branch-thonglor"] } },
    data: { isActive: false },
  });

  // ─── Branches ────────────────────────────────────────────────────────────
  const branch1 = await prisma.branch.upsert({
    where: { id: "branch-sukhumvit" },
    update: {
      name: "err.day สาขาสุขุมวิท",
      address: "โครงการ Academe ซอย สุขุมวิท 70/3 แขวงบางนาใต้ เขตบางนา กรุงเทพมหานคร 10260",
      phone: "02-123-4567",
      isActive: true,
    },
    create: {
      id: "branch-sukhumvit",
      name: "err.day สาขาสุขุมวิท",
      address: "โครงการ Academe ซอย สุขุมวิท 70/3 แขวงบางนาใต้ เขตบางนา กรุงเทพมหานคร 10260",
      phone: "02-123-4567",
    },
  });

  const branch2 = await prisma.branch.upsert({
    where: { id: "branch-bangna" },
    update: {
      name: "err.day สาขาบางนา",
      address: "โครงการ Primary House 34 บ้านเลขที่ 42/23 31 ซอย จรรยวรรธ ตำบล บางแก้ว อำเภอบางพลี สมุทรปราการ 10540",
      phone: "02-987-6543",
      isActive: true,
    },
    create: {
      id: "branch-bangna",
      name: "err.day สาขาบางนา",
      address: "โครงการ Primary House 34 บ้านเลขที่ 42/23 31 ซอย จรรยวรรธ ตำบล บางแก้ว อำเภอบางพลี สมุทรปราการ 10540",
      phone: "02-987-6543",
    },
  });

  const branches = [branch1, branch2];

  // ─── Services ─────────────────────────────────────────────────────────────
  const serviceData = [
    // ── General: Walk-in ──
    {
      id: "svc-walkin",
      name: "Wash, Blow-dry & Styling",
      nameTh: "สระ เป่า จัดทรง (Walk-in)",
      category: "บริการทั่วไป",
      description: "Standard wash, blow-dry and styling service.",
      descriptionTh: "บริการสระผม เป่าผม และจัดทรงมาตรฐาน",
      memberPrice: 10000, // ฿100
    },
    // ── Packages ──
    {
      id: "svc-pkg5",
      name: "5 Times Package",
      nameTh: "แพ็กเกจ 5 ครั้ง",
      category: "แพ็กเกจ",
      description: "5 sessions. Valid 90 days. Shareable with friends & family. (avg ฿320/time)",
      descriptionTh: "5 ครั้ง ใช้ได้ 90 วัน แบ่งให้เพื่อนและครอบครัวได้ (เฉลี่ย 320 บาท/ครั้ง)",
    },
    {
      id: "svc-buffet",
      name: "Buffet (Monthly)",
      nameTh: "บุฟเฟต์ รายเดือน",
      category: "แพ็กเกจ",
      description: "Unlimited wash & blow-dry, 1 time/day for 30 days. (avg ฿117/time)",
      descriptionTh: "สระ+เป่าได้ 1 ครั้ง/วัน ใช้ได้ 30 วัน (เฉลี่ย 117 บาท/ครั้ง)",
    },
    {
      id: "svc-member-monthly",
      name: "Member Subscription",
      nameTh: "สมาชิกรายเดือน ⭐ ยอดนิยม",
      category: "แพ็กเกจ",
      description: "Monthly fee ฿990. Then ฿100/session for 30 days. Most popular!",
      descriptionTh: "ค่าสมาชิก 990 บาท/เดือน แล้วใช้บริการเพียง 100 บาท/ครั้ง ตลอด 30 วัน",
    },
    // ── Davines Spa ──
    {
      id: "svc-davines-spa",
      name: "The Davines Ultimate Spa",
      nameTh: "เดอะ ดาวิเนส อัลติเมท สปา",
      category: "Davines Spa",
      description: "6-step premium spa: scalp scrub, shampoo, intensive mask, nano mist steam, relaxing massage, Dyson styling.",
      descriptionTh: "สปาผมพรีเมียม 6 ขั้นตอน: สครับหนังศีรษะ, สระผม, มาส์กเข้มข้น, นาโนมิสต์, นวดผ่อนคลาย, จัดทรงด้วย Dyson",
      memberPrice: 79000, // ฿790
    },
    // ── Hair Color (NIGAO) ──
    {
      id: "svc-color-root-s",
      name: "NIGAO Color — Root Touch-up (≤2 cm)",
      nameTh: "ย้อมสี NIGAO — เติมโคน (ไม่เกิน 2 ซม.)",
      category: "ย้อมผม NIGAO",
      description: "Root touch-up up to 2 cm. Includes wash, blow-dry & styling. 100% ammonia-free.",
      descriptionTh: "เติมโคนไม่เกิน 2 ซม. รวมสระ เป่า จัดทรง สูตรไม่มีแอมโมเนีย",
      advanceBookingRequired: true,
      availableFrom: "11:00",
      availableTo: "16:00",
      memberPrice: 108000, // 10% off ฿1,200
    },
    {
      id: "svc-color-root-l",
      name: "NIGAO Color — Root Touch-up (>2 cm)",
      nameTh: "ย้อมสี NIGAO — เติมโคน (เกิน 2 ซม.)",
      category: "ย้อมผม NIGAO",
      description: "Root touch-up over 2 cm. Includes wash, blow-dry & styling.",
      descriptionTh: "เติมโคนเกิน 2 ซม. รวมสระ เป่า จัดทรง",
      advanceBookingRequired: true,
      availableFrom: "11:00",
      availableTo: "16:00",
      memberPrice: 135000,
    },
    {
      id: "svc-color-s",
      name: "NIGAO Color — S Size (≤5 cm from earlobe)",
      nameTh: "ย้อมสี NIGAO — ขนาด S (ไม่เกิน 5 ซม.จากติ่งหู)",
      category: "ย้อมผม NIGAO",
      description: "Hair length not exceeding 5 cm from earlobe.",
      descriptionTh: "ความยาวผมไม่เกิน 5 ซม. จากติ่งหู",
      advanceBookingRequired: true,
      availableFrom: "11:00",
      availableTo: "16:00",
      memberPrice: 144000,
    },
    {
      id: "svc-color-m",
      name: "NIGAO Color — M Size (≤20 cm from earlobe)",
      nameTh: "ย้อมสี NIGAO — ขนาด M (ไม่เกิน 20 ซม.จากติ่งหู)",
      category: "ย้อมผม NIGAO",
      description: "Hair length not exceeding 20 cm from earlobe.",
      descriptionTh: "ความยาวผมไม่เกิน 20 ซม. จากติ่งหู",
      advanceBookingRequired: true,
      availableFrom: "11:00",
      availableTo: "16:00",
      memberPrice: 180000,
    },
    {
      id: "svc-color-l",
      name: "NIGAO Color — L Size (≤30 cm from earlobe)",
      nameTh: "ย้อมสี NIGAO — ขนาด L (ไม่เกิน 30 ซม.จากติ่งหู)",
      category: "ย้อมผม NIGAO",
      description: "Hair length not exceeding 30 cm from earlobe.",
      descriptionTh: "ความยาวผมไม่เกิน 30 ซม. จากติ่งหู",
      advanceBookingRequired: true,
      availableFrom: "11:00",
      availableTo: "16:00",
      memberPrice: 225000,
    },
    {
      id: "svc-color-xl",
      name: "NIGAO Color — XL Size (≤40 cm from earlobe)",
      nameTh: "ย้อมสี NIGAO — ขนาด XL (ไม่เกิน 40 ซม.จากติ่งหู)",
      category: "ย้อมผม NIGAO",
      description: "Hair length not exceeding 40 cm from earlobe.",
      descriptionTh: "ความยาวผมไม่เกิน 40 ซม. จากติ่งหู",
      advanceBookingRequired: true,
      availableFrom: "11:00",
      availableTo: "16:00",
      memberPrice: 288000,
    },
    {
      id: "svc-color-xxl",
      name: "NIGAO Color — XXL Size (>40 cm from earlobe)",
      nameTh: "ย้อมสี NIGAO — ขนาด XXL (เกิน 40 ซม.จากติ่งหู)",
      category: "ย้อมผม NIGAO",
      description: "Hair length exceeding 40 cm from earlobe.",
      descriptionTh: "ความยาวผมเกิน 40 ซม. จากติ่งหู",
      advanceBookingRequired: true,
      availableFrom: "11:00",
      availableTo: "16:00",
      memberPrice: 315000,
    },
  ];

  for (const s of serviceData) {
    await prisma.service.upsert({
      where: { id: s.id },
      update: s,
      create: s,
    });
  }

  // ─── Branch services (price in satang = THB × 100) ───────────────────────
  const branchServiceData = [
    // Walk-in
    { serviceId: "svc-walkin",          price: 35000,  duration: 60  },
    // Packages
    { serviceId: "svc-pkg5",            price: 160000, duration: 60  },
    { serviceId: "svc-buffet",          price: 350000, duration: 60  },
    { serviceId: "svc-member-monthly",  price: 99000,  duration: 60  },
    // Davines Spa
    { serviceId: "svc-davines-spa",     price: 89000,  duration: 90  },
    // NIGAO Color
    { serviceId: "svc-color-root-s",    price: 120000, duration: 90  },
    { serviceId: "svc-color-root-l",    price: 150000, duration: 90  },
    { serviceId: "svc-color-s",         price: 160000, duration: 90  },
    { serviceId: "svc-color-m",         price: 200000, duration: 120 },
    { serviceId: "svc-color-l",         price: 250000, duration: 150 },
    { serviceId: "svc-color-xl",        price: 320000, duration: 180 },
    { serviceId: "svc-color-xxl",       price: 350000, duration: 180 },
  ];

  for (const branch of branches) {
    for (const bs of branchServiceData) {
      await prisma.branchService.upsert({
        where: { branchId_serviceId: { branchId: branch.id, serviceId: bs.serviceId } },
        update: { price: bs.price, duration: bs.duration, isActive: true },
        create: { branchId: branch.id, ...bs },
      });
    }
  }

  // ─── Add-ons ──────────────────────────────────────────────────────────────
  const addonData = [
    { id: "addon-extensions",  name: "Hair Extensions Present",          nameTh: "ผมต่อ",                             price: 10000 },
    { id: "addon-straight",    name: "Straightening / Farah Blow-dry",   nameTh: "หนีบผมตรง / ไดร์ฟาร่า",           price: 10000 },
    { id: "addon-massage10",   name: "Extra Head Massage 10 min",        nameTh: "นวดศีรษะเพิ่ม 10 นาที",           price: 10000 },
    { id: "addon-scrub",       name: "Davines Scalp Scrub",              nameTh: "สครับศีรษะ Davines",               price: 20000 },
    { id: "addon-mask",        name: "Davines Mask Treatment",           nameTh: "Davines Mask Treatment",           price: 40000 },
  ];

  for (const a of addonData) {
    await prisma.serviceAddon.upsert({
      where: { id: a.id },
      update: a,
      create: a,
    });
  }

  // ─── Staff ────────────────────────────────────────────────────────────────
  const staffData = [
    { id: "staff-noon", branchId: branch1.id, name: "นุ้น",   role: "Senior Stylist" },
    { id: "staff-beam", branchId: branch1.id, name: "บีม",   role: "Colorist"       },
    { id: "staff-mint", branchId: branch1.id, name: "มิ้นท์", role: "Therapist"      },
    { id: "staff-aim",  branchId: branch2.id, name: "เอม",   role: "Senior Stylist" },
    { id: "staff-fern", branchId: branch2.id, name: "เฟิร์น", role: "Stylist"        },
  ];

  for (const s of staffData) {
    await prisma.staff.upsert({
      where: { id: s.id },
      update: {},
      create: s,
    });
  }

  // ─── Membership tiers ─────────────────────────────────────────────────────
  const tiers = [
    { id: "tier-bronze", name: "Bronze",   nameTh: "บรอนซ์",    minPoints: 0,    discountPercent: 0,  color: "#a78966" },
    { id: "tier-silver", name: "Silver",   nameTh: "ซิลเวอร์",  minPoints: 500,  discountPercent: 5,  color: "#9ca3af" },
    { id: "tier-gold",   name: "Gold",     nameTh: "โกลด์",     minPoints: 1500, discountPercent: 10, color: "#d97706" },
    { id: "tier-plat",   name: "Platinum", nameTh: "แพลทินัม", minPoints: 5000, discountPercent: 15, color: "#6366f1" },
  ];

  for (const t of tiers) {
    await prisma.membershipTier.upsert({
      where: { id: t.id },
      update: {},
      create: t,
    });
  }

  console.log("✓ Seed complete.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
