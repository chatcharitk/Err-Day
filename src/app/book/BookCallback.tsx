"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MapPin, ArrowRight } from "lucide-react";
import { useLiff } from "@/hooks/useLiff";

interface Branch {
  id: string;
  name: string;
  address: string;
}

const RETURN_KEY = "liff_return_to";

export default function BookCallback({ branches }: { branches: Branch[] }) {
  const router = useRouter();
  const liff   = useLiff();
  const [showBranches, setShowBranches] = useState(false);

  // Once LIFF has finished initializing, decide where to send the user.
  useEffect(() => {
    if (!liff.ready) return;

    // If a return URL was saved before login, send the user back there.
    try {
      const returnTo = sessionStorage.getItem(RETURN_KEY);
      if (returnTo) {
        sessionStorage.removeItem(RETURN_KEY);
        router.replace(returnTo);
        return;
      }
    } catch { /* ignore */ }

    // Otherwise show the branch picker.
    setShowBranches(true);
  }, [liff.ready, router]);

  // Loading state while LIFF initializes / redirect is happening
  if (!showBranches) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#FDF8F3" }}>
        <div className="text-center">
          <div className="w-10 h-10 border-4 rounded-full animate-spin mx-auto mb-4" style={{ borderColor: "#E8D8CC", borderTopColor: "#8B1D24" }} />
          <p className="text-sm" style={{ color: "#A08070" }}>กำลังเข้าสู่ระบบ...</p>
        </div>
      </div>
    );
  }

  // Branch picker
  return (
    <main className="min-h-screen" style={{ background: "#FDF8F3" }}>
      <div className="max-w-lg mx-auto px-6 py-12">
        <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "#A08070" }}>Choose Branch</p>
        <h1 className="text-2xl font-medium mb-8" style={{ color: "#3B2A24" }}>เลือกสาขาที่ต้องการจอง</h1>

        {liff.isLoggedIn && liff.profile && (
          <div className="mb-6 rounded-xl border p-4 flex items-center gap-3" style={{ borderColor: "#BBF7D0", background: "#F0FFF4" }}>
            {liff.profile.pictureUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={liff.profile.pictureUrl} alt="" className="w-9 h-9 rounded-full" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium" style={{ color: "#3B2A24" }}>{liff.profile.displayName}</p>
              <p className="text-xs" style={{ color: "#166534" }}>เข้าสู่ระบบด้วย Line แล้ว</p>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {branches.map(b => (
            <Link
              key={b.id}
              href={`/book/${b.id}`}
              className="block rounded-2xl bg-white p-5 transition-all hover:shadow-md"
              style={{ border: "1.5px solid #E8D8CC" }}
            >
              <div className="flex items-center gap-4">
                <MapPin className="w-5 h-5 flex-shrink-0" style={{ color: "#8B1D24" }} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm" style={{ color: "#3B2A24" }}>{b.name}</p>
                  <p className="text-xs mt-0.5 truncate" style={{ color: "#A08070" }}>{b.address}</p>
                </div>
                <ArrowRight className="w-4 h-4 flex-shrink-0" style={{ color: "#D6BCAE" }} />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
