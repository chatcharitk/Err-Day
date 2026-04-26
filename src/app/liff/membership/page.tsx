"use client";

import { useEffect, useState } from "react";
import { CreditCard, Clock, Zap, CheckCircle2, XCircle } from "lucide-react";

interface MembershipStatus {
  customerName:   string;
  tier:           { name: string; nameTh: string; color: string; discountPercent: number };
  points:         number;
  activatedAt:    string;
  expiresAt:      string | null;
  usagesUsed:     number;
  usagesAllowed:  number; // 0 = use tier.maxUsages
  tierMaxUsages:  number; // 0 = unlimited
  isExpired:      boolean;
  isUsagesExhausted: boolean;
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#FDF7F2" }}>
      <div className="text-center">
        <div className="w-12 h-12 rounded-full border-4 border-t-transparent animate-spin mx-auto mb-4"
          style={{ borderColor: "#E8D8CC", borderTopColor: "#8B1D24" }} />
        <p className="text-sm" style={{ color: "#A08070" }}>กำลังโหลดข้อมูล...</p>
      </div>
    </div>
  );
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "#FDF7F2" }}>
      <div className="text-center max-w-sm">
        <XCircle className="w-12 h-12 mx-auto mb-3" style={{ color: "#8B1D24" }} />
        <p className="font-semibold mb-1" style={{ color: "#3B2A24" }}>ไม่พบข้อมูล</p>
        <p className="text-sm" style={{ color: "#A08070" }}>{message}</p>
      </div>
    </div>
  );
}

