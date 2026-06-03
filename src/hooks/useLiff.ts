"use client";

import { useEffect, useState, useCallback } from "react";
import { getLiff } from "@/lib/liff-client";

export interface LiffProfile {
  userId:      string;
  displayName: string;
  pictureUrl?: string;
  email?:      string;
}

export interface LiffState {
  ready:      boolean;   // LIFF SDK finished initializing
  isLoggedIn: boolean;   // user is authenticated with LINE
  isInClient: boolean;   // opened inside the LINE app
  profile:    LiffProfile | null;
  login:      () => void;
  logout:     () => void;
}

export function useLiff(): LiffState {
  const [ready,      setReady]      = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isInClient, setIsInClient] = useState(false);
  const [profile,    setProfile]    = useState<LiffProfile | null>(null);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_LIFF_ID) { setReady(true); return; }

    getLiff()
      .then(async (liff) => {
        setIsInClient(liff.isInClient());

        if (!liff.isLoggedIn()) return;

        // getProfile() needs the `profile` scope — this is the call that matters
        // (gives us userId + displayName). If it fails we are effectively NOT
        // usable as a logged-in user, so leave isLoggedIn false.
        const p = await liff.getProfile();

        // Email is BEST-EFFORT: getDecodedIDToken() throws when the `openid`
        // scope wasn't granted. Never let that discard the profile we just got —
        // doing so left profile=null and broke booking/registration/my-bookings.
        let email: string | undefined;
        try {
          email = liff.getDecodedIDToken()?.email ?? undefined;
        } catch {
          /* no openid/email scope — fine, continue without email */
        }

        setProfile({
          userId:      p.userId,
          displayName: p.displayName,
          pictureUrl:  p.pictureUrl,
          email,
        });
        setIsLoggedIn(true);
      })
      .catch(err => console.error("LIFF init/profile failed:", err))
      .finally(() => setReady(true));
  }, []);

  const login = useCallback(() => {
    getLiff().then(liff => liff.login({ redirectUri: window.location.href }));
  }, []);

  const logout = useCallback(() => {
    getLiff().then(liff => {
      liff.logout();
      setIsLoggedIn(false);
      setProfile(null);
    });
  }, []);

  return { ready, isLoggedIn, isInClient, profile, login, logout };
}
