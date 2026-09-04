import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PDPA_VERSION } from "@/lib/pdpa";
import { startOfTodayUTC } from "@/lib/utils";
import { MEMBERSHIP_PRICE_SATANG } from "@/lib/membership";
import { PACKAGE_SPECS, BUFFET_SKU, FIVE_PACK_SKU } from "@/lib/packages";
import { sendEntitlementReceived } from "@/lib/notifications";
import { promoHeroUrl } from "@/lib/flex/membership";

/** Map the LIFF product key (from `source`) to its entitlement details. */
type ProductKey = "membership" | "buffet" | "5pack";
function parseProduct(source: string): ProductKey {
  if (source.endsWith("buffet")) return "buffet";
  if (source.endsWith("5pack"))  return "5pack";
  return "membership";
}
function bahtTh(satang: number): string {
  return `฿${(satang / 100).toLocaleString("en-US")}`;
}

interface SignupBody {
  name:         string;
  nickname?:    string;  // ชื่อเล่น — optional
  phone:        string;
  email?:       string;
  gender?:      string;
  dateOfBirth?: string; // ISO date string "YYYY-MM-DD"
  pdpaConsent:  boolean;
  source?:      string; // e.g. "liff-membership" | "liff-buffet" | "liff-5pack" | "signup" | "staff"
  lineUserId?:  string; // provided when signing up via LIFF
  pictureUrl?:  string; // LINE profile picture
}

/** POST /api/membership/signup
 *  Creates (or updates) a Customer with PDPA consent and a pending entitlement.
 *  The entitlement remains inactive until payment is processed in POS.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json() as SignupBody;
    const { name, nickname, phone, email, gender, dateOfBirth, pdpaConsent, lineUserId, pictureUrl } = body;
    const source = body.source ?? "signup";

    // Validate
    if (!name?.trim()) {
      return NextResponse.json({ error: "กรุณาระบุชื่อ" }, { status: 400 });
    }
    if (!phone?.trim()) {
      return NextResponse.json({ error: "กรุณาระบุเบอร์โทร" }, { status: 400 });
    }
    if (!pdpaConsent) {
      return NextResponse.json({ error: "กรุณายอมรับนโยบาย PDPA" }, { status: 400 });
    }

    const phoneClean = phone.trim();
    const product    = parseProduct(source);

    // Check if customer already exists
    const existing = await prisma.customer.findUnique({
      where: { phone: phoneClean },
      include: { membership: true },
    });

    // If signing up for MEMBERSHIP and they already have an active one, short-circuit.
    // (Package signups are unaffected — a member can still buy a Buffet / 5-pack.)
    if (product === "membership" && existing?.membership) {
      const m = existing.membership;
      const expired = m.expiresAt != null && new Date(m.expiresAt) < startOfTodayUTC();
      const usedUp  = m.usagesAllowed > 0 && m.usagesUsed >= m.usagesAllowed;
      const isValid = !expired && !usedUp && !m.pendingActivation;

      if (isValid) {
        return NextResponse.json({
          status: "already_member",
          customerId: existing.id,
          message: "การสมัครสมาชิกเสร็จสิ้นเรียบร้อยแล้ว",
        }, { status: 200 });
      }
    }

    // Upsert customer with PDPA consent (and optional LINE identity)
    const customer = await prisma.customer.upsert({
      where:  { phone: phoneClean },
      update: {
        name:          name.trim(),
        ...(nickname   ? { nickname: nickname.trim() } : {}),
        email:         email?.trim() || undefined,
        gender:        gender || undefined,
        ...(dateOfBirth ? { dateOfBirth: new Date(dateOfBirth) } : {}),
        pdpaConsentAt: new Date(),
        pdpaVersion:   PDPA_VERSION,
        pdpaSource:    source,
        ...(lineUserId ? { lineUserId } : {}),
        ...(pictureUrl ? { pictureUrl } : {}),
      },
      create: {
        name:          name.trim(),
        ...(nickname    ? { nickname: nickname.trim() }         : {}),
        phone:          phoneClean,
        email:          email?.trim() || undefined,
        gender:         gender || undefined,
        ...(dateOfBirth ? { dateOfBirth: new Date(dateOfBirth) } : {}),
        pdpaConsentAt:  new Date(),
        pdpaVersion:    PDPA_VERSION,
        pdpaSource:     source,
        ...(lineUserId  ? { lineUserId } : {}),
        ...(pictureUrl  ? { pictureUrl } : {}),
      },
    });

    // ── Create a PENDING entitlement so staff see "รอเปิดใช้" in POS search ──
    // and so we can send a "received" acknowledgement. Only flips to active when
    // staff complete the sale at POS (activateOrRenewMembership / activatePackage).
    const now = new Date();
    let newlyPending = false;
    let productName  = "สมาชิกรายเดือน";
    let priceTh      = bahtTh(MEMBERSHIP_PRICE_SATANG);

    if (product === "membership") {
      const m = await prisma.membership.findUnique({ where: { customerId: customer.id } });
      if (!m?.pendingActivation) {
        await prisma.membership.upsert({
          where:  { customerId: customer.id },
          update: { pendingActivation: true, expiresAt: null, usagesUsed: 0 },
          create: { customerId: customer.id, pendingActivation: true, expiresAt: null, usagesUsed: 0 },
        });
        newlyPending = true;
      }
    } else {
      const sku  = product === "buffet" ? BUFFET_SKU : FIVE_PACK_SKU;
      const spec = PACKAGE_SPECS[sku];
      productName = spec.nameTh;
      priceTh     = bahtTh(spec.priceSatang);

      const existingPkg = await prisma.customerPackage.findFirst({
        where:   { customerId: customer.id, packageSku: sku, closedAt: null },
        orderBy: { startedAt: "desc" },
      });
      if (!existingPkg?.pendingActivation) {
        await prisma.customerPackage.create({
          data: {
            customerId:        customer.id,
            packageSku:        sku,
            pendingActivation: true,
            startedAt:         now,
            // placeholder — reset to real dates on activation at POS
            expiresAt:         new Date(now.getTime() + (spec.validityDays - 1) * 24 * 60 * 60 * 1000),
            usagesUsed:        0,
            usageLimit:        spec.usageLimit,
            paidAmount:        0,
          },
        });
        newlyPending = true;
      }
    }

    // Fire-and-forget "we got your application, pay at the counter" card.
    if (newlyPending && customer.lineUserId) {
      sendEntitlementReceived({
        lineUserId:  customer.lineUserId,
        greetName:   customer.nickname || customer.name,
        productName,
        priceTh,
        heroUrl:     promoHeroUrl(product),
      }).catch(e => console.error("[notify] entitlement received failed", e));
    }

    return NextResponse.json({
      status: "pending_payment",
      customerId: customer.id,
    }, { status: 201 });
  } catch (e) {
    console.error("Signup error:", e);
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
