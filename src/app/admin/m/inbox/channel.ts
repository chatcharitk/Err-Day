/** Display info per chat channel (mobile inbox). */
export const CHANNEL = {
  LINE:      { label: "LINE",      short: "LINE", color: "#06C755", bg: "#E9F9EF" },
  FACEBOOK:  { label: "Facebook",  short: "FB",   color: "#1877F2", bg: "#E7F0FD" },
  INSTAGRAM: { label: "Instagram", short: "IG",   color: "#C13584", bg: "#FBE9F3" },
} as const;

export type ChannelKey = keyof typeof CHANNEL;
export const channelInfo = (c: string) => CHANNEL[(c in CHANNEL ? c : "LINE") as ChannelKey];
