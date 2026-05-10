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
      })
      .catch(err => console.error("LIFF init failed:", err))
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
