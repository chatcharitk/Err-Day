"use client";

import { useEffect, useState } from "react";
import { Clock, CheckCircle2, XCircle, Tag } from "lucide-react";

interface ServiceDiscount {
  id:                    string;
  nameTh:                string;
  memberDiscountPercent: number;
  basePrice:             number | null;
}

interface MembershipStatus {
  customerName:      string;
  label:             string;
  points:            number;
  activatedAt:       string;
  expiresAt:         string | null;
  usagesUsed:        number;
  usagesAllowed:     number;
  isExpired:         boolean;
  isUsagesExhausted: boolean;
  services:          ServiceDiscount[];
}

function fmt(satang: number) {
  return `฿${(satang / 100).toLocaleString("th-TH")}`;
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
  const [status,  setStatus]  = useState<MembershipStatus | null>(null);
  const [error,   setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params     = new URLSearchParams(window.location.search);
    const lineUserId = params.get("lineUserId");

    if (!lineUserId) {
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
          setError((await res.json()).error ?? "ไม่พบข้อมูลสมาชิก");
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

  const { isExpired, isUsagesExhausted } = status;
  const isActive = !isExpired && !isUsagesExhausted;

  const expiresDate = status.expiresAt
    ? new Date(status.expiresAt).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })
    : null;

  const activatedDate = new Date(status.activatedAt).toLocaleDateString("th-TH", {
    day: "numeric", month: "long", year: "numeric",
  });

  const usagesLeft = status.usagesAllowed > 0
    ? Math.max(0, status.usagesAllowed - status.usagesUsed)
    : null;

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
        {/* Status card */}
        <div
          className="rounded-2xl p-5 shadow-sm"
          style={{
            background: isActive ? "#ECFDF5" : "#FEF2F2",
            border: `2px solid ${isActive ? "#BBF7D0" : "#FECACA"}`,
          }}
        >
          <div className="flex items-center gap-3 mb-4">
            {isActive
              ? <CheckCircle2 className="w-8 h-8 flex-shrink-0" style={{ color: "#059669" }} />
              : <XCircle     className="w-8 h-8 flex-shrink-0" style={{ color: "#DC2626" }} />
            }
            <div>
              <p className="font-bold text-lg" style={{ color: isActive ? "#065F46" : "#991B1B" }}>
                {status.label}
              </p>
              <p className="text-sm font-medium" style={{ color: isActive ? "#059669" : "#DC2626" }}>
                {isExpired ? "สมาชิกหมดอายุ" : isUsagesExhausted ? "ใช้สิทธิ์ครบแล้ว" : "ใช้งานได้"}
              </p>
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span style={{ color: "#6B5245" }} className="flex items-center gap-1.5">
                <Clock size={13} /> วันที่เริ่มต้น
              </span>
              <span style={{ color: "#3B2A24" }}>{activatedDate}</span>
            </div>
            {expiresDate && (
              <div className="flex justify-between">
                <span style={{ color: "#6B5245" }} className="flex items-center gap-1.5">
                  <Clock size={13} /> วันหมดอายุ
                </span>
                <span style={{ color: isExpired ? "#DC2626" : "#3B2A24", fontWeight: isExpired ? 600 : 400 }}>
                  {expiresDate}
                </span>
              </div>
            )}
            {!expiresDate && (
              <div className="flex justify-between">
                <span style={{ color: "#6B5245" }}>วันหมดอายุ</span>
                <span style={{ color: "#059669", fontWeight: 600 }}>ไม่หมดอายุ</span>
              </div>
            )}
            {usagesLeft !== null ? (
              <div className="flex justify-between">
                <span style={{ color: "#6B5245" }}>สิทธิ์คงเหลือ</span>
                <span style={{ color: usagesLeft === 0 ? "#DC2626" : "#3B2A24", fontWeight: 600 }}>
                  {usagesLeft} / {status.usagesAllowed} ครั้ง
                </span>
              </div>
            ) : (
              <div className="flex justify-between">
                <span style={{ color: "#6B5245" }}>จำนวนครั้ง</span>
                <span style={{ color: "#059669", fontWeight: 600 }}>ไม่จำกัด</span>
              </div>
            )}
            <div className="flex justify-between">
              <span style={{ color: "#6B5245" }}>แต้มสะสม</span>
              <span style={{ color: "#8B1D24", fontWeight: 600 }}>{status.points.toLocaleString()} pts</span>
            </div>
          </div>
        </div>

        {/* Per-service discounts */}
        {status.services.length > 0 && (
          <div className="rounded-2xl bg-white shadow-sm" style={{ border: "1.5px solid #E8D8CC" }}>
            <div className="px-4 pt-4 pb-2 flex items-center gap-2">
              <Tag size={14} style={{ color: "#8B1D24" }} />
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#8B1D24" }}>
                ส่วนลดสำหรับสมาชิก
              </p>
            </div>
            <div className="divide-y" style={{ borderColor: "#F0E4D8" }}>
              {status.services.map(s => {
                const netSatang = s.basePrice
                  ? Math.round(s.basePrice * (1 - s.memberDiscountPercent / 100))
                  : null;
                return (
                  <div key={s.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium" style={{ color: "#3B2A24" }}>{s.nameTh}</p>
                      {s.basePrice && (
                        <p className="text-xs mt-0.5" style={{ color: "#A08070" }}>
                          ปกติ <span style={{ textDecoration: "line-through" }}>{fmt(s.basePrice)}</span>
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold" style={{ color: "#8B1D24" }}>
                        {netSatang ? fmt(netSatang) : `ลด ${s.memberDiscountPercent}%`}
                      </p>
                      <p className="text-xs" style={{ color: "#059669" }}>
                        ลด {s.memberDiscountPercent}%
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
