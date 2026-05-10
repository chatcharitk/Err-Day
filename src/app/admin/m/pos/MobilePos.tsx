"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ShoppingBag, Plus, Minus, X, Check, Loader2, Tag,
  Sparkles, ChevronDown, AlertCircle,
} from "lucide-react";
import CustomerSearch, { type CustomerValue } from "@/components/CustomerSearch";

interface Branch { id: string; name: string; }

interface SlimService {
  id:                    string;
  nameTh:                string;
  category:              string;
  memberPrice:           number | null;
  memberDiscountPercent: number;
}

interface BS {
  id:        string;
  branchId:  string;
  serviceId: string;
  price:     number;
  duration:  number;
  isActive:  boolean;
  service:   SlimService;
}

interface ServiceAddon {
  id:     string;
  nameTh: string;
  price:  number;
}

interface CartItem {
  id:                 string;
  name:               string;
  basePrice:          number;
  price:              number;
  qty:                number;
  memberPrice:        number;
  isCustom?:          boolean;
  redeemPackageId?:   string;
  redeemPackageName?: string;
  /** Per-item manual discount in baht (not satang). */
  itemDiscountBaht?:  number;
}

interface ActivePackage {
  id:               string;
  sku:              string;
  nameTh:           string;
  coversServiceIds: string[];
  expiresAt:        string;
  usagesUsed:       number;
  usageLimit:       number;
  usagesLeft:       number | null;
}

interface MemberInfo {
  label:           string;
  isValid:         boolean;
  tierDiscountPct: number;
}

interface PrefillBooking {
  id:          string;
  branchId:    string;
  customer:    { id: string; name: string; phone: string };
  serviceId:   string;
  serviceName: string;
  totalPrice:  number;
  /** Server-resolved membership flag — price correct from first render. */
  isMember:    boolean;
  /** Add-ons already attached to the booking (snapshot prices). */
  addons:      { addonId: string; name: string; price: number }[];
}

interface Props {
  branches:        Branch[];
  activeBranchId:  string;
  branchServices:  BS[];
  addons:          ServiceAddon[];
  prefillBooking?: PrefillBooking | null;
}

const PRIMARY = "#8B1D24";
const TEXT    = "#3B2A24";
const MUTED   = "#A08070";
const BORDER  = "#E8D8CC";

const CAT_ORDER = ["Membership", "บริการทั่วไป", "แพ็กเกจ", "Davines Spa", "ย้อมผม NIGAO"];

function formatPrice(satang: number) {
  return `฿${(satang / 100).toLocaleString()}`;
}

function applyDiscount(basePrice: number, pct: number): number {
  if (!pct) return basePrice;
  return Math.round(basePrice * (1 - pct / 100));
}

function getServiceMemberPrice(bs: BS): number {
  if (bs.service.memberPrice != null && bs.service.memberPrice > 0) return bs.service.memberPrice;
  return applyDiscount(bs.price, bs.service.memberDiscountPercent ?? 0);
}

