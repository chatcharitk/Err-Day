/**
 * Seasonal skins for the customer-facing app. Each season is an inclusive
 * range of Bangkok calendar dates; outside every range the normal theme shows.
 * To run a season again, add a new row — nothing else needs to change.
 */
export type SeasonalTheme = "halloween";

const SEASONS: Array<{ theme: SeasonalTheme; from: string; to: string }> = [
  { theme: "halloween", from: "2026-09-30", to: "2026-10-31" },
];

const bangkokDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" });

/** The seasonal theme in effect at `now` (Asia/Bangkok), or null for normal. */
export function seasonalThemeAt(now: Date): SeasonalTheme | null {
  const today = bangkokDate.format(now); // "YYYY-MM-DD" — compares lexically
  return SEASONS.find((s) => today >= s.from && today <= s.to)?.theme ?? null;
}

export function isSeasonalTheme(value: string | null): value is SeasonalTheme {
  return SEASONS.some((s) => s.theme === value);
}

/**
 * Public path of a tarot card image. `file` is the normal PNG name in
 * public/tarot/ (e.g. "The-Star.png"); the Halloween deck lives in
 * public/tarot/halloween/ as JPEGs (LINE Flex accepts only JPEG/PNG) under the
 * same basenames, with spaces hyphenated. Being a different URL, LINE's
 * aggressive image cache can't serve the old art during the season.
 */
export function tarotImagePath(file: string, theme: SeasonalTheme | null): string {
  if (theme !== "halloween") return `/tarot/${file}`;
  return `/tarot/halloween/${file.replace(/\.png$/i, ".jpg").replace(/ /g, "-")}`;
}
