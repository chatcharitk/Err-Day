import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PDPA_VERSION } from "@/lib/pdpa";

interface SignupBody {
  name:        string;
  nickname?:   string;  // ชื่อเล่น — optional
  phone:       string;
  email?:      string;
  gender?:     string;
  pdpaConsent: boolean;
  source?:     "signup" | "liff" | "staff" | "booking";
  lineUserId?: string;  // provided when signing up via LIFF
  pictureUrl?: string;  // LINE profile picture
}

/** POST /api/membership/signup
 *  Creates (or updates) a Customer with PDPA consent, ready to be activated
 *  by staff at POS. Does NOT create a Membership — that happens when payment
 *  is processed in POS.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json() as SignupBody;
    const { name, nickname, phone, email, gender, pdpaConsent, lineUserId, pictureUrl } = body;
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

    // Check if customer already exists
    const existing = await prisma.customer.findUnique({
      where: { phone: phoneClean },
      include: { membership: true },
    });

    // If customer exists AND has an active membership, short-circuit
    if (existing?.membership) {
      const m = existing.membership;
      const now = new Date();
      const expired = m.expiresAt != null && new Date(m.expiresAt) <= now;
      const usedUp  = m.usagesAllowed > 0 && m.usagesUsed >= m.usagesAllowed;
      const isValid = !expired && !usedUp;

      if (isValid) {
        return NextResponse.json({
          status: "already_member",
          customerId: existing.id,
          message: "คุณเป็นสมาชิกอยู่แล้ว",
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
        pdpaConsentAt: new Date(),
        pdpaVersion:   PDPA_VERSION,
        pdpaSource:    source,
        ...(lineUserId ? { lineUserId } : {}),
        ...(pictureUrl ? { pictureUrl } : {}),
      },
      create: {
        name:          name.trim(),
        ...(nickname   ? { nickname: nickname.trim() } : {}),
        phone:         phoneClean,
        email:         email?.trim() || undefined,
        gender:        gender || undefined,
        pdpaConsentAt: new Date(),
        pdpaVersion:   PDPA_VERSION,
        pdpaSource:    source,
        ...(lineUserId ? { lineUserId } : {}),
        ...(pictureUrl ? { pictureUrl } : {}),
      },
    });

    return NextResponse.json({
      status: "pending_payment",
      customerId: customer.id,
    }, { status: 201 });
  } catch (e) {
    console.error("Signup error:", e);
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