export default function MobilePos({ branches, activeBranchId, branchServices, addons, prefillBooking }: Props) {
  const router = useRouter();
  const [customer, setCustomer] = useState<CustomerValue>(() => {
    if (prefillBooking) {
      return { id: prefillBooking.customer.id, name: prefillBooking.customer.name, phone: prefillBooking.customer.phone };
    }
    return { id: null, name: "", phone: "" };
  });
  const [memberInfo,     setMemberInfo]     = useState<MemberInfo | null>(null);
  const [activePackages, setActivePackages] = useState<ActivePackage[]>([]);
  const [cart,           setCart]           = useState<CartItem[]>(() => {
    if (!prefillBooking) return [];

    const items: CartItem[] = [];

    // ── Main service ────────────────────────────────────────────────
    const bs = branchServices.find(s => s.serviceId === prefillBooking.serviceId);
    if (bs) {
      const mPrice = getServiceMemberPrice(bs);
      // Use member price immediately if we know the customer is a member (server-resolved).
      items.push({
        id:          bs.id,
        name:        bs.service.nameTh,
        basePrice:   bs.price,
        price:       prefillBooking.isMember ? mPrice : bs.price,
        qty:         1,
        memberPrice: mPrice,
      });
    } else {
      // Fallback: service not in branch catalogue (shouldn't normally happen)
      items.push({
        id:          `prefill-${prefillBooking.id}`,
        name:        prefillBooking.serviceName,
        basePrice:   prefillBooking.totalPrice,
        price:       prefillBooking.totalPrice,
        qty:         1,
        memberPrice: prefillBooking.totalPrice,
        isCustom:    true,
      });
    }

    // ── Add-ons from the booking ─────────────────────────────────────
    // Snapshot prices already reflect any member discount applied at booking time.
    for (const a of prefillBooking.addons) {
      items.push({
        id:          `addon-${a.addonId}`,
        name:        a.name,
        basePrice:   a.price,
        price:       a.price,
        qty:         1,
        memberPrice: a.price, // snapshot is authoritative; re-pricing effect won't change it
      });
    }

    return items;
  });
  const [fromBookingId] = useState<string | null>(prefillBooking?.id ?? null);
  const [showCart,       setShowCart]       = useState(prefillBooking != null);
  const [showBranchPicker, setShowBranchPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState("");
  const [done,       setDone]       = useState(false);
  // When prefilled from a booking, carry over any discount the booking already had:
  //   booking.totalPrice is post-discount, while the cart re-prices from the catalog
  //   (bs.price / member price). The difference is the implicit bill-level discount.
  const [discountBaht, setDiscountBaht] = useState<number>(() => {
    if (!prefillBooking) return 0;
    const bs = branchServices.find(s => s.serviceId === prefillBooking.serviceId);
    const servicePrice = bs
      ? (prefillBooking.isMember ? getServiceMemberPrice(bs) : bs.price)
      : prefillBooking.totalPrice;
    const addonsTotal = prefillBooking.addons.reduce((s, a) => s + a.price, 0);
    const implied = (servicePrice + addonsTotal) - prefillBooking.totalPrice;
    return implied > 0 ? implied / 100 : 0;
  });
  const [discountingItemId, setDiscountingItemId] = useState<string | null>(null);

  const activeBranch = branches.find(b => b.id === activeBranchId);

  // Fetch membership when customer is selected
  useEffect(() => {
    if (!customer.id || !customer.phone) {
      setMemberInfo(null);
      setActivePackages([]);
      return;
    }
    fetch(`/api/membership?phone=${encodeURIComponent(customer.phone)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.membership) {
          const m = data.membership;
          const today = new Date(); today.setUTCHours(0, 0, 0, 0);
          const expired = m.expiresAt && new Date(m.expiresAt) < today;
          const usedUp  = m.usagesAllowed > 0 && m.usagesUsed >= m.usagesAllowed;
          const valid   = !expired && !usedUp && !m.pendingActivation;
          setMemberInfo({
            label:           m.label ?? "สมาชิก",
            isValid:         valid,
            tierDiscountPct: m.tier?.discountPercent ?? 0,
          });
        } else {
          setMemberInfo(null);
        }
        setActivePackages(Array.isArray(data?.packages) ? data.packages : []);
      })
      .catch(() => { setMemberInfo(null); setActivePackages([]); });
  }, [customer.id, customer.phone]);

  // Re-price cart when an existing member is selected / deselected
  useEffect(() => {
    const active = memberInfo?.isValid ?? false;
    setCart(prev => prev.map(item => {
      if (item.isCustom) return item;
      if (item.redeemPackageId) return item;
      return { ...item, price: active ? item.memberPrice : item.basePrice };
    }));
  }, [memberInfo]);

  // Which branchService row corresponds to the membership SKU
  const MEMBERSHIP_SKU = "svc-membership-30d";
  const membershipBsId = useMemo(
    () => branchServices.find(bs => bs.serviceId === MEMBERSHIP_SKU)?.id ?? null,
    [branchServices],
  );
  // True when the cart itself contains a membership purchase (even before the customer
  // has an existing membership record), so we can apply member prices immediately.
  const cartHasMembership = useMemo(
    () => membershipBsId != null && cart.some(i => i.id === membershipBsId),
    [cart, membershipBsId],
  );
  const memberActive = (memberInfo?.isValid ?? false) || cartHasMembership;

  // Pick the most-eligible package for a service
  function pickPackageFor(bs: BS, currentCart: CartItem[]): ActivePackage | null {
    const candidates = activePackages
      .filter(p => p.coversServiceIds.includes(bs.serviceId))
      .filter(p => {
        if (p.usageLimit === 0) return true;
        const claimedHere = currentCart.filter(c => c.redeemPackageId === p.id).length;
        const remaining = (p.usagesLeft ?? 0) - claimedHere;
        return remaining > 0;
      })
      .sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime());
    return candidates[0] ?? null;
  }

  const addService = (bs: BS) => {
    const mPrice = getServiceMemberPrice(bs);
    const isMembershipItem = bs.serviceId === MEMBERSHIP_SKU;
    setCart(prev => {
      const pkg = pickPackageFor(bs, prev);
      const rowId = pkg ? `${bs.id}__pkg-${pkg.id}-${prev.length}` : bs.id;
      if (!pkg) {
        const existing = prev.find(i => i.id === bs.id && !i.redeemPackageId);
        if (existing) return prev.map(i => i.id === bs.id && !i.redeemPackageId ? { ...i, qty: i.qty + 1 } : i);
      }
      const newItem: CartItem = {
        id:                rowId,
        name:              bs.service.nameTh,
        basePrice:         bs.price,
        price:             pkg ? 0 : (memberActive ? mPrice : bs.price),
        qty:               1,
        memberPrice:       mPrice,
        redeemPackageId:   pkg?.id,
        redeemPackageName: pkg?.nameTh,
      };
      const newCart = [...prev, newItem];
      // When adding a membership to the cart for a non-member, immediately
      // apply member pricing to all other service items already in the cart.
      if (isMembershipItem && !(memberInfo?.isValid)) {
        return newCart.map(item => {
          if (item.id === rowId) return item;           // membership itself — unchanged
          if (item.isCustom || item.redeemPackageId) return item;
          return { ...item, price: item.memberPrice };
        });
      }
      return newCart;
    });
    setShowCart(true);
  };

  const addAddon = (addon: ServiceAddon) => {
    const aid = `addon-${addon.id}`;
    const addonPct = memberInfo?.tierDiscountPct ?? 0;
    const addonMemberPrice = applyDiscount(addon.price, addonPct);
    setCart(prev => {
      const existing = prev.find(i => i.id === aid);
      if (existing) return prev.map(i => i.id === aid ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, {
        id:          aid,
        name:        addon.nameTh,
        basePrice:   addon.price,
        price:       memberActive ? addonMemberPrice : addon.price,
        qty:         1,
        memberPrice: addonMemberPrice,
      }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart(prev =>
      prev.map(i => i.id === id ? { ...i, qty: i.qty + delta } : i).filter(i => i.qty > 0)
    );
  };

  const removeItem = (id: string) => setCart(prev => {
    const filtered = prev.filter(i => i.id !== id);
    // When removing the membership item from a non-member's cart, revert to base prices
    if (id === membershipBsId && !(memberInfo?.isValid)) {
      return filtered.map(item => {
        if (item.isCustom || item.redeemPackageId) return item;
        return { ...item, price: item.basePrice };
      });
    }
    return filtered;
  });

  const setItemDiscount = (id: string, baht: number) =>
    setCart(prev => prev.map(i => i.id === id ? { ...i, itemDiscountBaht: baht } : i));

  // Group services by category
  const grouped = useMemo(() => {
    const m = new Map<string, BS[]>();
    for (const bs of branchServices) {
      const cat = bs.service.category;
      if (!m.has(cat)) m.set(cat, []);
      m.get(cat)!.push(bs);
    }
    return CAT_ORDER
      .filter(c => m.has(c))
      .map(c => ({ category: c, services: m.get(c)! }))
      .concat(
        Array.from(m.keys())
          .filter(c => !CAT_ORDER.includes(c))
          .map(c => ({ category: c, services: m.get(c)! }))
      );
  }, [branchServices]);

  const subtotal = cart.reduce((s, i) => {
    const raw  = i.price * i.qty;
    const disc = Math.min(raw, Math.round((i.itemDiscountBaht ?? 0) * 100));
    return s + raw - disc;
  }, 0);
  const discountSatang = Math.min(subtotal, Math.round(discountBaht * 100));
  const total      = Math.max(0, subtotal - discountSatang);
  const cartCount  = cart.reduce((s, i) => s + i.qty, 0);

  const switchBranch = (id: string) => {
    setShowBranchPicker(false);
    router.replace(`/admin/m/pos?branchId=${id}`);
    router.refresh();
  };

  const checkout = async () => {
    if (cart.length === 0) return;
    if (!customer.name.trim()) {
      setError("กรุณาเลือกหรือเพิ่มลูกค้า");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const items = cart.flatMap(i =>
        Array.from({ length: i.qty }).map(() => {
          const isService = !i.isCustom && !i.id.startsWith("addon-");
          return {
            name:            i.name,
            price:           i.price,
            branchServiceId: isService ? (i.redeemPackageId ? i.id.split("__")[0] : i.id) : undefined,
            redeemPackageId: i.redeemPackageId,
          };
        })
      );
      // Per-item discounts as negative line items
      for (const item of cart) {
        if ((item.itemDiscountBaht ?? 0) > 0) {
          const raw      = item.price * item.qty;
          const discSat  = Math.min(raw, Math.round(item.itemDiscountBaht! * 100));
          items.push({ name: `ส่วนลด (${item.name})`, price: -discSat, branchServiceId: undefined, redeemPackageId: undefined });
        }
      }
      // Bill-level discount
      if (discountSatang > 0) {
        items.push({ name: `ส่วนลดทั้งบิล`, price: -discountSatang, branchServiceId: undefined, redeemPackageId: undefined });
      }
      const res = await fetch("/api/pos/sale", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          branchId:      activeBranchId,
          customerName:  customer.name.trim(),
          customerPhone: customer.phone.trim() || undefined,
          items,
          ...(fromBookingId ? { fromBookingId } : {}),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "เช็คเอาท์ไม่สำเร็จ");
        setSubmitting(false);
        return;
      }
      setDone(true);
      // Reset after 1.5s — when continuing from a booking, return to home
      setTimeout(() => {
        if (fromBookingId) {
          router.replace("/admin/m");
          router.refresh();
          return;
        }
        setDone(false);
        setCart([]);
        setCustomer({ id: null, name: "", phone: "" });
        setShowCart(false);
        setSubmitting(false);
        router.refresh();
      }, 1500);
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: "#F0FDF4" }}>
            <Check size={40} style={{ color: "#16a34a" }} />
          </div>
          <p className="text-lg font-semibold" style={{ color: TEXT }}>ขายสำเร็จ</p>
          <p className="text-sm mt-1" style={{ color: MUTED }}>ยอดรวม {formatPrice(total)}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="pb-32" style={{ background: "#FDF7F2", minHeight: "100vh" }}>
      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-white" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <div className="px-4 py-3 flex items-center gap-2">
          <button onClick={() => router.push("/admin/m")} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ color: TEXT }}>
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-base font-medium flex-1" style={{ color: TEXT }}>POS</h1>
          <button
            onClick={() => setShowBranchPicker(true)}
            className="flex items-center gap-1 px-3 h-9 rounded-full text-xs font-medium"
            style={{ border: `1px solid ${BORDER}`, color: TEXT }}
          >
            <span className="truncate max-w-[140px]">{activeBranch?.name ?? "เลือกสาขา"}</span>
            <ChevronDown size={14} />
          </button>
        </div>
      </header>

      {/* From-booking banner */}
      {fromBookingId && (
        <div className="mx-4 mt-3 rounded-xl px-3 py-2 text-xs font-medium" style={{ background: "#FFF8F4", border: `1px solid ${BORDER}`, color: TEXT }}>
          📅 เช็คเอาท์จากการจอง — ข้อมูลถูกกรอกอัตโนมัติแล้ว
        </div>
      )}

      {/* Customer card */}
      <section className="px-4 py-3">
        <p className="text-xs mb-2 font-medium" style={{ color: MUTED }}>ลูกค้า</p>
        <CustomerSearch value={customer} onChange={setCustomer} />
        {/* Existing-member badge */}
        {memberInfo && (
          <div
            className="mt-2 rounded-xl px-3 py-2 flex items-center gap-2"
            style={{
              background: memberInfo.isValid ? "#F0FDF4" : "#FFF8F4",
              border:     `1px solid ${memberInfo.isValid ? "#86EFAC" : BORDER}`,
            }}
          >
            <Tag size={14} style={{ color: memberInfo.isValid ? "#16a34a" : MUTED }} />
            <p className="text-xs font-semibold" style={{ color: memberInfo.isValid ? "#16a34a" : MUTED }}>
              {memberInfo.isValid ? `${memberInfo.label} — ราคาพิเศษสมาชิก` : `${memberInfo.label} (หมดอายุ / ใช้ครบ)`}
            </p>
          </div>
        )}
        {/* Banner when membership is being purchased in this bill (non-member) */}
        {cartHasMembership && !(memberInfo?.isValid) && (
          <div
            className="mt-2 rounded-xl px-3 py-2 flex items-center gap-2"
            style={{ background: "#F0FDF4", border: "1px solid #86EFAC" }}
          >
            <Sparkles size={14} style={{ color: "#16a34a" }} />
            <p className="text-xs font-semibold" style={{ color: "#16a34a" }}>
              ซื้อสมาชิกในบิลนี้ — ราคาสมาชิกใช้ได้ทันที ✓
            </p>
          </div>
        )}
        {activePackages.length > 0 && (
          <div className="mt-2 space-y-1">
            {activePackages.map(p => (
              <div key={p.id} className="rounded-xl px-3 py-2 flex items-center gap-2" style={{ background: "#EFF6FF", border: "1px solid #BFDBFE" }}>
                <Sparkles size={14} style={{ color: "#1D4ED8" }} />
                <p className="text-xs font-semibold flex-1" style={{ color: "#1D4ED8" }}>
                  {p.nameTh}{p.usagesLeft != null && ` — เหลือ ${p.usagesLeft} ครั้ง`}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Service catalog */}
      <section className="px-4 py-2 space-y-4">
        {grouped.map(({ category, services }) => (
          <div key={category}>
            <p className="text-[11px] uppercase tracking-widest mb-2 font-semibold" style={{ color: MUTED }}>
              {category}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {services.map(bs => {
                const mPrice = getServiceMemberPrice(bs);
                const showMember = memberActive && mPrice < bs.price;
                return (
                  <button
                    key={bs.id}
                    onClick={() => addService(bs)}
                    className="text-left rounded-xl p-3 active:scale-95 transition-transform"
                    style={{ background: "white", border: `1px solid ${BORDER}` }}
                  >
                    <p className="text-sm font-medium leading-tight" style={{ color: TEXT }}>{bs.service.nameTh}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: MUTED }}>{bs.duration} นาที</p>
                    <div className="mt-1.5 flex items-baseline gap-1.5">
                      {showMember ? (
                        <>
                          <span className="text-xs line-through" style={{ color: MUTED }}>{formatPrice(bs.price)}</span>
                          <span className="text-sm font-semibold" style={{ color: "#16a34a" }}>{formatPrice(mPrice)}</span>
                        </>
                      ) : (
                        <span className="text-sm font-semibold" style={{ color: PRIMARY }}>{formatPrice(bs.price)}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Add-ons */}
        {addons.length > 0 && (
          <div>
            <p className="text-[11px] uppercase tracking-widest mb-2 font-semibold" style={{ color: MUTED }}>
              บริการเสริม
            </p>
            <div className="grid grid-cols-2 gap-2">
              {addons.map(a => (
                <button
                  key={a.id}
                  onClick={() => addAddon(a)}
                  className="text-left rounded-xl p-3 active:scale-95 transition-transform"
                  style={{ background: "white", border: `1px solid ${BORDER}` }}
                >
                  <p className="text-sm font-medium leading-tight" style={{ color: TEXT }}>{a.nameTh}</p>
                  <p className="text-sm font-semibold mt-1.5" style={{ color: PRIMARY }}>{formatPrice(a.price)}</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Floating cart button */}
      {cart.length > 0 && !showCart && (
        <button
          onClick={() => setShowCart(true)}
          className="fixed bottom-6 left-4 right-4 max-w-md mx-auto py-3.5 rounded-2xl shadow-lg flex items-center justify-between px-5 text-white"
          style={{ background: PRIMARY }}
        >
          <span className="flex items-center gap-2">
            <ShoppingBag size={18} />
            <span className="text-sm font-semibold">{cartCount} รายการ</span>
          </span>
          <span className="text-base font-bold">{formatPrice(total)}</span>
        </button>
      )}

      {/* Cart bottom sheet */}
      {showCart && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => !submitting && setShowCart(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-t-2xl max-h-[85vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${BORDER}` }}>
              <p className="font-medium" style={{ color: TEXT }}>ตะกร้าสินค้า</p>
              <button onClick={() => !submitting && setShowCart(false)} className="p-1" style={{ color: MUTED }}>
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {cart.length === 0 ? (
                <p className="text-sm text-center py-10" style={{ color: MUTED }}>ยังไม่มีรายการ</p>
              ) : (
                <ul className="space-y-2">
                  {cart.map(item => {
                    const raw          = item.price * item.qty;
                    const itemDiscSat  = Math.min(raw, Math.round((item.itemDiscountBaht ?? 0) * 100));
                    const itemTotal    = raw - itemDiscSat;
                    const isDiscounting = discountingItemId === item.id;
                    return (
                    <li
                      key={item.id}
                      className="rounded-xl p-3"
                      style={{ background: item.redeemPackageId ? "#EFF6FF" : "#FAF5F0" }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium" style={{ color: TEXT }}>{item.name}</p>
                          {item.redeemPackageId && (
                            <p className="text-[11px] mt-0.5 font-semibold" style={{ color: "#1D4ED8" }}>
                              ใช้สิทธิ์ {item.redeemPackageName} — ฟรี
                            </p>
                          )}
                          {!item.redeemPackageId && item.price < item.basePrice && (
                            <p className="text-[11px] mt-0.5" style={{ color: "#16a34a" }}>
                              ราคาสมาชิก (ปกติ {formatPrice(item.basePrice)})
                            </p>
                          )}
                        </div>
                        <button onClick={() => removeItem(item.id)} className="p-1" style={{ color: MUTED }}>
                          <X size={14} />
                        </button>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        {/* Qty controls */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateQty(item.id, -1)}
                            className="w-7 h-7 rounded-full flex items-center justify-center"
                            style={{ background: "white", border: `1px solid ${BORDER}`, color: TEXT }}
                          >
                            <Minus size={12} />
                          </button>
                          <span className="text-sm font-medium w-6 text-center" style={{ color: TEXT }}>{item.qty}</span>
                          <button
                            onClick={() => updateQty(item.id, 1)}
                            className="w-7 h-7 rounded-full flex items-center justify-center"
                            style={{ background: "white", border: `1px solid ${BORDER}`, color: TEXT }}
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                        {/* Price + per-item discount trigger */}
                        <div className="flex items-center gap-2">
                          {itemDiscSat > 0 ? (
                            <div className="text-right">
                              <p className="text-[11px] line-through leading-tight" style={{ color: MUTED }}>{formatPrice(raw)}</p>
                              <p className="text-sm font-semibold leading-tight" style={{ color: TEXT }}>{formatPrice(itemTotal)}</p>
                            </div>
                          ) : (
                            <p className="text-sm font-semibold" style={{ color: TEXT }}>{formatPrice(raw)}</p>
                          )}
                          {!item.redeemPackageId && (
                            <button
                              onClick={() => setDiscountingItemId(isDiscounting ? null : item.id)}
                              className="text-[11px] font-medium px-2 py-1 rounded-lg"
                              style={{
                                background: isDiscounting ? PRIMARY : "white",
                                color:      isDiscounting ? "white" : PRIMARY,
                                border:     `1px solid ${isDiscounting ? PRIMARY : BORDER}`,
                              }}
                            >
                              {itemDiscSat > 0 && !isDiscounting ? `-฿${item.itemDiscountBaht}` : "ส่วนลด"}
                            </button>
                          )}
                        </div>
                      </div>
                      {/* Inline per-item discount input */}
                      {isDiscounting && (
                        <div
                          className="mt-2 flex items-center gap-2 rounded-lg px-3 py-2"
                          style={{ background: "#FFFBF5", border: `1px solid ${BORDER}` }}
                        >
                          <span className="text-xs" style={{ color: MUTED }}>ส่วนลด ฿</span>
                          <input
                            type="number"
                            min={0}
                            // eslint-disable-next-line jsx-a11y/no-autofocus
                            autoFocus
                            value={item.itemDiscountBaht || ""}
                            onChange={e => setItemDiscount(item.id, Math.max(0, Number(e.target.value)))}
                            onKeyDown={e => e.key === "Enter" && setDiscountingItemId(null)}
                            placeholder="0"
                            className="flex-1 text-sm outline-none bg-transparent"
                            style={{ color: TEXT }}
                          />
                          {(item.itemDiscountBaht ?? 0) > 0 && (
                            <button
                              onClick={() => { setItemDiscount(item.id, 0); }}
                              className="text-xs"
                              style={{ color: MUTED }}
                            >ล้าง</button>
                          )}
                          <button
                            onClick={() => setDiscountingItemId(null)}
                            className="text-xs font-semibold"
                            style={{ color: PRIMARY }}
                          >ตกลง</button>
                        </div>
                      )}
                    </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="px-5 py-4" style={{ borderTop: `1px solid ${BORDER}` }}>
              {error && (
                <div className="flex items-center gap-2 rounded-xl px-3 py-2 mb-3 text-sm" style={{ background: "#FEF2F2", color: "#991b1b" }}>
                  <AlertCircle size={14} /> {error}
                </div>
              )}
              {/* Bill-level discount input */}
              <div className="flex items-center gap-2 mb-3 rounded-xl px-3 py-2" style={{ border: `1px solid ${BORDER}` }}>
                <span className="text-xs" style={{ color: MUTED }}>ส่วนลดทั้งบิล ฿</span>
                <input
                  type="number" min={0}
                  value={discountBaht || ""}
                  onChange={e => setDiscountBaht(Math.max(0, Number(e.target.value)))}
                  placeholder="0"
                  className="flex-1 text-sm outline-none bg-transparent"
                  style={{ color: TEXT }}
                />
                {discountBaht > 0 && (
                  <button onClick={() => setDiscountBaht(0)} className="text-xs" style={{ color: MUTED }}>ล้าง</button>
                )}
              </div>
              {discountSatang > 0 && (
                <div className="flex items-center justify-between mb-1 text-xs" style={{ color: MUTED }}>
                  <span>ก่อนส่วนลดทั้งบิล</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
              )}
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm" style={{ color: MUTED }}>ยอดรวม</p>
                <p className="text-xl font-bold" style={{ color: TEXT }}>{formatPrice(total)}</p>
              </div>
              <button
                onClick={checkout}
                disabled={submitting || cart.length === 0 || !customer.name}
                className="w-full py-3.5 rounded-xl text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ background: PRIMARY }}
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                {submitting ? "กำลังบันทึก..." : "ชำระเงิน"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Branch picker */}
      {showBranchPicker && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: "rgba(0,0,0,0.4)" }}
          onClick={() => setShowBranchPicker(false)}
        >
          <div className="w-full max-w-md bg-white rounded-t-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${BORDER}` }}>
              <p className="font-medium" style={{ color: TEXT }}>เลือกสาขา</p>
              <button onClick={() => setShowBranchPicker(false)} className="p-1" style={{ color: MUTED }}>
                <X size={18} />
              </button>
            </div>
            <ul className="p-3">
              {branches.map(b => (
                <li key={b.id}>
                  <button
                    onClick={() => switchBranch(b.id)}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl"
                    style={{
                      background: b.id === activeBranchId ? "#FFF8F4" : "transparent",
                      color: TEXT,
                    }}
                  >
                    <span className="text-sm">{b.name}</span>
                    {b.id === activeBranchId && <Check size={16} style={{ color: PRIMARY }} />}
                  </button>
                </li>
              ))}
            </ul>
            <div className="h-4" />
          </div>
        </div>
      )}
    </main>
  );
}
