"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Membership signup requires LINE login.
 * Redirect immediately to the LIFF version which enforces LINE auth.
 */
export default function MembershipSignupRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/liff/membership/signup");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#FDF7F2" }}>
      <div className="text-center">
        <div
          className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin mx-auto mb-3"
          style={{ borderColor: "#E8D8CC", borderTopColor: "#8B1D24" }}
        />
        <p className="text-sm" style={{ color: "#A08070" }}>กำลังเปิด LINE...</p>
      </div>
    </div>
  );
}
