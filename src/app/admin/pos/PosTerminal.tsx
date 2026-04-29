"use client";

import { useState, useEffect } from "react";
import { Plus, Minus, Trash2, Check, ShoppingBag, PenLine, X, CreditCard, Tag } from "lucide-react";
import type { Branch, BranchService, Service, ServiceAddon } from "@/generated/prisma/client";
import CustomerSearch, { type CustomerValue } from "@/components/CustomerSearch";

type BS = BranchService & { service: Service };

interface CartItem {
  id: string;
  name: string;
  basePrice: number;      // original price before any discount (satang)
  price: number;          // actual price (may be member-discounted) (satang)
  qty: number;
  /** The price to use when member is active (satang). Equals basePrice if no discount. */
  memberPrice: number;
  isCustom?: boolean;
}

interface PrefillBooking {
  id: string;
  branchId: string;
  customer: { name: string; phone: string };
  serviceName: string;
  totalPrice: number;
}

interface MemberInfo {
  label: string;
  isValid: boolean;
  // Flat tier-level discount (0 when no tier). Used for add-ons.
  tierDiscountPct: number;
}

interface Props {
  branches: Branch[];
  activeBranchId: string;
  branchServices: BS[];
  addons: ServiceAddon[];
  prefillBooking?: PrefillBooking | null;
}

function formatPrice(satang: number) {
  return `฿${(satang / 100).toLocaleString()}`;
}

function applyDiscount(basePrice: number, pct: number): number {
  if (!pct) return basePrice;
  return Math.round(basePrice * (1 - pct / 100));
}

/** Returns the effective member price for a branch service (satang).
 *  Prefers the net fixed memberPrice over the percentage discount. */
function getServiceMemberPrice(bs: BS): number {
  const svc = bs.service as Service & { memberPrice?: number | null };
  if (svc.memberPrice != null && svc.memberPrice > 0) return svc.memberPrice;
  const pct = svc.memberDiscountPercent ?? 0;
  return applyDiscount(bs.price, pct);
}

// Categories rendered BEFORE add-ons
const CATS_BEFORE_ADDONS = ["บริการทั่วไป", "แพ็กเกจ"];
// Categories rendered AFTER add-ons
const CATS_AFTER_ADDONS  = ["Davines Spa", "ย้อมผม NIGAO"];

