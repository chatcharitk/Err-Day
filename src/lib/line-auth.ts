const LINE_PROFILE_ENDPOINT = "https://api.line.me/v2/profile";

export interface VerifiedLineProfile {
  userId: string;
  displayName?: string;
  pictureUrl?: string;
}

export async function verifyLineAccessToken(accessToken: unknown): Promise<VerifiedLineProfile | null> {
  if (typeof accessToken !== "string" || !accessToken) return null;

  const response = await fetch(LINE_PROFILE_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  }).catch(() => null);
  if (!response?.ok) return null;

  const profile = await response.json() as Partial<VerifiedLineProfile>;
  return typeof profile.userId === "string" && profile.userId ? profile as VerifiedLineProfile : null;
}