export default function LiffMembershipPage() {
  const [status, setStatus]   = useState<MembershipStatus | null>(null);
  const [error,  setError]    = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get lineUserId from URL params (set when opening from Line rich menu / LIFF)
    const params    = new URLSearchParams(window.location.search);
    const lineUserId = params.get("lineUserId");

    if (!lineUserId) {
      // Try initialising LIFF to get the ID automatically
      import("@line/liff").then(async ({ default: liff }) => {
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID!;
        await liff.init({ liffId });
        if (!liff.isLoggedIn()) {
          liff.login({ redirectUri: window.location.href });
          return;
        }
        const profile = await liff.getProfile();
        fetchStatus(profile.userId);
      }).catch(() => {
        setError("กรุณาเปิดหน้านี้ผ่าน Line");
        setLoading(false);
      });
    } else {
      fetchStatus(lineUserId);
    }

    async function fetchStatus(uid: string) {
      try {
        const res = await fetch(`/api/liff/membership?lineUserId=${encodeURIComponent(uid)}`);
        if (!res.ok) {
          const data = await res.json();
          setError(data.error ?? "ไม่พบข้อมูลสมาชิก");
        } else {
          setStatus(await res.json());
        }
      } catch {
        setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
      } finally {
        setLoading(false);
      }
    }
  }, []);

  if (loading) return <LoadingScreen />;
  if (error)   return <ErrorScreen message={error} />;
  if (!status) return null;

  const { tier, isExpired, isUsagesExhausted } = status;
  const isActive = !isExpired && !isUsagesExhausted;

  const expiresDate = status.expiresAt
    ? new Date(status.expiresAt).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })
    : null;

  const activatedDate = new Date(status.activatedAt).toLocaleDateString("th-TH", {
    day: "numeric", month: "long", year: "numeric",
  });

  const effectiveMax = status.usagesAllowed > 0
    ? status.usagesAllowed
    : status.tierMaxUsages;  // 0 means unlimited

  const usagesLeft = effectiveMax > 0
    ? Math.max(0, effectiveMax - status.usagesUsed)
    : null; // null = unlimited

  return (
    <div className="min-h-screen pb-12" style={{ background: "#FDF7F2" }}>
      {/* Header */}
      <div className="px-6 pt-8 pb-6 text-center" style={{ background: "#3B2A24" }}>
        <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>
          err.day salon
        </p>
        <h1 className="text-xl font-semibold text-white">สถานะสมาชิก</h1>
        <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.7)" }}>{status.customerName}</p>
      </div>

      <div className="px-5 py-6 space-y-4 max-w-sm mx-auto">
        {/* Tier card */}
        <div
          className="rounded-2xl p-5 text-center shadow-sm"
          style={{
            background: `linear-gradient(135deg, ${tier.color}22, ${tier.color}11)`,
            border: `2px solid ${tier.color}44`,
          }}
        >
          <CreditCard className="w-10 h-10 mx-auto mb-2" style={{ color: tier.color }} />
          <p className="text-2xl font-bold" style={{ color: tier.color }}>{tier.nameTh}</p>
          <p className="text-sm mt-1" style={{ color: "#6B5245" }}>{tier.name} Membership</p>

          {/* Active / expired badge */}
          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium"
            style={
              isActive
                ? { background: "#ECFDF5", color: "#065F46" }
                : { background: "#FEF2F2", color: "#991B1B" }
            }
          >
            {isActive ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
            {isExpired ? "หมดอายุแล้ว" : isUsagesExhausted ? "ใช้ครบแล้ว" : "ใช้งานได้"}
          </div>
        </div>

        {/* Discount */}
        <div className="rounded-2xl p-4 bg-white shadow-sm" style={{ border: "1.5px solid #E8D8CC" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "#FFF8E8" }}>
              <Zap className="w-5 h-5" style={{ color: "#B45309" }} />
            </div>
            <div>
              <p className="text-xs" style={{ color: "#A08070" }}>ส่วนลดสมาชิก</p>
              <p className="text-xl font-bold" style={{ color: "#B45309" }}>
                {tier.discountPercent}%
              </p>
            </div>
          </div>
        </div>

        {/* Usage */}
        <div className="rounded-2xl p-4 bg-white shadow-sm" style={{ border: "1.5px solid #E8D8CC" }}>
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#8B1D24" }}>
            การใช้สิทธิ์
          </p>
          {usagesLeft === null ? (
            <p className="text-sm" style={{ color: "#3B2A24" }}>
              ใช้แล้ว <strong>{status.usagesUsed}</strong> ครั้ง &nbsp;·&nbsp; ไม่จำกัดครั้ง
            </p>
          ) : (
            <>
              <div className="flex justify-between text-sm mb-2">
                <span style={{ color: "#6B5245" }}>ใช้แล้ว {status.usagesUsed} / {effectiveMax} ครั้ง</span>
                <span style={{ color: "#8B1D24" }}>เหลือ {usagesLeft} ครั้ง</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: "#F0E4D8" }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, (status.usagesUsed / effectiveMax) * 100)}%`,
                    background: usagesLeft === 0 ? "#EF4444" : "#8B1D24",
                  }}
                />
              </div>
            </>
          )}
        </div>

        {/* Dates */}
        <div className="rounded-2xl p-4 bg-white shadow-sm" style={{ border: "1.5px solid #E8D8CC" }}>
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#8B1D24" }}>
            วันที่
          </p>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2" style={{ color: "#A08070" }}>
                <Clock size={13} />วันที่เริ่มต้น
              </span>
              <span style={{ color: "#3B2A24" }}>{activatedDate}</span>
            </div>
            {expiresDate && (
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2" style={{ color: isExpired ? "#991B1B" : "#A08070" }}>
                  <Clock size={13} />วันหมดอายุ
                </span>
                <span style={{ color: isExpired ? "#991B1B" : "#3B2A24" }}>{expiresDate}</span>
              </div>
            )}
          </div>
        </div>

        {/* Points */}
        <div className="rounded-2xl p-4 bg-white shadow-sm" style={{ border: "1.5px solid #E8D8CC" }}>
          <div className="flex items-center justify-between">
            <p className="text-sm" style={{ color: "#6B5245" }}>แต้มสะสม</p>
            <p className="text-xl font-bold" style={{ color: "#8B1D24" }}>
              {status.points.toLocaleString()} pts
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
