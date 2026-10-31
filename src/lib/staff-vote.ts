/**
 * Customer voting for staff — the Halloween Staff Challenge 2026.
 * One event = one `key`; VoteCandidate / StaffVote rows carry it, so the next
 * campaign only needs a new constant here.
 */
export const VOTE_EVENT = {
  key: "halloween-2026",
  titleTh: "Halloween Staff Challenge",
  /** Inclusive Bangkok days voting is open (poster said 18–31 ต.ค.; opened a day early on 17 ต.ค. 2569). */
  from: "2026-10-17",
  to: "2026-10-30",
} as const;

/** Poster prizes (บาท) by rank; ranks 4+ get the participation bonus. */
export const VOTE_PRIZES = [1500, 1000, 500] as const;
export const PARTICIPATION_BONUS = 300;
/** Votes a staff member needs to receive the participation bonus. */
export const PARTICIPATION_MIN_VOTES = 20;

const bangkokDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" });

/** Today's Bangkok calendar day, "YYYY-MM-DD" — the key for one vote per day. */
export function voteDayAt(now: Date = new Date()): string {
  return bangkokDay.format(now);
}

export type VotePhase = "upcoming" | "open" | "closed";

export function votePhaseAt(now: Date = new Date()): VotePhase {
  const today = bangkokDay.format(now); // "YYYY-MM-DD" — compares lexically
  if (today < VOTE_EVENT.from) return "upcoming";
  if (today > VOTE_EVENT.to) return "closed";
  return "open";
}

/** Placeholder letter for a candidate with no photo — skips Thai leading vowels (เ แ โ ใ ไ) so "เบญ" shows บ, not a lone vowel. */
export function candidateInitial(name: string): string {
  const stripped = name.trim().replace(/^[เแโใไ]+/, "");
  return Array.from(stripped || name.trim())[0] ?? "?";
}
