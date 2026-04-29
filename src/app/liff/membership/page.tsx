"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Membership status has moved to การจองของฉัน (/my-bookings).
 * Redirect anyone who lands here.
 */
export default function LiffMembershipRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/my-bookings");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#FDF7F2" }}>
      <div className="text-center">
        <div
          className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin mx-auto mb-3"
          style={{ borderColor: "#E8D8CC", borderTopColor: "#8B1D24" }}
        />
        <p className="text-sm" style={{ color: "#A08070" }}>กำลังโหลด...</p>
      </div>
    </div>
  );
}