export default function PosTerminal({ branches, activeBranchId, branchServices, addons, prefillBooking }: Props) {
  const [cart, setCart] = useState<CartItem[]>(() => {
    if (prefillBooking) {
      return [{
        id: `prefill-${prefillBooking.id}`,
        name: prefillBooking.serviceName,
        basePrice: prefillBooking.totalPrice,
        price: prefillBooking.totalPrice,
        qty: 1,
        memberPrice: prefillBooking.totalPrice,
        isCustom: true,
      }];
    }
    return [];
  });
  const [customer, setCustomer] = useState<CustomerValue>(() => {
    if (prefillBooking) {
      return { id: null, name: prefillBooking.customer.name, phone: prefillBooking.customer.phone };
    }
    return { id: null, name: "", phone: "" };
  });

  const [fromBookingId] = useState<string | null>(prefillBooking?.id ?? null);
  const [memberInfo, setMemberInfo] = useState<MemberInfo | null>(null);

  const [customName, setCustomName] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [lastCustomerPhone, setLastCustomerPhone] = useState<string | null>(null);
  const [showMemberPrompt, setShowMemberPrompt] = useState(false);

  const customerName  = customer.name;
  const customerPhone = customer.phone;
  const clearCustomer = () => {
    setCustomer({ id: null, name: "", phone: "" });
    setMemberInfo(null);
  };

  // ── Fetch membership whenever a known customer is selected ──
  useEffect(() => {
    if (!customer.id || !customer.phone) {
      setMemberInfo(null);
      return;
    }
    fetch(`/api/membership?phone=${encodeURIComponent(customer.phone)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.membership) { setMemberInfo(null); return; }
        const m = data.membership;
        // Validity: membership exists + not expired + not used up
        // Note: pct check intentionally excluded — discount varies per service
        const expired = m.expiresAt && new Date(m.expiresAt) <= new Date();
        const usedUp  = m.usagesAllowed > 0 && m.usagesUsed >= m.usagesAllowed;
        const valid   = !expired && !usedUp;
        const tierPct: number = m.tier?.discountPercent ?? 0;
        setMemberInfo({ label: m.label ?? "สมาชิก", isValid: valid, tierDiscountPct: tierPct });
      })
      .catch(() => setMemberInfo(null));
  }, [customer.id, customer.phone]);

  // ── Re-price cart items when member status changes ──
  useEffect(() => {
    const active = memberInfo?.isValid ?? false;
    setCart(prev => prev.map(item => {
      if (item.isCustom) return item;
      return { ...item, price: active ? item.memberPrice : item.basePrice };
    }));
  }, [memberInfo]);

  // ── Category helpers ──
  const catsBeforeAddons = CATS_BEFORE_ADDONS.filter(c =>
    branchServices.some(bs => bs.service.category === c)
  );
  const catsAfterAddons = CATS_AFTER_ADDONS.filter(c =>
    branchServices.some(bs => bs.service.category === c)
  );

  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const memberActive = memberInfo?.isValid ?? false;

  // ── Cart operations ──
  const addService = (bs: BS) => {
    const mPrice = getServiceMemberPrice(bs);
    setCart(prev => {
      const existing = prev.find(i => i.id === bs.id);
      if (existing) return prev.map(i => i.id === bs.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, {
        id: bs.id,
        name: bs.service.nameTh,
        basePrice: bs.price,
        price: memberActive ? mPrice : bs.price,
        qty: 1,
        memberPrice: mPrice,
      }];
    });
  };

  const addAddon = (addon: ServiceAddon) => {
    const aid = `addon-${addon.id}`;
    // Add-ons use tier-level discount (if any); no per-addon net price
    const addonPct = memberInfo?.tierDiscountPct ?? 0;
    const addonMemberPrice = applyDiscount(addon.price, addonPct);
    setCart(prev => {
      const existing = prev.find(i => i.id === aid);
      if (existing) return prev.map(i => i.id === aid ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, {
        id: aid,
        name: addon.nameTh,
        basePrice: addon.price,
        price: memberActive ? addonMemberPrice : addon.price,
        qty: 1,
        memberPrice: addonMemberPrice,
      }];
    });
  };

  const addCustom = () => {
    const price = Math.round(parseFloat(customPrice) * 100);
    if (!customName.trim() || isNaN(price) || price <= 0) return;
    const id = `custom-${Date.now()}`;
    setCart(prev => [...prev, { id, name: customName.trim(), basePrice: price, price, qty: 1, memberPrice: price, isCustom: true }]);
    setCustomName("");
    setCustomPrice("");
    setShowCustomForm(false);
  };

  const updateQty = (id: string, delta: number) => {
    setCart(prev =>
      prev.map(i => i.id === id ? { ...i, qty: i.qty + delta } : i).filter(i => i.qty > 0)
    );
  };

  const removeItem = (id: string) => setCart(prev => prev.filter(i => i.id !== id));

  const checkout = async () => {
    if (cart.length === 0 || !customerName.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/pos/sale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: activeBranchId,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim() || undefined,
          items: cart.flatMap(i =>
            Array.from({ length: i.qty }, () => ({ name: i.name, price: i.price }))
          ),
          ...(fromBookingId ? { fromBookingId } : {}),
        }),
      });
      if (!res.ok) throw new Error();
      setLastCustomerPhone(customerPhone.trim() || null);
      setDone(true);
      setShowMemberPrompt(!!customerPhone.trim());
      setTimeout(() => {
        setDone(false);
        setShowMemberPrompt(false);
        setCart([]);
        clearCustomer();
        setLastCustomerPhone(null);
      }, 6000);
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  };

  // ── Shared service category section renderer ──
  function renderCategory(cat: string) {
    const items = branchServices.filter(bs => bs.service.category === cat);
    if (!items.length) return null;
    return (
      <div key={cat} className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-px flex-1" style={{ backgroundColor: "#D6BCAE" }} />
          <p className="text-xs font-semibold uppercase tracking-widest px-2" style={{ color: "#8B1D24" }}>{cat}</p>
          <div className="h-px flex-1" style={{ backgroundColor: "#D6BCAE" }} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {items.map(bs => {
            const inCart = cart.some(i => i.id === bs.id);
            const memberPriceNet = getServiceMemberPrice(bs);
            const discPrice = memberActive ? memberPriceNet : bs.price;
            const hasDiscount = memberActive && memberPriceNet < bs.price;
            return (
              <button
                key={bs.id}
                onClick={() => addService(bs)}
                className="text-left p-3 rounded-xl border-2 transition-all hover:border-[#8B1D24]"
                style={{
                  borderColor:     inCart ? "#8B1D24" : "#E8D8CC",
                  backgroundColor: inCart ? "#FFF0E8" : "white",
                }}
              >
                <p className="text-sm font-medium leading-tight" style={{ color: "#3B2A24" }}>
                  {bs.service.nameTh}
                </p>
                <p className="text-xs mt-1" style={{ color: "#A08070" }}>{bs.duration} นาที</p>
                {hasDiscount ? (
                  <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                    <p className="text-xs line-through" style={{ color: "#C4B0A4" }}>{formatPrice(bs.price)}</p>
                    <p className="font-semibold text-sm" style={{ color: "#16a34a" }}>{formatPrice(discPrice)}</p>
                  </div>
                ) : (
                  <p className="font-semibold mt-1" style={{ color: "#8B1D24" }}>{formatPrice(bs.price)}</p>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between" style={{ backgroundColor: "#3B2A24" }}>
        <div>
          <p className="text-xs uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>POS</p>
          <h1 className="text-white font-medium text-sm">ขายหน้าร้าน</h1>
        </div>
        <div className="flex gap-2">
          {branches.map(b => (
            <a
              key={b.id}
              href={`/admin/pos?branchId=${b.id}`}
              className="text-xs px-3 py-1.5 rounded-full transition-colors"
              style={
                b.id === activeBranchId
                  ? { backgroundColor: "#8B1D24", color: "white" }
                  : { backgroundColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)" }
              }
            >
              {b.name.replace("err.day ", "")}
            </a>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT: Service Menu ── */}
        <div className="flex-1 overflow-y-auto px-6 py-6" style={{ backgroundColor: "#FDF8F3" }}>
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-medium" style={{ color: "#3B2A24" }}>รายการบริการ</h2>
            <button
              onClick={() => setShowCustomForm(v => !v)}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border-2 transition-colors"
              style={{ borderColor: "#8B1D24", color: "#8B1D24" }}
            >
              <PenLine className="w-3.5 h-3.5" />
              เพิ่มรายการพิเศษ
            </button>
          </div>

          {/* Custom item form */}
          {showCustomForm && (
            <div className="mb-6 p-4 rounded-xl border-2" style={{ borderColor: "#8B1D24", backgroundColor: "white" }}>
              <p className="text-sm font-medium mb-3" style={{ color: "#3B2A24" }}>เพิ่มรายการพิเศษ / Add Custom Order</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="ชื่อรายการ"
                  value={customName}
                  onChange={e => setCustomName(e.target.value)}
                  className="flex-1 border rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ borderColor: "#D6BCAE" }}
                />
                <input
                  type="number"
                  placeholder="ราคา (฿)"
                  value={customPrice}
                  onChange={e => setCustomPrice(e.target.value)}
                  className="w-28 border rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ borderColor: "#D6BCAE" }}
                  onKeyDown={e => e.key === "Enter" && addCustom()}
                />
                <button onClick={addCustom} className="px-3 py-2 rounded-lg text-white text-sm" style={{ backgroundColor: "#8B1D24" }}>
                  เพิ่ม
                </button>
                <button onClick={() => setShowCustomForm(false)} className="px-2 py-2 rounded-lg" style={{ color: "#A08070" }}>
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Categories BEFORE add-ons */}
          {catsBeforeAddons.map(cat => renderCategory(cat))}

          {/* ── Add-Ons section ── */}
          {addons.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-px flex-1" style={{ backgroundColor: "#D6BCAE" }} />
                <p className="text-xs font-semibold uppercase tracking-widest px-2" style={{ color: "#8B1D24" }}>
                  บริการเสริม / Add-Ons
                </p>
                <div className="h-px flex-1" style={{ backgroundColor: "#D6BCAE" }} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                {addons.map(addon => {
                  const inCart = cart.some(i => i.id === `addon-${addon.id}`);
                  const addonPct = memberActive ? (memberInfo?.tierDiscountPct ?? 0) : 0;
                  const discPrice = applyDiscount(addon.price, addonPct);
                  const hasDiscount = addonPct > 0 && discPrice < addon.price;
                  return (
                    <button
                      key={addon.id}
                      onClick={() => addAddon(addon)}
                      className="text-left p-3 rounded-xl border-2 transition-all hover:border-[#8B1D24]"
                      style={{
                        borderColor:     inCart ? "#8B1D24" : "#E8D8CC",
                        backgroundColor: inCart ? "#FFF0E8" : "white",
                      }}
                    >
                      <p className="text-sm font-medium leading-tight" style={{ color: "#3B2A24" }}>{addon.nameTh}</p>
                      {addon.name !== addon.nameTh && (
                        <p className="text-xs mt-0.5" style={{ color: "#A08070" }}>{addon.name}</p>
                      )}
                      {hasDiscount ? (
                        <div className="mt-1 flex items-center gap-1.5">
                          <p className="text-xs line-through" style={{ color: "#C4B0A4" }}>{formatPrice(addon.price)}</p>
                          <p className="font-semibold text-sm" style={{ color: "#16a34a" }}>{formatPrice(discPrice)}</p>
                        </div>
                      ) : (
                        <p className="font-semibold mt-1" style={{ color: "#8B1D24" }}>{formatPrice(addon.price)}</p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Categories AFTER add-ons */}
          {catsAfterAddons.map(cat => renderCategory(cat))}
        </div>

        {/* ── RIGHT: Order ── */}
        <div className="w-80 flex flex-col border-l" style={{ borderColor: "#E8D8CC", backgroundColor: "white" }}>

          {/* Prefill banner */}
          {fromBookingId && (
            <div className="px-5 pt-4 pb-0">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium"
                style={{ background: "#FFF0E8", color: "#8B1D24", border: "1px solid #E8D8CC" }}>
                📅 เช็คเอาท์จากการจอง — ข้อมูลถูกกรอกอัตโนมัติแล้ว
              </div>
            </div>
          )}

          {/* Customer */}
          <div className="px-5 pt-5 pb-4" style={{ borderBottom: "1px solid #F0E4D8" }}>
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#8B1D24" }}>ลูกค้า</p>
            <CustomerSearch value={customer} onChange={c => { setCustomer(c); if (!c.id) setMemberInfo(null); }} />

            {/* Member badge */}
            {memberInfo && (
              <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-xl"
                style={{
                  background: memberInfo.isValid ? "#F0FDF4" : "#FFF8F4",
                  border:     `1px solid ${memberInfo.isValid ? "#86EFAC" : "#E8D8CC"}`,
                }}>
                <Tag className="w-3.5 h-3.5 flex-shrink-0" style={{ color: memberInfo.isValid ? "#16a34a" : "#A08070" }} />
                <p className="text-xs font-semibold" style={{ color: memberInfo.isValid ? "#16a34a" : "#A08070" }}>
                  {memberInfo.isValid
                    ? `${memberInfo.label} — ราคาพิเศษสมาชิก`
                    : `${memberInfo.label} (หมดอายุ / ใช้ครบแล้ว)`}
                </p>
              </div>
            )}
          </div>

          {/* Cart items */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#8B1D24" }}>
              รายการ {cart.length > 0 && `(${cart.reduce((s, i) => s + i.qty, 0)})`}
            </p>
            {cart.length === 0 ? (
              <div className="flex flex-col items-center py-8 gap-2" style={{ color: "#D6BCAE" }}>
                <ShoppingBag className="w-8 h-8" />
                <p className="text-sm" style={{ color: "#A08070" }}>ยังไม่มีรายการ</p>
              </div>
            ) : (
              <div className="space-y-2">
                {cart.map(item => (
                  <div key={item.id} className="p-3 rounded-xl" style={{ backgroundColor: "#F9F4F0" }}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium leading-tight flex-1" style={{ color: "#3B2A24" }}>{item.name}</p>
                      <button onClick={() => removeItem(item.id)} style={{ color: "#C4B0A4" }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-2">
                        <button onClick={() => updateQty(item.id, -1)}
                          className="w-6 h-6 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: "#E8D8CC" }}>
                          <Minus className="w-3 h-3" style={{ color: "#6B5245" }} />
                        </button>
                        <span className="text-sm font-medium w-5 text-center" style={{ color: "#3B2A24" }}>{item.qty}</span>
                        <button onClick={() => updateQty(item.id, 1)}
                          className="w-6 h-6 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: "#E8D8CC" }}>
                          <Plus className="w-3 h-3" style={{ color: "#6B5245" }} />
                        </button>
                      </div>
                      <div className="text-right">
                        {!item.isCustom && item.price < item.basePrice && (
                          <p className="text-xs line-through leading-none" style={{ color: "#C4B0A4" }}>
                            {formatPrice(item.basePrice * item.qty)}
                          </p>
                        )}
                        <p className="font-semibold text-sm" style={{ color: item.price < item.basePrice ? "#16a34a" : "#8B1D24" }}>
                          {formatPrice(item.price * item.qty)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Total + Checkout */}
          <div className="px-5 py-5" style={{ borderTop: "1px solid #F0E4D8" }}>
            {/* Show savings when member discount applied */}
            {memberActive && cart.some(i => i.price < i.basePrice) && (
              <div className="flex justify-between text-xs mb-2" style={{ color: "#16a34a" }}>
                <span>ส่วนลดสมาชิก</span>
                <span>-{formatPrice(cart.reduce((s, i) => s + (i.basePrice - i.price) * i.qty, 0))}</span>
              </div>
            )}
            <div className="flex justify-between items-center mb-4">
              <span className="font-medium" style={{ color: "#5C4A42" }}>ยอดรวมทั้งหมด</span>
              <span className="font-bold text-2xl" style={{ color: "#8B1D24" }}>{formatPrice(total)}</span>
            </div>

            {error && <p className="text-red-500 text-xs mb-2">{error}</p>}

            {done ? (
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2 py-3 rounded-xl text-white text-sm font-medium" style={{ backgroundColor: "#22c55e" }}>
                  <Check className="w-4 h-4" /> บันทึกเรียบร้อย!
                </div>
                {showMemberPrompt && lastCustomerPhone && (
                  <a
                    href={`/admin/customers?phone=${encodeURIComponent(lastCustomerPhone)}`}
                    className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border-2"
                    style={{ borderColor: "#8B1D24", color: "#8B1D24", background: "white" }}
                  >
                    <CreditCard className="w-4 h-4" /> ลงทะเบียนสมาชิก
                  </a>
                )}
              </div>
            ) : (
              <button
                onClick={checkout}
                disabled={loading || cart.length === 0 || !customerName.trim()}
                className="w-full py-3 rounded-xl text-white font-medium text-base transition-opacity disabled:opacity-40"
                style={{ backgroundColor: "#8B1D24" }}
              >
                {loading ? "กำลังบันทึก..." : "ชำระเงิน / Checkout"}
              </button>
            )}
            <p className="text-xs text-center mt-2" style={{ color: "#A08070" }}>
              {cart.length === 0 ? "เพิ่มรายการก่อนชำระเงิน" : !customerName.trim() ? "กรุณาระบุชื่อลูกค้า" : `${cart.reduce((s, i) => s + i.qty, 0)} รายการ`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
