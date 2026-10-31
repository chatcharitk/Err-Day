/**
 * Menu posters the AI inbox may attach to a reply (files in public/line/menu).
 * `until` hides a poster after its promotion ends (Bangkok date, inclusive).
 */
export interface MenuImage {
  key: string;
  title: string;
  /** What the poster shows — the AI picks posters from this. */
  about: string;
  until?: string;
}

export const MENU_IMAGES: readonly MenuImage[] = [
  { key: "price-list", title: "ราคาค่าบริการ + Add-on", about: "general price list: walk-in สระไดร์ 350, 5-visit pack 1,600 (90 days, shareable with friends/family), buffet 3,500/30 days (once a day), membership 990/month then 100 per visit, plus add-ons" },
  { key: "davines-spa", title: "The Davines Ultimate Spa", about: "Davines Ultimate Spa 890 (member 790), the 6 steps and the scrub/shampoo/mask options" },
  { key: "davines-keratin", title: "Davines Keratin Treatment", about: "Davines keratin treatment prices by hair length S/M/L, member 10% off; very long or thick hair may cost 400 more" },
  { key: "nigao-color", title: "ทำสีผม NIGAO", about: "NIGAO ammonia-free hair colour prices: root touch-up and sizes S–XXL, member 10% off; natural tones only, no bleach/highlights; very thick hair may cost more" },
  { key: "opening-hours", title: "เวลาเปิด-ปิด", about: "opening hours: Sukhumvit 70/3 Mon–Sat 8:00–21:00, Sun 10:00–21:00; Bangna (opposite Mega Bangna) every day 7:00–21:00" },
  { key: "pjoli", title: "PJOLI Feel Easy Treatment", about: "PJOLI treatment: 990 baht, member 890 baht (no promotion)" },
];

export function menuImagesOn(today: string): MenuImage[] {
  return MENU_IMAGES.filter(m => !m.until || m.until >= today);
}

const APP_HOST = process.env.NEXT_PUBLIC_APP_URL ?? "https://book.err-daysalon.com";

export function menuImageUrls(key: string) {
  return { original: `${APP_HOST}/line/menu/${key}.jpg`, preview: `${APP_HOST}/line/menu/${key}-preview.jpg` };
}
