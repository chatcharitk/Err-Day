/**
 * Online booking start times — shared by the server (availability, AI inbox)
 * and the customer pages, so they always offer the same list.
 *
 * Starts every SLOT_STEP (15) minutes from opening; the last start is
 * LAST_START_BEFORE_CLOSE minutes before closing (21:00 close → 20:15), so a
 * 45-minute wash & blow still finishes by closing. That last time is added
 * even when it falls between the steps.
 */
export const LAST_START_BEFORE_CLOSE = 45;
export const SLOT_STEP = 15;

const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const toTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export function onlineStartTimes(openTime: string, closeTime: string): string[] {
  const open = toMin(openTime);
  const last = toMin(closeTime) - LAST_START_BEFORE_CLOSE;
  const out: string[] = [];
  for (let t = open; t <= last; t += SLOT_STEP) out.push(toTime(t));
  if (last >= open && out[out.length - 1] !== toTime(last)) out.push(toTime(last));
  return out;
}
