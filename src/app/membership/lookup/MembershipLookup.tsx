"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Star, Search, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { MembershipTier } from "@/generated/prisma/client";

interface CustomerWithMembership {
  id: string;
  name: string;
  phone: string;
  membership: {
    points: number;
    tier: MembershipTier;
  } | null;
  bookings: {
    id: string;
    date: string;
    service: { name: string };
    branch: { name: string };
  }[];
}

interface Props {
  tiers: MembershipTier[];
}

function ProgressBar({ points, tiers }: { points: number; tiers: MembershipTier[] }) {
  const sorted = [...tiers].sort((a, b) => a.minPoints - b.minPoints);
  const maxTier = sorted[sorted.length - 1];
  const currentTierIdx = sorted.findLastIndex((t) => points >= t.minPoints);
  const nextTier = sorted[currentTierIdx + 1];

  const progressMax = nextTier ? nextTier.minPoints : maxTier.minPoints;
  const progressMin = sorted[currentTierIdx]?.minPoints ?? 0;
  const pct = nextTier
    ? Math.min(100, ((points - progressMin) / (progressMax - progressMin)) * 100)
    : 100;

  return (
    <div className="mt-4">
      <div className="flex justify-between text-xs text-stone-400 mb-1">
        <span>{points.toLocaleString()} คะแนน</span>
        {nextTier && <span>อีก {(nextTier.minPoints - points).toLocaleString()} คะแนนถึง {nextTier.nameTh}</span>}
      </div>
      <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: sorted[currentTierIdx]?.color ?? "#6b7280" }}
        />
      </div>
    </div>
  );
}

export default function MembershipLookup({ tiers }: Props) {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [customer, setCustomer] = useState<CustomerWithMembership | null>(null);

  const handleLookup = async () => {
    if (!phone.trim()) return;
    setLoading(true);
    setError("");
    setCustomer(null);

    const res = await fetch(`/api/membership?phone=${encodeURIComponent(phone.trim())}`);
    if (res.status === 404) {
      setError("ไม่พบสมาชิก — หมายเลขโทรศัพท์นี้ยังไม่ได้สมัครสมาชิก");
    } else if (!res.ok) {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } else {
      const data = await res.json();
      if (!data.membership) {
        setError("ลูกค้าคนนี้ยังไม่ได้เปิดใช้สมาชิก");
      } else {
        setCustomer(data);
      }
    }
    setLoading(false);
  };

  const sorted = [...tiers].sort((a, b) => a.minPoints - b.minPoints);

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Top bar */}
      <div className="bg-white border-b border-stone-200 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link href="/" className="text-stone-400 hover:text-stone-700 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-widest">Membership</p>
            <h1 className="text-base font-medium text-stone-900">สมาชิก err.day</h1>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Lookup form */}
        <Card className="border-stone-200 mb-8">
          <CardContent className="pt-6">
            <h2 className="text-lg font-medium text-stone-900 mb-1">ตรวจสอบสถานะสมาชิก</h2>
            <p className="text-stone-400 text-sm mb-4">Check Membership Status — กรอกเบอร์โทรศัพท์ของคุณ</p>
            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <Label htmlFor="phone-lookup">เบอร์โทรศัพท์</Label>
                <Input
                  id="phone-lookup"
                  type="tel"
                  placeholder="08X-XXX-XXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLookup()}
                />
              </div>
              <div className="flex items-end">
                <Button
                  onClick={handleLookup}
                  disabled={loading}
                  className="bg-stone-900 hover:bg-stone-700"
                >
                  <Search className="w-4 h-4 mr-2" />
                  {loading ? "กำลังค้นหา..." : "ค้นหา"}
                </Button>
              </div>
            </div>
            {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
          </CardContent>
        </Card>

        {/* Member card */}
        {customer?.membership && (
          <div className="mb-8">
            <div
              className="rounded-2xl p-6 text-white mb-4 relative overflow-hidden"
              style={{ background: `linear-gradient(135deg, ${customer.membership.tier.color}, ${customer.membership.tier.color}99)` }}
            >
              <div className="absolute right-4 top-4 opacity-20">
                <Star className="w-24 h-24" />
              </div>
              <p className="text-white/70 text-xs tracking-widest uppercase mb-1">err.day Member</p>
              <h2 className="text-2xl font-medium mb-1">{customer.name}</h2>
              <p className="text-white/70 text-sm mb-4">{customer.phone}</p>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-white/70 text-xs">ระดับสมาชิก</p>
                  <p className="text-xl font-semibold">{customer.membership.tier.nameTh}</p>
                  <p className="text-white/60 text-xs">{customer.membership.tier.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-white/70 text-xs">คะแนนสะสม</p>
                  <p className="text-3xl font-light">{customer.membership.points.toLocaleString()}</p>
                  <p className="text-white/60 text-xs">points</p>
                </div>
              </div>
              {customer.membership.tier.discountPercent > 0 && (
                <div className="mt-3 inline-flex items-center gap-1 bg-white/20 rounded-full px-3 py-1 text-sm">
                  <CheckCircle className="w-3.5 h-3.5" />
                  ส่วนลด {customer.membership.tier.discountPercent}% ทุกบริการ
                </div>
              )}
            </div>

            <ProgressBar points={customer.membership.points} tiers={tiers} />

            {/* Recent bookings */}
            {customer.bookings.length > 0 && (
              <Card className="border-stone-200 mt-6">
                <CardContent className="pt-6">
                  <h3 className="text-sm font-medium text-stone-700 mb-4">ประวัติการใช้บริการล่าสุด</h3>
                  <div className="space-y-3">
                    {customer.bookings.map((b) => (
                      <div key={b.id} className="flex items-center justify-between">
                        <div>
                          <p className="text-stone-800 text-sm font-medium">{b.service.name}</p>
                          <p className="text-stone-400 text-xs">{b.branch.name}</p>
                        </div>
                        <p className="text-stone-400 text-xs">
                          {new Date(b.date).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Tier overview */}
        <div>
          <h2 className="text-lg font-medium text-stone-900 mb-1">ระดับสมาชิก</h2>
          <p className="text-stone-400 text-sm mb-4">Membership Tiers</p>
          <div className="grid gap-3">
            {sorted.map((tier) => (
              <div
                key={tier.id}
                className="flex items-center justify-between p-4 rounded-lg bg-white border border-stone-200"
              >
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tier.color }} />
                  <div>
                    <p className="font-medium text-stone-900 text-sm">{tier.nameTh} <span className="text-stone-400 font-normal">({tier.name})</span></p>
                    <p className="text-stone-400 text-xs">
                      {tier.minPoints === 0 ? "เริ่มต้น" : `ตั้งแต่ ${tier.minPoints.toLocaleString()} คะแนน`}
                    </p>
                  </div>
                </div>
                {tier.discountPercent > 0 ? (
                  <Badge className="bg-green-100 text-green-800 border-0">ส่วนลด {tier.discountPercent}%</Badge>
                ) : (
                  <Badge variant="secondary">ไม่มีส่วนลด</Badge>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
