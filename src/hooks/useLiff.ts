"use client";

import { useEffect, useState, useCallback } from "react";

export interface LiffProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  email?: string;
}

export interface LiffState {
  ready:      boolean;   // LIFF SDK finished initializing
  isLoggedIn: boolean;   // user is authenticated with Line
  isInClient: boolean;   // opened inside the Line app
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
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
    if (!liffId) { setReady(true); return; }

    import("@line/liff").then(async ({ default: liff }) => {
      try {
        await liff.init({ liffId });
        setIsInClient(liff.isInClient());

        if (liff.isLoggedIn()) {
          setIsLoggedIn(true);
          const p     = await liff.getProfile();
          const token = liff.getDecodedIDToken();
          setProfile({
            userId:      p.userId,
            displayName: p.displayName,
            pictureUrl:  p.pictureUrl,
            email:       token?.email ?? undefined,
          });
        }
      } catch (err) {
        console.error("LIFF init failed:", err);
      } finally {
        setReady(true);
      }
    });
  }, []);

  const login = useCallback(() => {
    import("@line/liff").then(({ default: liff }) => {
      liff.login({ redirectUri: window.location.href });
    });
  }, []);

  const logout = useCallback(() => {
    import("@line/liff").then(({ default: liff }) => {
      liff.logout();
      setIsLoggedIn(false);
      setProfile(null);
    });
  }, []);

  return { ready, isLoggedIn, isInClient, profile, login, logout };
}
