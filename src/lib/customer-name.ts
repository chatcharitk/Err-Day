/**
 * How a customer is shown on lists: "ชื่อเล่น · ชื่อจริง" (e.g. "บิว · ศุภิสรา").
 * nickname = the nickname only; name = real first name + surname (or the
 * nickname again when the real name isn't known). Lists show the first name
 * only; detail pages show the full name.
 */
export function customerLabel(c: { name?: string | null; nickname?: string | null }): string {
  const nick = c.nickname?.trim() ?? "";
  const name = c.name?.trim() ?? "";
  if (!nick) return name;
  if (!name || name === nick) return nick;
  // Legacy rows not cleaned yet ("บิว ศุภิสรา" in both fields, or name that starts with the nickname).
  if (name.startsWith(nick)) return name;
  if (nick.startsWith(name)) return nick;
  return `${nick} · ${name.split(/\s+/)[0]}`;
}

// ── Name cleanup (Oct 2026) ─────────────────────────────────────────────────
// Staff used to type "ชื่อเล่น ชื่อจริง" into the nickname and "ชื่อเล่น ชื่อจริง นามสกุล"
// into the name, plus notes ("สมาชิก หมด 18 พค", "walk in"). This splits them.

const NOTE_WORDS = /^(walk-?in|walkin|วอคอิน|วอล์คอิน|influencer|อินฟลู\S*|ผมต่อ|ทรีทเม้นต์|เทสระบบ|test|ลบออก|academy|สก|\d+)$/i;
const TAIL_NOTE = /(^|\s)(สมาชิก|หมดอายุ|หมด\s*\d|\d+\s*ครั้ง).*$/;
const thai = (s: string) => /[฀-๿]/.test(s);

/** Split notes out of a name field: returns the remaining words and the note text. */
export function stripNameNotes(raw: string): { words: string[]; note: string } {
  const notes: string[] = [];
  let s = raw.replace(/\(([^)]*)\)/g, (_, x) => { notes.push(`(${x.trim()})`); return " "; });
  s = s.replace(/\(.*$/, (m) => { if (m.trim() !== "(") notes.push(m.trim()); return " "; });   // unclosed bracket
  s = s.replace(TAIL_NOTE, (m) => { notes.push(m.trim()); return " "; });
  const words: string[] = [];
  const toks = s.trim().split(/\s+/).filter(Boolean);
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (/^walk$/i.test(t) && /^in$/i.test(toks[i + 1] ?? "")) { notes.push(`${t} ${toks[i + 1]}`); i++; continue; }
    if (i > 0 && NOTE_WORDS.test(t)) { notes.push(t); continue; }
    words.push(t);
  }
  return { words, note: notes.join(" ") };
}

export type NameFix = {
  /** auto = safe to apply; keep = already fine (maybe notes to move); review = a person should check */
  action: "auto" | "keep" | "review";
  reason: string;
  nickname: string | null;
  name: string;
  /** Text moved out of the name/nickname into the customer's notes. */
  note: string;
};

/** A first word this long is usually a real first name, not a nickname; descriptions ("เพื่อน…", "ชื่อ…") need a person. */
const looksLikeRealFirstName = (w: string) => w.length >= 8;
const descriptive = (words: string[]) => words.some(w => /^(เพื่อน|ญาติ|ชื่อ)/.test(w));

export function suggestNameFix(c: { name: string; nickname: string | null }): NameFix {
  const fix = suggestNameFixRaw(c);
  if (fix.action === "auto" && (looksLikeRealFirstName(fix.nickname ?? "") || descriptive([fix.nickname ?? "", ...fix.name.split(" ")]))) {
    return { ...fix, action: "review", reason: fix.nickname && looksLikeRealFirstName(fix.nickname) ? "คำแรกยาว อาจเป็นชื่อจริง ไม่ใช่ชื่อเล่น" : "เป็นคำอธิบาย ไม่ใช่ชื่อ" };
  }
  return fix;
}

function suggestNameFixRaw(c: { name: string; nickname: string | null }): NameFix {
  const N = stripNameNotes(c.name);
  const K = stripNameNotes(c.nickname ?? "");
  const note = [N.note, (c.nickname ?? "").trim() !== c.name.trim() ? K.note : ""].filter(Boolean).join(" ");
  const n = N.words, k = K.words;
  const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
  const startsWith = (a: string[], b: string[]) => b.length > 0 && b.every((x, i) => a[i] === x);
  const keepNick = k.join(" ") || null;

  if (!n.length && !k.length) return { action: "review", reason: "ชื่อมีแต่หมายเหตุ", nickname: null, name: c.name.trim(), note };
  if (!n.length) return { action: "review", reason: "ชื่อมีแต่หมายเหตุ", nickname: keepNick, name: keepNick ?? "", note };
  if (!k.length) {
    if (n.length === 1) return { action: "keep", reason: "ชื่อคำเดียว", nickname: null, name: n[0], note };
    return { action: "review", reason: "ไม่มีชื่อเล่น — ไม่แน่ใจว่าคำแรกคือชื่อเล่น", nickname: n[0], name: n.slice(1).join(" "), note };
  }
  if (same(n, k)) {
    if (k.length === 1) return { action: "keep", reason: "รู้แค่ชื่อเล่น", nickname: k[0], name: k[0], note };
    if (thai(k[0])) return { action: "auto", reason: "ชื่อเล่น+ชื่อจริงอยู่ในทั้งสองช่อง", nickname: k[0], name: k.slice(1).join(" "), note };
    return { action: "review", reason: "ชื่ออังกฤษเหมือนกันทั้งสองช่อง", nickname: k[0], name: k.slice(1).join(" "), note };
  }
  if (startsWith(n, k) && n.length > k.length) {
    if (!thai(k[0])) return { action: "review", reason: "ชื่ออังกฤษ — คำแรกอาจเป็นชื่อจริง", nickname: k[0], name: n.slice(1).join(" "), note };
    // nickname "บิว" or "บิว ศุภิสรา", name "บิว ศุภิสรา สุขใจ"
    return { action: "auto", reason: "ชื่อขึ้นต้นด้วยชื่อเล่น", nickname: k[0], name: n.slice(1).join(" "), note };
  }
  if (k.length === 1 && !n.includes(k[0])) return { action: "keep", reason: "แยกถูกแล้ว", nickname: k[0], name: n.join(" "), note };
  return { action: "review", reason: "ชื่อกับชื่อเล่นไม่ตรงกัน", nickname: k[0], name: n.join(" "), note };
}
