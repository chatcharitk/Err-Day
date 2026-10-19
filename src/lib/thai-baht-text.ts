/** Thai reading of an amount, e.g. 5760 → "ห้าพันเจ็ดร้อยหกสิบบาทถ้วน". Input in satang. */
const DIGIT = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
const PLACE = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"];

/** 0 ≤ n < 1,000,000 */
function below1m(n: number): string {
  const s = String(n);
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const d = Number(s[i]);
    const pos = s.length - 1 - i;
    if (d === 0) continue;
    if (pos === 0 && d === 1 && s.length > 1) out += "เอ็ด";
    else if (pos === 1 && d === 2) out += "ยี่สิบ";
    else if (pos === 1 && d === 1) out += "สิบ";
    else out += DIGIT[d] + PLACE[pos];
  }
  return out;
}

function integerText(n: number): string {
  if (n === 0) return DIGIT[0];
  const millions = Math.floor(n / 1_000_000);
  const rest = n % 1_000_000;
  return (millions > 0 ? integerText(millions) + "ล้าน" : "") + (rest > 0 ? below1m(rest) : "");
}

export function thaiBahtText(satang: number): string {
  const baht = Math.floor(satang / 100);
  const st = satang % 100;
  return integerText(baht) + "บาท" + (st === 0 ? "ถ้วน" : below1m(st) + "สตางค์");
}
